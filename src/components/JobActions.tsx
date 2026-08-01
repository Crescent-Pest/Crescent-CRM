import Link from "next/link";
import { Check, Pencil } from "lucide-react";
import { setJobStatus } from "@/lib/actions/jobs";
import type { JobStatus } from "@/lib/types";

/** One-tap transitions. "complete" is handled separately so notes can be attached. */
const quickActions: Record<JobStatus, { action: string; label: string }[]> = {
  scheduled: [
    { action: "start", label: "Start" },
    { action: "cancel", label: "Cancel" },
  ],
  in_progress: [{ action: "cancel", label: "Cancel" }],
  completed: [{ action: "reopen", label: "Reopen" }],
  canceled: [{ action: "reopen", label: "Reschedule" }],
};

const completable: JobStatus[] = ["scheduled", "in_progress"];

export function JobActions({ id, status }: { id: string; status: JobStatus }) {
  return (
    <form action={setJobStatus}>
      <input type="hidden" name="id" value={id} />

      <div className="flex flex-wrap items-center gap-2">
        {completable.includes(status) && (
          <details className="disclosure">
            <summary>
              <Check size={16} strokeWidth={2.5} />
              Complete
            </summary>
            {/* fixed width keeps the textarea usable when the card sizes to its buttons */}
            <div className="mt-2 w-64 space-y-2 md:w-72">
              <label className="label mb-0" htmlFor={`completion-notes-${id}`}>
                Completion notes
              </label>
              <textarea
                id={`completion-notes-${id}`}
                name="completion_notes"
                rows={3}
                className="field"
                placeholder="What was treated, pests found, follow-up needed"
              />
              <button
                type="submit"
                name="action"
                value="complete"
                className="btn-primary min-h-11 w-full justify-center"
              >
                Confirm complete
              </button>
            </div>
          </details>
        )}
        {quickActions[status].map((b) => (
          <button
            key={b.action}
            type="submit"
            name="action"
            value={b.action}
            className="btn-ghost btn-tap"
          >
            {b.label}
          </button>
        ))}
        <Link href={`/jobs/${id}/edit`} className="btn-ghost btn-tap">
          <Pencil size={14} />
          Edit
        </Link>
      </div>
    </form>
  );
}
