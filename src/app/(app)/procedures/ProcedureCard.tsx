import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { formatDate } from "@/lib/format";
import type { Procedure } from "@/lib/types";

/** One procedure in the browse list. Whole card is the tap target. */
export function ProcedureCard({ procedure }: { procedure: Procedure }) {
  return (
    <Link
      href={`/procedures/${procedure.slug}`}
      className="card flex items-start gap-3 transition-colors hover:border-denim"
    >
      <span className="min-w-0 flex-1">
        <span className="font-display text-lg font-bold uppercase tracking-wide text-denim-ink">
          {procedure.title}
        </span>
        <span className="mt-1 block text-sm leading-relaxed text-ink-soft">
          {procedure.summary}
        </span>
        <span className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-soft">
          <span className="rounded-full bg-gold/25 px-2 py-0.5 font-display font-semibold uppercase tracking-wider text-denim-ink">
            {procedure.frequency ?? "As needed"}
          </span>
          <span>Updated {formatDate(procedure.updated_at)}</span>
        </span>
      </span>
      <ChevronRight size={18} className="mt-1 shrink-0 text-denim" />
    </Link>
  );
}
