import Link from "next/link";
import type { SuggestionRow } from "@/lib/procedures";
import type { SuggestionStatus } from "@/lib/types";
import { ReviewButtons } from "./ReviewButtons";

const STATUS: Record<SuggestionStatus, { label: string; className: string }> = {
  open: { label: "Open", className: "bg-gold/25 text-denim-ink" },
  accepted: { label: "Accepted", className: "bg-ok/15 text-ok" },
  rejected: { label: "Not adopted", className: "bg-ink-soft/10 text-ink-soft" },
};

const dateTimeFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

/** One suggestion: who sent it, the step it targets, and the proposed rewrite. */
export function SuggestionCard({
  suggestion,
  canReview,
}: {
  suggestion: SuggestionRow;
  canReview: boolean;
}) {
  const meta = STATUS[suggestion.status];
  const procedure = suggestion.step?.section?.procedure ?? null;
  const unchanged = suggestion.step?.content === suggestion.proposed_content;

  return (
    <article className="card">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`rounded-full px-2 py-0.5 font-display text-[11px] font-semibold uppercase tracking-wider ${meta.className}`}
        >
          {meta.label}
        </span>
        <span className="font-semibold text-denim-ink">
          {suggestion.author?.full_name ?? "Staff"}
        </span>
        <span className="ml-auto text-xs text-ink-soft">
          {dateTimeFmt.format(new Date(suggestion.created_at))}
        </span>
      </div>

      <p className="mt-2 text-xs text-ink-soft">
        {procedure ? (
          <Link
            href={`/procedures/${procedure.slug}`}
            className="font-semibold text-denim hover:underline"
          >
            {procedure.title}
          </Link>
        ) : (
          "Step removed"
        )}
        {suggestion.step?.section && (
          <span> · {suggestion.step.section.title}</span>
        )}
      </p>

      {suggestion.step && (
        <div className="mt-3">
          <p className="label">Currently reads</p>
          <p className="rounded-md bg-paper px-3 py-2 text-sm leading-relaxed text-ink-soft">
            {suggestion.step.content}
          </p>
        </div>
      )}

      <div className="mt-3">
        <p className="label">Proposed</p>
        <p className="rounded-md border border-gold/60 bg-gold/10 px-3 py-2 text-sm leading-relaxed">
          {suggestion.proposed_content}
        </p>
      </div>

      {suggestion.reason && (
        <p className="mt-2 text-sm text-ink-soft">
          <span className="font-semibold">Why:</span> {suggestion.reason}
        </p>
      )}

      {suggestion.status === "open" && unchanged && (
        <p className="mt-2 text-xs text-ink-soft">
          The proposed text matches the step as written — nothing would change.
        </p>
      )}

      {suggestion.status !== "open" && (
        <p className="mt-3 text-xs text-ink-soft">
          {meta.label} by {suggestion.reviewer?.full_name ?? "an admin"}
          {suggestion.reviewed_at &&
            ` on ${dateTimeFmt.format(new Date(suggestion.reviewed_at))}`}
        </p>
      )}

      {canReview && suggestion.status === "open" && (
        <ReviewButtons id={suggestion.id} />
      )}
    </article>
  );
}
