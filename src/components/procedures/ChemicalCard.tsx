import { AlertTriangle } from "lucide-react";
import type { Chemical } from "@/lib/types";

/** Notes that flag a conflict between source documents get the warning styling. */
const DISCREPANCY = /discrepan|conflict|inconsisten/i;

const REPELLENCY_LABEL: Record<Chemical["repellency"], string> = {
  repellent: "Repellent",
  "non-repellent": "Non-repellent",
  "n/a": "Repellency n/a",
};

export function RepellencyBadge({
  repellency,
}: {
  repellency: Chemical["repellency"];
}) {
  const strong = repellency === "non-repellent";
  return (
    <span
      className={`rounded-full px-2 py-0.5 font-display text-[11px] font-semibold uppercase tracking-wider ${
        strong ? "bg-gold/25 text-denim-ink" : "bg-ink-soft/10 text-ink-soft"
      }`}
    >
      {REPELLENCY_LABEL[repellency]}
    </span>
  );
}

function MixRatios({ chemical }: { chemical: Chemical }) {
  if (chemical.mix_ratios.length === 0) {
    return (
      <p className="mt-3 text-sm text-ink-soft">
        No mix ratio on file — follow the product label.
      </p>
    );
  }

  return (
    <dl className="mt-3 divide-y divide-line border-t border-line">
      {chemical.mix_ratios.map((mix, i) => (
        <div
          key={`${mix.context}-${i}`}
          className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 py-2"
        >
          <dt className="text-sm text-ink-soft">{mix.context}</dt>
          <dd className="font-display text-base font-semibold text-denim-ink">
            {mix.ratio}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function ChemicalCard({ chemical }: { chemical: Chemical }) {
  const flagged = chemical.notes ? DISCREPANCY.test(chemical.notes) : false;

  return (
    <article className="card">
      <h3 className="font-display text-lg font-bold uppercase tracking-wide text-denim-ink">
        {chemical.name}
      </h3>
      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        <RepellencyBadge repellency={chemical.repellency} />
        <span className="rounded-full bg-denim/10 px-2 py-0.5 font-display text-[11px] font-semibold uppercase tracking-wider text-denim">
          {chemical.category}
        </span>
        <span className="text-xs text-ink-soft">
          {chemical.epa_number ? `EPA ${chemical.epa_number}` : "No EPA number"}
        </span>
      </div>

      <MixRatios chemical={chemical} />

      {chemical.notes && (
        <div
          className={`mt-3 rounded-md px-3 py-2 text-sm leading-relaxed ${
            flagged ? "bg-danger/10 text-danger" : "bg-paper text-ink-soft"
          }`}
        >
          {flagged && (
            <p className="mb-1 flex items-center gap-1.5 font-display text-xs font-semibold uppercase tracking-wider">
              <AlertTriangle size={13} /> Label discrepancy
            </p>
          )}
          {chemical.notes}
        </div>
      )}
    </article>
  );
}
