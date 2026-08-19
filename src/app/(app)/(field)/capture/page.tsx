"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Loader2, RotateCcw, Save } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { prepareImage, type PreparedImage } from "@/lib/image";
import { computeEstimate, type Estimate } from "@/lib/pricing";
import { pestBySlug } from "@/lib/pests";
import { saveInspection } from "@/lib/actions/inspections";
import type { CustomerLink } from "@/lib/customers";
import { CustomerPicker } from "@/components/CustomerPicker";
import { CandidatePicker } from "@/components/inspect/CandidatePicker";
import { DetailsForm } from "@/components/inspect/DetailsForm";
import { PlanView } from "@/components/inspect/PlanView";
import type { IdentifyResult } from "@/lib/types";

type Phase = "photo" | "identifying" | "confirm" | "details" | "planning" | "result";

// Fable 5 turns can run long — don't let the client give up early.
const IDENTIFY_TIMEOUT_MS = 120_000;
const PLAN_TIMEOUT_MS = 180_000;

async function postJson<T>(url: string, body: unknown, timeoutMs: number): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "TimeoutError") {
      throw new Error("This is taking longer than expected. Check your signal and try again.");
    }
    throw new Error("Couldn't reach the server. Check your connection and try again.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || "Something went wrong. Try again.");
  }
  return data as T;
}

