import { formatCents } from "@/lib/pricing";
import type { EstimateBreakdown } from "@/lib/types";

export function DemoPricingBadge() {
  return (
    <span className="inline-flex items-center rounded-full bg-gold/20 px-2.5 py-0.5 font-display text-[11px] font-bold uppercase tracking-[0.14em] text-gold-deep">
      Demo pricing
    </span>
  );
}

/** Customer-facing estimate card. Amounts come from src/data/pricing.json via
 * code — never from the AI. */
export function EstimateCard({
  totalCents,
  breakdown,
}: {
  totalCents: number;
  breakdown: EstimateBreakdown;
}) {
  return (
    <div className="rounded-lg border border-line bg-white p-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-display text-sm font-bold uppercase tracking-[0.12em] text-denim">
          Your Estimate
        </h3>
        {breakdown.demo && <DemoPricingBadge />}
      </div>

      <ul className="space-y-1 text-sm text-ink">
        {breakdown.lines.map((line) => (
          <li key={line.label} className="flex justify-between gap-3">
            <span>{line.label}</span>
            <span className="tabular-nums">{formatCents(line.amount_cents)}</span>
          </li>
        ))}
      </ul>

      <div className="mt-3 flex items-baseline justify-between border-t border-line pt-3">
        <span className="font-semibold">Initial visit total</span>
        <span className="font-display text-2xl font-bold text-denim-ink">
          {formatCents(totalCents)}
        </span>
      </div>

      {breakdown.recurring_cents > 0 && (
        <p className="mt-1 text-right text-xs text-ink-soft">
          then {formatCents(breakdown.recurring_cents)} per follow-up visit
        </p>
      )}
    </div>
  );
}
