import Link from "next/link";
import { MapPin } from "lucide-react";
import { setJobStatus } from "@/lib/actions/jobs";
import { formatWindow } from "@/lib/format";
import { customerName } from "@/lib/types";
import type { JobRow } from "@/lib/queries";
import { StatusBadge } from "@/components/StatusBadge";

const actionButtons: Record<string, { action: string; label: string }[]> = {
  scheduled: [
    { action: "start", label: "Start" },
    { action: "complete", label: "Complete" },
    { action: "cancel", label: "Cancel" },
  ],
  in_progress: [
    { action: "complete", label: "Complete" },
    { action: "cancel", label: "Cancel" },
  ],
  completed: [{ action: "reopen", label: "Reopen" }],
  canceled: [{ action: "reopen", label: "Reschedule" }],
};

export function JobCard({ job }: { job: JobRow }) {
  const cust = job.property?.customer;

  return (
    <div className="rounded-lg border border-line bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold">
            {job.title}
            {cust && (
              <Link
                href={`/customers/${cust.id}`}
                className="ml-2 font-normal text-denim hover:underline"
              >
                {customerName(cust)}
              </Link>
            )}
          </p>
          <p className="mt-0.5 flex items-center gap-1.5 text-sm text-ink-soft">
            <MapPin size={13} className="shrink-0 text-gold-deep" />
            {job.property
              ? `${job.property.address_line1}, ${job.property.city}`
              : "No address"}
          </p>
        </div>
        <StatusBadge status={job.status} />
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
        <p className="text-sm text-ink-soft">
          {formatWindow(job.window_start, job.window_end)}
          <span className="mx-1.5">·</span>
          {job.assigned ? job.assigned.full_name : "Unassigned"}
        </p>
        <form action={setJobStatus} className="flex gap-2">
          <input type="hidden" name="id" value={job.id} />
          {(actionButtons[job.status] ?? []).map((b) => (
            <button
              key={b.action}
              type="submit"
              name="action"
              value={b.action}
              className="btn-ghost px-2.5 py-1 text-xs"
            >
              {b.label}
            </button>
          ))}
        </form>
      </div>

      {job.completion_notes && (
        <p className="mt-2 text-sm text-ink-soft">Notes: {job.completion_notes}</p>
      )}
    </div>
  );
}
