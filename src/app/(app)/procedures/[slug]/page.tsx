import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FlaskConical } from "lucide-react";
import {
  fetchOpenSuggestionsByStep,
  fetchProcedureBySlug,
  isAdminUser,
} from "@/lib/procedures";
import { formatDate } from "@/lib/format";
import { ProcedureSteps } from "./ProcedureSteps";

export default async function ProcedureDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await fetchProcedureBySlug(slug);
  if (!data) notFound();

  const { procedure, sections, steps, chemicals } = data;
  const [pending, canEdit] = await Promise.all([
    fetchOpenSuggestionsByStep(steps.map((s) => s.id)),
    isAdminUser(),
  ]);

  const pendingByStep: Record<string, number> = {};
  for (const [stepId, rows] of pending) pendingByStep[stepId] = rows.length;

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/procedures"
        className="inline-flex min-h-10 items-center gap-1.5 font-display text-xs font-semibold uppercase tracking-[0.12em] text-denim hover:text-denim-deep"
      >
        <ArrowLeft size={14} /> All procedures
      </Link>

      <div className="mt-1">
        <p className="font-display text-xs font-semibold uppercase tracking-[0.12em] text-ink-soft">
          {procedure.category}
        </p>
        <h1 className="font-display text-2xl font-bold uppercase tracking-wide text-denim-ink md:text-4xl">
          {procedure.title}
        </h1>
        <p className="mt-2 leading-relaxed text-ink-soft">{procedure.summary}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-ink-soft">
          <span className="rounded-full bg-gold/25 px-2 py-0.5 font-display font-semibold uppercase tracking-wider text-denim-ink">
            {procedure.frequency ?? "As needed"}
          </span>
          <span>
            {sections.length} {sections.length === 1 ? "section" : "sections"}
          </span>
          <span>·</span>
          <span>Updated {formatDate(procedure.updated_at)}</span>
        </div>
      </div>

      <ProcedureSteps
        slug={procedure.slug}
        sections={sections}
        steps={steps}
        chemicals={chemicals}
        pendingByStep={pendingByStep}
        canEdit={canEdit}
      />

      {chemicals.length > 0 && (
        <p className="mt-6 text-sm text-ink-soft">
          <Link
            href="/chemicals"
            className="inline-flex items-center gap-1.5 font-semibold text-denim hover:underline"
          >
            <FlaskConical size={15} /> Full chemical cheat sheet
          </Link>
        </p>
      )}
    </div>
  );
}
