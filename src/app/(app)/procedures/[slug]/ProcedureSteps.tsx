"use client";

import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import { ChevronDown, RotateCcw } from "lucide-react";
import type { Chemical, ProcedureSection, ProcedureStep } from "@/lib/types";
import { StepRow } from "./StepRow";
import {
  EMPTY_CHECKS,
  getChecksSnapshot,
  parseChecks,
  setChecks,
  subscribeChecks,
} from "./checkStore";

const serverSnapshot = () => EMPTY_CHECKS;

/**
 * Checklist view of a procedure: collapsible sections, per-step check-off
 * persisted to localStorage, and the suggest/edit affordances on each step.
 */
export function ProcedureSteps({
  slug,
  sections,
  steps,
  chemicals,
  pendingByStep,
  canEdit,
}: {
  slug: string;
  sections: ProcedureSection[];
  steps: ProcedureStep[];
  chemicals: Chemical[];
  /** open suggestion count per step id */
  pendingByStep: Record<string, number>;
  canEdit: boolean;
}) {
  const chemicalMap = useMemo(
    () => new Map(chemicals.map((c) => [c.id, c])),
    [chemicals],
  );

  const stepsBySection = useMemo(() => {
    const map = new Map<string, ProcedureStep[]>();
    for (const step of steps) {
      const bucket = map.get(step.section_id);
      if (bucket) bucket.push(step);
      else map.set(step.section_id, [step]);
    }
    return map;
  }, [steps]);

  // only plain steps are checkable; warnings and tips are read-only callouts
  const checkable = useMemo(
    () => new Set(steps.filter((s) => s.kind === "step").map((s) => s.id)),
    [steps],
  );

  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());

  const snapshot = useSyncExternalStore(
    subscribeChecks,
    () => getChecksSnapshot(slug),
    serverSnapshot,
  );
  const checked = useMemo(
    () => parseChecks(snapshot, checkable),
    [snapshot, checkable],
  );

  const toggle = useCallback(
    (id: string) => {
      const next = parseChecks(getChecksSnapshot(slug), checkable);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      setChecks(slug, [...next]);
    },
    [slug, checkable],
  );

  const toggleSection = useCallback((id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const allCollapsed =
    sections.length > 0 && collapsed.size >= sections.length;
  const done = checked.size;
  const total = checkable.size;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);

  return (
    <div className="mt-5">
      <div className="card">
        <div className="flex items-center justify-between gap-3">
          <p className="label mb-0">Checklist</p>
          <p className="font-display text-sm font-semibold text-ink-soft">
            {done} / {total} done
          </p>
        </div>
        <div
          className="mt-2 h-1.5 w-full rounded-full bg-line"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
          aria-label="Checklist progress"
        >
          <div
            className="h-full rounded-full bg-gold transition-[width] duration-200"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() =>
              setCollapsed(
                allCollapsed ? new Set() : new Set(sections.map((s) => s.id)),
              )
            }
            className="btn-ghost btn-tap"
          >
            {allCollapsed ? "Expand all" : "Collapse all"}
          </button>
          <button
            type="button"
            onClick={() => setChecks(slug, [])}
            disabled={done === 0}
            className="btn-ghost btn-tap disabled:opacity-50"
          >
            <RotateCcw size={15} /> Reset
          </button>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {sections.map((section, index) => {
          const sectionSteps = stepsBySection.get(section.id) ?? [];
          const sectionDone = sectionSteps.filter(
            (s) => s.kind === "step" && checked.has(s.id),
          ).length;
          const sectionTotal = sectionSteps.filter(
            (s) => s.kind === "step",
          ).length;
          const open = !collapsed.has(section.id);
          const panelId = `section-${section.id}`;

          return (
            <section
              key={section.id}
              className="overflow-hidden rounded-xl border border-line bg-card"
            >
              <h2>
                <button
                  type="button"
                  onClick={() => toggleSection(section.id)}
                  aria-expanded={open}
                  aria-controls={panelId}
                  className="flex min-h-12 w-full items-center gap-3 border-l-4 border-gold/60 px-3 py-2.5 text-left transition-colors hover:bg-denim/5 md:px-4"
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-denim font-display text-xs font-bold text-white">
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1 font-display text-base font-bold uppercase tracking-wide text-denim-ink md:text-lg">
                    {section.title}
                  </span>
                  {sectionTotal > 0 && (
                    <span className="shrink-0 text-xs text-ink-soft">
                      {sectionDone}/{sectionTotal}
                    </span>
                  )}
                  <ChevronDown
                    size={16}
                    className={`shrink-0 text-denim transition-transform ${
                      open ? "rotate-180" : ""
                    }`}
                  />
                </button>
              </h2>

              <div id={panelId} hidden={!open}>
                {sectionSteps.length === 0 ? (
                  <p className="px-4 pb-4 text-sm text-ink-soft">
                    No steps recorded for this section.
                  </p>
                ) : (
                  <ul className="px-3 pb-2 md:px-4">
                    {sectionSteps.map((step) => (
                      <StepRow
                        key={step.id}
                        step={step}
                        chemicals={chemicalMap}
                        checked={checked.has(step.id)}
                        onToggle={toggle}
                        pendingCount={pendingByStep[step.id] ?? 0}
                        canEdit={canEdit}
                      />
                    ))}
                  </ul>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
