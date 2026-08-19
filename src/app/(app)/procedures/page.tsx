import Link from "next/link";
import { BookOpen, FlaskConical, Inbox } from "lucide-react";
import { fetchOpenSuggestionCount, fetchProcedures } from "@/lib/procedures";
import type { Procedure } from "@/lib/types";
import { ProcedureCard } from "./ProcedureCard";

function groupByCategory(procedures: Procedure[]): [string, Procedure[]][] {
  const groups = new Map<string, Procedure[]>();
  for (const procedure of procedures) {
    const bucket = groups.get(procedure.category);
    if (bucket) bucket.push(procedure);
    else groups.set(procedure.category, [procedure]);
  }
  return [...groups.entries()];
}

export default async function ProceduresPage() {
  const [procedures, openSuggestions] = await Promise.all([
    fetchProcedures(),
    fetchOpenSuggestionCount(),
  ]);
  const groups = groupByCategory(procedures);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold uppercase tracking-wide text-denim-ink md:text-4xl">
            Procedures
          </h1>
          <p className="mt-1 text-ink-soft">
            Every service, start to finish. Open one to work it as a checklist.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/chemicals" className="btn-ghost btn-tap">
            <FlaskConical size={15} /> Chemicals
          </Link>
          <Link href="/procedures/suggestions" className="btn-ghost btn-tap">
            <Inbox size={15} /> Suggestions
            {openSuggestions > 0 && (
              <span className="rounded-full bg-gold px-1.5 font-sans text-[11px] font-bold leading-tight text-denim-ink">
                {openSuggestions}
              </span>
            )}
          </Link>
        </div>
      </div>

      {procedures.length === 0 && (
        <div className="mt-6 rounded-lg border border-dashed border-line bg-card px-4 py-6 text-center md:py-10">
          <BookOpen size={28} className="mx-auto text-ink-soft" />
          <p className="mt-2 text-ink-soft">
            No procedures loaded yet — run the ops manual migration and seed.
          </p>
        </div>
      )}

      {groups.map(([category, items]) => (
        <section key={category} className="mt-6 md:mt-8">
          <h2 className="mb-2 flex items-center gap-2 font-display text-base font-bold uppercase tracking-wide text-denim-ink md:text-lg">
            {category}
            <span className="text-sm font-semibold text-ink-soft">
              {items.length}
            </span>
          </h2>
          <div className="grid gap-3">
            {items.map((procedure) => (
              <ProcedureCard key={procedure.id} procedure={procedure} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
