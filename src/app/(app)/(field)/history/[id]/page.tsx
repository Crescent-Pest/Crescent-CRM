import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Mic, UserRound } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { customerDisplayName, propertyAddress } from "@/lib/customers";
import { pestBySlug } from "@/lib/pests";
import { PlanView } from "@/components/inspect/PlanView";
import { StatusBadge } from "@/components/inspect/StatusBadge";
import type { Inspection } from "@/lib/types";

interface InspectionRow extends Inspection {
  profiles: { full_name: string } | null;
  customers: {
    first_name: string;
    last_name: string;
    company_name: string;
    phone: string | null;
  } | null;
  properties: { address_line1: string; city: string } | null;
}

export default async function InspectionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data } = await supabase
    .from("inspections")
    .select(
      "*, profiles(full_name), customers(first_name, last_name, company_name, phone), properties(address_line1, city)"
    )
    .eq("id", id)
    .single();

  if (!data) notFound();
  const row = data as InspectionRow;

  let photoUrl: string | null = null;
  if (row.photo_path) {
    const { data: signed } = await supabase.storage
      .from("inspection-photos")
      .createSignedUrl(row.photo_path, 60 * 60);
    photoUrl = signed?.signedUrl ?? null;
  }

  const pest = row.pest_confirmed ? pestBySlug(row.pest_confirmed) : null;
  const created = new Date(row.created_at).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <Link
          href="/history"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-denim hover:text-denim-deep"
        >
          <ArrowLeft size={16} />
          History
        </Link>
        <StatusBadge status={row.status} />
      </div>

      <div>
        <h1 className="font-display text-xl font-bold uppercase tracking-[0.08em] text-denim-ink">
          {pest?.commonName ?? "Unknown pest"}
        </h1>
        <p className="text-xs text-ink-soft">
          {created} · {row.profiles?.full_name ?? "Unknown tech"}
        </p>
        <Link
          href={`/notes/new?inspection=${row.id}`}
          className="mt-1.5 inline-flex items-center gap-1.5 text-sm font-medium text-denim hover:text-denim-deep"
        >
          <Mic size={14} />
          Add voice note
        </Link>
      </div>

      {row.customers && (
        <div className="card flex items-start gap-2.5 p-3">
          <UserRound size={18} className="mt-0.5 shrink-0 text-denim" />
          <div className="min-w-0">
            <p className="font-semibold text-ink">{customerDisplayName(row.customers)}</p>
            <p className="text-xs text-ink-soft">
              {row.properties ? propertyAddress(row.properties) : "No property linked"}
              {row.customers.phone ? ` · ${row.customers.phone}` : ""}
            </p>
          </div>
        </div>
      )}

      {photoUrl && (
        <div className="overflow-hidden rounded-xl border border-line">
          {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL */}
          <img src={photoUrl} alt="Pest evidence" className="max-h-72 w-full object-cover" />
        </div>
      )}

      {row.notes && (
        <div className="card">
          <p className="label">Tech notes</p>
          <p className="text-sm text-ink">{row.notes}</p>
        </div>
      )}

      {row.pest_candidates && row.pest_candidates.length > 0 && (
        <div className="card">
          <p className="label">AI candidates (advisory)</p>
          <ul className="space-y-1 text-sm">
            {row.pest_candidates.map((c, i) => (
              <li key={i} className="flex justify-between gap-2">
                <span className="text-ink">{c.common_name}</span>
                <span className="tabular-nums text-ink-soft">
                  {Math.round(c.confidence * 100)}%
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {row.plan_md && (
        <PlanView
          pestName={pest?.commonName ?? "Pest"}
          planMd={row.plan_md}
          totalCents={row.estimate_cents}
          breakdown={row.estimate_breakdown}
        />
      )}
    </div>
  );
}
