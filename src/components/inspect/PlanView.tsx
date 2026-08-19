import { Markdown } from "@/lib/markdown";
import { EstimateCard } from "@/components/inspect/EstimateCard";
import type { EstimateBreakdown } from "@/lib/types";

/**
 * Clean customer-facing summary: treatment plan + price estimate.
 * Shared by the capture result step and the history detail page.
 */
export function PlanView({
  pestName,
  planMd,
  totalCents,
  breakdown,
}: {
  pestName: string;
  planMd: string;
  totalCents: number | null;
  breakdown: EstimateBreakdown | null;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-line bg-white p-4">
        <p className="font-display text-[11px] font-semibold uppercase tracking-[0.2em] text-gold-deep">
          Crescent Pest Control
        </p>
        <h2 className="font-display text-xl font-bold uppercase tracking-[0.08em] text-denim-ink">
          Treatment Plan — {pestName}
        </h2>
        <div className="mt-3">
          <Markdown text={planMd} />
        </div>
        <p className="mt-4 border-t border-line pt-3 text-xs text-ink-soft">
          Pest identified with AI assistance and confirmed by your Crescent
          technician. Draft plan pending office review — application rates are
          verified against product labels before treatment.
        </p>
      </div>

      {totalCents !== null && breakdown !== null && (
        <EstimateCard totalCents={totalCents} breakdown={breakdown} />
      )}
    </div>
  );
}