export default function CapturePage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [phase, setPhase] = useState<Phase>("photo");
  const [error, setError] = useState<string | null>(null);
  const [photo, setPhoto] = useState<PreparedImage | null>(null);
  const [identify, setIdentify] = useState<IdentifyResult | null>(null);
  const [pestSlug, setPestSlug] = useState<string | null>(null);
  const [confidence, setConfidence] = useState<number | null>(null);
  const [sqft, setSqft] = useState("");
  const [notes, setNotes] = useState("");
  const [planMd, setPlanMd] = useState<string | null>(null);
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [customerLink, setCustomerLink] = useState<CustomerLink | null>(null);
  const [saving, setSaving] = useState(false);

  function reset() {
    if (photo) URL.revokeObjectURL(photo.previewUrl);
    setPhase("photo");
    setError(null);
    setPhoto(null);
    setIdentify(null);
    setPestSlug(null);
    setConfidence(null);
    setSqft("");
    setNotes("");
    setPlanMd(null);
    setEstimate(null);
    setCustomerLink(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    let prepared: PreparedImage;
    try {
      prepared = await prepareImage(file);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't read that photo.");
      return;
    }
    setPhoto(prepared);
    setPhase("identifying");
    try {
      const result = await postJson<IdentifyResult>(
        "/api/identify",
        { image: prepared.base64, media_type: prepared.mediaType },
        IDENTIFY_TIMEOUT_MS
      );
      setIdentify(result);
    } catch (err) {
      // ID failed — tech can still pick the pest manually
      setError(err instanceof Error ? err.message : "Identification failed.");
      setIdentify({ candidates: [], photo_quality_note: "" });
    }
    setPhase("confirm");
  }

  function handleConfirm(slug: string, conf: number | null) {
    setError(null);
    setPestSlug(slug);
    setConfidence(conf);
    setPhase("details");
  }

  async function handleGeneratePlan() {
    if (!pestSlug) return;
    setError(null);
    setPhase("planning");
    const sqftNum = sqft ? Number(sqft) : undefined;
    try {
      const result = await postJson<{ plan_md: string }>(
        "/api/plan",
        { pest: pestSlug, notes: notes || undefined, sqft: sqftNum },
        PLAN_TIMEOUT_MS
      );
      setPlanMd(result.plan_md);
      setEstimate(computeEstimate(pestSlug, sqftNum ?? null));
      setPhase("result");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Plan generation failed.");
      setPhase("details");
    }
  }

  async function handleSave() {
    if (!photo || !pestSlug || !planMd) return;
    setSaving(true);
    setError(null);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Your session expired. Sign in again.");

      const path = `${user.id}/${crypto.randomUUID()}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from("inspection-photos")
        .upload(path, photo.blob, { contentType: "image/jpeg" });
      if (uploadError) {
        throw new Error("Photo upload failed. Check your connection and try again.");
      }

      const sqftNum = sqft ? Number(sqft) : null;
      const result = await saveInspection({
        photo_path: path,
        customer_id: customerLink?.customer.id ?? null,
        property_id: customerLink?.property?.id ?? null,
        pest_confirmed: pestSlug,
        pest_candidates: identify?.candidates ?? [],
        confidence,
        plan_md: planMd,
        estimate_cents: estimate?.total_cents ?? 0,
        estimate_breakdown: {
          lines: estimate?.lines ?? [],
          recurring_cents: estimate?.recurring_cents ?? 0,
          demo: estimate?.demo ?? true,
          sqft: Number.isFinite(sqftNum) ? sqftNum : null,
        },
        notes: notes || null,
      });
      if (result.error || !result.id) {
        throw new Error(result.error ?? "Save failed.");
      }
      router.push(`/history/${result.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed. Try again.");
      setSaving(false);
    }
  }

  const pest = pestSlug ? pestBySlug(pestSlug) : null;

  return (
    <div className="space-y-4">
      {photo && phase !== "photo" && (
        <div className="overflow-hidden rounded-xl border border-line">
          {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview */}
          <img
            src={photo.previewUrl}
            alt="Pest evidence photo"
            className="max-h-64 w-full object-cover"
          />
        </div>
      )}

      {error && (
        <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
      )}

      {phase === "photo" && (
        <div className="card space-y-4 text-center">
          <h1 className="font-display text-xl font-bold uppercase tracking-[0.08em] text-denim-ink">
            New Inspection
          </h1>
          <p className="text-sm text-ink-soft">
            Snap a photo of the pest or its evidence — droppings, damage, webs,
            mud tubes. Get close and hold steady.
          </p>
          <label className="btn-primary w-full cursor-pointer">
            <Camera size={18} />
            Take photo
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
          </label>
        </div>
      )}

      {(phase === "identifying" || phase === "planning") && (
        <div className="card flex flex-col items-center gap-3 py-8 text-center">
          <Loader2 size={32} className="animate-spin text-denim" />
          <p className="font-semibold text-ink">
            {phase === "identifying" ? "Analyzing photo…" : "Writing treatment plan…"}
          </p>
          <p className="text-sm text-ink-soft">
            {phase === "identifying"
              ? "The AI is examining the evidence. This can take a minute — hang tight."
              : "Building the plan from Crescent's treatment procedures."}
          </p>
        </div>
      )}

      {phase === "confirm" && identify && (
        <>
          <CandidatePicker
            candidates={identify.candidates}
            photoQualityNote={identify.photo_quality_note}
            onConfirm={handleConfirm}
          />
          <button type="button" onClick={reset} className="btn-ghost w-full">
            <RotateCcw size={16} />
            Retake photo
          </button>
        </>
      )}

      {phase === "details" && pestSlug && (
        <DetailsForm
          pestSlug={pestSlug}
          sqft={sqft}
          notes={notes}
          onSqftChange={setSqft}
          onNotesChange={setNotes}
          onGenerate={handleGeneratePlan}
          onBack={() => setPhase("confirm")}
        />
      )}

      {phase === "result" && pest && planMd && (
        <>
          <PlanView
            pestName={pest.commonName}
            planMd={planMd}
            totalCents={estimate?.total_cents ?? null}
            breakdown={
              estimate
                ? {
                    lines: estimate.lines,
                    recurring_cents: estimate.recurring_cents,
                    demo: estimate.demo,
                    sqft: sqft ? Number(sqft) : null,
                  }
                : null
            }
          />
          <div className="card space-y-1.5">
            <p className="label">Link to customer (optional)</p>
            <CustomerPicker value={customerLink} onChange={setCustomerLink} />
          </div>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="btn-primary w-full"
          >
            {saving ? <Loader2 size={17} className="animate-spin" /> : <Save size={17} />}
            {saving ? "Saving…" : "Save inspection"}
          </button>
          <button type="button" onClick={reset} disabled={saving} className="btn-ghost w-full">
            <RotateCcw size={16} />
            Start over
          </button>
        </>
      )}
    </div>
  );
}
