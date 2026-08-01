import type { JobStatus } from "@/lib/types";

const styles: Record<JobStatus, { label: string; className: string }> = {
  scheduled: { label: "Scheduled", className: "bg-denim/10 text-denim" },
  in_progress: { label: "In progress", className: "bg-gold/20 text-gold-deep" },
  completed: { label: "Completed", className: "bg-ok/10 text-ok" },
  canceled: { label: "Canceled", className: "bg-ink-soft/10 text-ink-soft" },
};

export function StatusBadge({ status }: { status: JobStatus }) {
  const s = styles[status];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 font-display text-xs font-semibold uppercase tracking-wider ${s.className}`}
    >
      {s.label}
    </span>
  );
}
