"use client";

import { AlertTriangle, Plus, Trash2 } from "lucide-react";
import type { StructuredActionItem, StructuredNote } from "@/lib/types";

/**
 * Review step after Claude structures the note. The AI result is advisory —
 * the tech edits/deletes action items inline before anything is saved.
 */
export function StructuredReview({
  structured,
  items,
  onItemsChange,
}: {
  structured: StructuredNote;
  items: StructuredActionItem[];
  onItemsChange: (items: StructuredActionItem[]) => void;
}) {
  function update(index: number, patch: Partial<StructuredActionItem>) {
    onItemsChange(items.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  }

  function remove(index: number) {
    onItemsChange(items.filter((_, i) => i !== index));
  }

  function add() {
    onItemsChange([...items, { description: "", due_date: null, priority: "normal" }]);
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

        {items.map((item, i) => (
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
          </div>
        ))}

        <button type="button" onClick={add} className="btn-ghost w-full">
          <Plus size={16} />
          Add follow-up
        </button>
      </div>
    </div>
  );
}
