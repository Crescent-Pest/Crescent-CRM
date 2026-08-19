"use client";

import { AlertTriangle, Plus, Sparkles, Trash2 } from "lucide-react";
import type { Profile, ReviewedActionItem, StructuredNote } from "@/lib/types";

export type StaffOption = Pick<Profile, "id" | "full_name">;

/** Profile id for an AI-suggested assignee name, or null when it matches
 * nobody on the active roster. */
export function matchAssignee(
  name: string | null | undefined,
  staff: StaffOption[]
): string | null {
  const wanted = String(name ?? "").trim().toLowerCase();
  if (!wanted) return null;
  return staff.find((s) => s.full_name.trim().toLowerCase() === wanted)?.id ?? null;
}

/**
 * Review step after Claude structures the note. The AI result is advisory —
 * the tech edits/deletes action items and confirms who each one is assigned to
 * before anything is saved.
 */
export function StructuredReview({
  structured,
  items,
  onItemsChange,
  staff,
  selfId,
}: {
  structured: StructuredNote;
  items: ReviewedActionItem[];
  onItemsChange: (items: ReviewedActionItem[]) => void;
  /** active staff, for the assignee dropdown */
  staff: StaffOption[];
  /** signed-in tech — the default assignee */
  selfId: string;
}) {
  // the signed-in tech must always be pickable, even if the roster lookup failed
  const options = staff.some((s) => s.id === selfId)
    ? staff
    : [{ id: selfId, full_name: "Me" }, ...staff];

  function update(index: number, patch: Partial<ReviewedActionItem>) {
    onItemsChange(items.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  }

  function remove(index: number) {
    onItemsChange(items.filter((_, i) => i !== index));
  }

  function add() {
    onItemsChange([
      ...items,
      { description: "", due_date: null, priority: "normal", assigned_to: selfId },
    ]);
  }

  return (
    <div className="space-y-3">
      <div className="card">
        <p className="label">Visit summary</p>
        <p className="text-sm text-ink">{structured.summary}</p>
      </div>

      {structured.customer_commitments.length > 0 && (
        <div className="card">
          <p className="label">Customer agreed to</p>
          <ul className="list-disc space-y-0.5 pl-4 text-sm text-ink">
            {structured.customer_commitments.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="card space-y-3">
        <div>
          <p className="label">Follow-ups</p>
          <p className="text-xs text-ink-soft">
            AI suggestions — fix anything that&apos;s off, delete what&apos;s bogus.
          </p>
        </div>

        {items.length === 0 && (
          <p className="text-sm text-ink-soft">No follow-ups. Add one if the AI missed something.</p>
        )}

        {items.map((item, i) => {
          const suggestedId = matchAssignee(item.assignee_name, staff);
          const aiSuggested = suggestedId !== null && suggestedId === item.assigned_to;
          return (
            <div key={i} className="space-y-2 rounded-md border border-line bg-white p-2.5">
              <div className="flex items-start gap-2">
                <input
                  type="text"
                  aria-label={`Follow-up ${i + 1} description`}
                  className="field"
                  placeholder="What needs to happen?"
                  value={item.description}
                  onChange={(e) => update(i, { description: e.target.value })}
                />
                <button
                  type="button"
                  aria-label={`Delete follow-up ${i + 1}`}
                  onClick={() => remove(i)}
                  className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-md text-ink-soft transition-colors hover:text-danger"
                >
                  <Trash2 size={17} />
                </button>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  aria-label={`Follow-up ${i + 1} due date`}
                  className="field flex-1"
                  value={item.due_date ?? ""}
                  onChange={(e) => update(i, { due_date: e.target.value || null })}
                />
                <button
                  type="button"
                  onClick={() =>
                    update(i, { priority: item.priority === "urgent" ? "normal" : "urgent" })
                  }
                  className={`inline-flex min-h-11 shrink-0 items-center gap-1 rounded-md border px-2.5 font-display text-[11px] font-bold uppercase tracking-[0.1em] transition-colors ${
                    item.priority === "urgent"
                      ? "border-danger bg-danger/10 text-danger"
                      : "border-line bg-white text-ink-soft"
                  }`}
                >
                  <AlertTriangle size={13} />
                  Urgent
                </button>
              </div>
              <div>
                <select
                  aria-label={`Follow-up ${i + 1} assigned to`}
                  className="field"
                  value={item.assigned_to}
                  onChange={(e) => update(i, { assigned_to: e.target.value })}
                >
                  {options.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.id === selfId ? `${s.full_name} (me)` : s.full_name}
                    </option>
                  ))}
                </select>
                {aiSuggested && (
                  <p className="mt-1 flex items-center gap-1 text-[11px] text-ink-soft">
                    <Sparkles size={11} />
                    Heard in the note — change it if that&apos;s wrong.
                  </p>
                )}
              </div>
            </div>
          );
        })}

        <button type="button" onClick={add} className="btn-ghost w-full">
          <Plus size={16} />
          Add follow-up
        </button>
      </div>
    </div>
  );
}
