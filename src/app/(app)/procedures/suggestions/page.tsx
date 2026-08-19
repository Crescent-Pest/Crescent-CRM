import Link from "next/link";
import { ArrowLeft, Inbox } from "lucide-react";
import { fetchSuggestions, isAdminUser } from "@/lib/procedures";
import { SuggestionCard } from "./SuggestionCard";

export default async function SuggestionsPage() {
  const [suggestions, canReview] = await Promise.all([
    fetchSuggestions(),
    isAdminUser(),
  ]);

  const open = suggestions.filter((s) => s.status === "open");
  const reviewed = suggestions.filter((s) => s.status !== "open");

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/procedures"
        className="inline-flex min-h-10 items-center gap-1.5 font-display text-xs font-semibold uppercase tracking-[0.12em] text-denim hover:text-denim-deep"
      >
        <ArrowLeft size={14} /> Procedures
      </Link>

      <h1 className="font-display text-2xl font-bold uppercase tracking-wide text-denim-ink md:text-4xl">
        Suggestions
      </h1>
      <p className="mt-1 text-ink-soft">
        {canReview
          ? "Accepting a suggestion rewrites the step it points at."
          : "Changes the crew flagged. An admin decides what lands in the manual."}
      </p>

      {suggestions.length === 0 && (
        <div className="mt-6 rounded-lg border border-dashed border-line bg-card px-4 py-6 text-center md:py-10">
          <Inbox size={28} className="mx-auto text-ink-soft" />
          <p className="mt-2 text-ink-soft">
            Nothing here yet — techs send these from any step in a procedure.
          </p>
        </div>
      )}

      {open.length > 0 && (
        <section className="mt-6 md:mt-8">
          <h2 className="mb-2 flex items-center gap-2 font-display text-base font-bold uppercase tracking-wide text-denim-ink md:text-lg">
            Open
            <span className="text-sm font-semibold text-ink-soft">
              {open.length}
            </span>
          </h2>
          <div className="grid gap-3">
            {open.map((suggestion) => (
              <SuggestionCard
                key={suggestion.id}
                suggestion={suggestion}
                canReview={canReview}
              />
            ))}
          </div>
        </section>
      )}

      {reviewed.length > 0 && (
        <section className="mt-6 md:mt-8">
          <h2 className="mb-2 flex items-center gap-2 font-display text-base font-bold uppercase tracking-wide text-ink-soft md:text-lg">
            Reviewed
            <span className="text-sm font-semibold text-ink-soft">
              {reviewed.length}
            </span>
          </h2>
          <div className="grid gap-3">
            {reviewed.map((suggestion) => (
              <SuggestionCard
                key={suggestion.id}
                suggestion={suggestion}
                canReview={false}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
