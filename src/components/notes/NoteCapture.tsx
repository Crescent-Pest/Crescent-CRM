"use client";

import { useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ClipboardList, Loader2, Mic, Save, Sparkles } from "lucide-react";
import { saveVisitNote } from "@/lib/actions/notes";
import { customerDisplayName, type CustomerLink } from "@/lib/customers";
import { CustomerPicker } from "@/components/CustomerPicker";
import { Recorder } from "@/components/notes/Recorder";
import { StructuredReview } from "@/components/notes/StructuredReview";
import type { StructuredActionItem, StructuredNote } from "@/lib/types";

type Phase = "input" | "structuring" | "review";

// Fable 5 turns can run long — don't let the client give up early.
const STRUCTURE_TIMEOUT_MS = 120_000;

// browser capabilities never change mid-session; nothing to subscribe to
const subscribeNoop = () => () => {};

export function NoteCapture({
  recordingEnabled,
  inspectionId,
}: {
  /** true only when TRANSCRIPTION_API_KEY is set on the server */
  recordingEnabled: boolean;
  inspectionId: string | null;
}) {
  const router = useRouter();

  const [phase, setPhase] = useState<Phase>("input");
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [customerLink, setCustomerLink] = useState<CustomerLink | null>(null);
  const [fallbackName, setFallbackName] = useState("");
  const [audioPath, setAudioPath] = useState<string | null>(null);
  const [structured, setStructured] = useState<StructuredNote | null>(null);
  const [items, setItems] = useState<StructuredActionItem[]>([]);
  const [saving, setSaving] = useState(false);

  // Feature-detect MediaRecorder; false during SSR so hydration agrees.
  const canRecord = useSyncExternalStore(
    subscribeNoop,
    () =>
      typeof MediaRecorder !== "undefined" &&
      Boolean(navigator.mediaDevices?.getUserMedia),
    () => false
  );

  function handleTranscript(transcript: string, path: string) {
    setAudioPath(path);
    setText((prev) => (prev.trim() ? `${prev.trim()}\n\n${transcript}` : transcript));
  }

  async function handleStructure() {
    const transcript = text.trim();
    if (!transcript) {
      setError("Dictate or type the note first.");
      return;
    }
    setError(null);
    setPhase("structuring");
    const enteredName = customerLink
      ? customerDisplayName(customerLink.customer)
      : fallbackName.trim();
    try {
      let res: Response;
      try {
        res = await fetch("/api/structure-note", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transcript, customer_name: enteredName || undefined }),
          signal: AbortSignal.timeout(STRUCTURE_TIMEOUT_MS),
        });
      } catch (err) {
        throw new Error(
          err instanceof DOMException && err.name === "TimeoutError"
            ? "This is taking longer than expected. Check your signal and try again."
            : "Couldn't reach the server. Check your connection and try again."
        );
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Something went wrong. Try again.");
      const result = data as StructuredNote;
      setStructured(result);
      setItems(result.action_items);
      // keep the heard name as free text so it isn't lost — the picker on the
      // review screen still offers the CRM match for one-tap confirm
      if (!customerLink && !fallbackName.trim() && result.mentioned_customer) {
        setFallbackName(result.mentioned_customer);
      }
      setPhase("review");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Structuring failed. Try again.");
      setPhase("input");
    }
  }

  async function handleSave() {
    if (!structured) return;
    setSaving(true);
    setError(null);
    const result = await saveVisitNote({
      transcript: text.trim(),
      summary: structured.summary,
      structured,
      customer_id: customerLink?.customer.id ?? null,
      customer_name: customerLink
        ? customerDisplayName(customerLink.customer)
        : fallbackName.trim() || null,
      inspection_id: inspectionId,
      audio_path: audioPath,
      action_items: items,
    });
    if (!result.id) {
      setError(result.error ?? "Save failed. Try again.");
      setSaving(false);
      return;
    }
    router.push(`/notes/${result.id}`);
  }

  if (phase === "structuring") {
    return (
      <div className="card flex flex-col items-center gap-3 py-8 text-center">
        <Loader2 size={32} className="animate-spin text-denim" />
        <p className="font-semibold text-ink">Organizing your note…</p>
        <p className="text-sm text-ink-soft">
          The AI is pulling out the summary and follow-ups. This can take a minute.
        </p>
      </div>
    );
  }

  if (phase === "review" && structured) {
    return (
      <div className="space-y-3">
        <h1 className="font-display text-xl font-bold uppercase tracking-[0.08em] text-denim-ink">
          Review &amp; Save
        </h1>
        {error && (
          <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
        )}
        <div className="card">
          <p className="label">Customer (optional)</p>
          <CustomerPicker
            value={customerLink}
            onChange={setCustomerLink}
            suggestedName={structured.mentioned_customer}
            fallbackName={fallbackName}
            onFallbackNameChange={setFallbackName}
          />
        </div>
        <StructuredReview structured={structured} items={items} onItemsChange={setItems} />
        <button type="button" onClick={handleSave} disabled={saving} className="btn-primary w-full">
          {saving ? <Loader2 size={17} className="animate-spin" /> : <Save size={17} />}
          {saving ? "Saving…" : "Save note & follow-ups"}
        </button>
        <button
          type="button"
          onClick={() => setPhase("input")}
          disabled={saving}
          className="btn-ghost w-full"
        >
          <ArrowLeft size={16} />
          Back to the note
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <h1 className="font-display text-xl font-bold uppercase tracking-[0.08em] text-denim-ink">
          Voice Note
        </h1>
        <p className="text-sm text-ink-soft">
          Talk through the visit — what you found, what you promised, what needs
          a follow-up. The AI turns it into a summary and a checklist.
        </p>
      </div>

      {inspectionId && (
        <p className="inline-flex items-center gap-1.5 rounded-full bg-denim/10 px-3 py-1 text-xs font-medium text-denim">
          <ClipboardList size={13} />
          Linked to this inspection
        </p>
      )}

      {error && (
        <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
      )}

      <div className="card space-y-3">
        <div className="flex items-start gap-2.5 rounded-md bg-gold/15 px-3 py-2.5">
          <Mic size={17} className="mt-0.5 shrink-0 text-gold-deep" />
          <p className="text-sm text-ink">
            <span className="font-semibold">Fastest way:</span> tap the note box,
            then tap the <span className="font-semibold">mic button on your keyboard</span> and
            just talk.
          </p>
        </div>

        <div>
          <label htmlFor="note-text" className="label">
            Visit notes
          </label>
          <textarea
            id="note-text"
            rows={7}
            className="field"
            placeholder="Sprayed the kitchen baseboards, found German roach activity under the sink. Told Mrs. Harper we'd re-treat in two weeks. Need to call her Friday about the quote…"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </div>

        {recordingEnabled && canRecord && (
          <Recorder onTranscript={handleTranscript} onError={(m) => setError(m || null)} />
        )}

        <div>
          <p className="label">Customer (optional)</p>
          <CustomerPicker
            value={customerLink}
            onChange={setCustomerLink}
            fallbackName={fallbackName}
            onFallbackNameChange={setFallbackName}
          />
        </div>
      </div>

      <button type="button" onClick={handleStructure} className="btn-primary w-full">
        <Sparkles size={17} />
        Organize with AI
      </button>
    </div>
  );
}
