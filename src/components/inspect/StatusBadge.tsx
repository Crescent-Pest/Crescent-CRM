import type { InspectionStatus } from "@/lib/types";

const STYLES: Record<string, string> = {
  draft: "bg-line text-ink-soft",
  presented: "bg-denim/15 text-denim",
  sold: "bg-ok/15 text-ok",
};

export function StatusBadge({ status }: { status: InspectionStatus | string }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 font-display text-[10px] font-bold uppercase tracking-[0.14em] ${
        STYLES[status] ?? STYLES.draft
      }`}
    >
      {status}
    </span>
  );
}
