import Link from "next/link";
import { Bug, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { customerDisplayName } from "@/lib/customers";
import { pestBySlug } from "@/lib/pests";
import { formatCents } from "@/lib/pricing";
import { StatusBadge } from "@/components/inspect/StatusBadge";
import type { Inspection } from "@/lib/types";

interface InspectionRow extends Inspection {
  profiles: { full_name: string } | null;
  customers: { first_name: string; last_name: string; company_name: string } | null;
  properties: { address_line1: string; city: string } | null;
}

export default async function HistoryPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("inspections")
    .select(
      "*, profiles(full_name), customers(first_name, last_name, company_name), properties(address_line1, city)"
    )
    .order("created_at", { ascending: false })
    .limit(50);

  const inspections = (data ?? []) as InspectionRow[];

  return (
    <div className="space-y-4">
      <h1 className="font-display text-xl font-bold uppercase tracking-[0.08em] text-denim-ink">
        Inspection History
      </h1>

      {error && (
        <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
          Couldn&apos;t load inspections. If this keeps happening, make sure
          supabase/001_inspections.sql has been run.
        </p>
      )}

      {!error && inspections.length === 0 && (
        <div className="card py-8 text-center">
          <Bug size={28} className="mx-auto text-ink-soft" />
          <p className="mt-2 text-sm text-ink-soft">
            No inspections yet. Snap your first pest photo on the Inspect tab.
          </p>
        </div>
      )}

      <ul className="space-y-2">
        {inspections.map((row) => {
          const pest = row.pest_confirmed ? pestBySlug(row.pest_confirmed) : null;
          const date = new Date(row.created_at).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          });
          return (
            <li key={row.id}>
              <Link href={`/history/${row.id}`} className="card flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-semibold text-ink">
                      {pest?.commonName ?? "Unknown pest"}
                    </span>
                    <StatusBadge status={row.status} />
                  </div>
                  {row.customers && (
                    <p className="truncate text-xs font-medium text-denim">
                      {customerDisplayName(row.customers)}
                      {row.properties ? ` · ${row.properties.address_line1}` : ""}
                    </p>
                  )}
                  <p className="text-xs text-ink-soft">
                    {date} · {row.profiles?.full_name ?? "Unknown tech"}
                  </p>
                </div>
                <div className="text-right">
                  {row.estimate_cents !== null && (
                    <p className="font-display font-bold text-denim-ink">
                      {formatCents(row.estimate_cents)}
                    </p>
                  )}
                  <ChevronRight size={16} className="ml-auto text-ink-soft" />
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
