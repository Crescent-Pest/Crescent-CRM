import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { updateJob } from "@/lib/actions/jobs";
import {
  customerName,
  type Customer,
  type Job,
  type JobStatus,
  type Profile,
  type Property,
} from "@/lib/types";

interface JobWithContext extends Job {
  property:
    | (Property & {
        customer: Pick<
          Customer,
          "id" | "type" | "first_name" | "last_name" | "company_name"
        > | null;
      })
    | null;
}

const statusLabel: Record<JobStatus, string> = {
  scheduled: "Scheduled",
  in_progress: "In progress",
  completed: "Completed",
  canceled: "Canceled",
};

export default async function EditJobPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;

  const supabase = await createClient();
  const [{ data: jobData }, { data: techData }] = await Promise.all([
    supabase
      .from("jobs")
      .select(
        "*, property:properties(*, customer:customers(id, type, first_name, last_name, company_name))"
      )
      .eq("id", id)
      .maybeSingle(),
    supabase.from("profiles").select("*").eq("active", true).order("full_name"),
  ]);
  const job = jobData as unknown as JobWithContext | null;
  if (!job) notFound();
  const techs = (techData ?? []) as Profile[];

  const customer = job.property?.customer ?? null;
  const context = [
    customer ? customerName(customer) : null,
    job.property?.address_line1 ?? null,
  ]
    .filter(Boolean)
    .join(", ");

  const errorMessage: Record<string, string> = {
    missing: "Job title and date are required.",
    status: "Pick a valid job status.",
    notfound: "That job no longer exists.",
  };

  return (
    <div className="mx-auto max-w-xl">
      <Link
        href="/schedule"
        className="inline-flex items-center gap-1.5 text-sm text-ink-soft hover:text-denim"
      >
        <ArrowLeft size={14} /> Schedule
      </Link>
      <h1 className="mt-2 font-display text-4xl font-bold uppercase tracking-wide text-denim-ink">
        Edit job
      </h1>
      <p className="mt-1 text-ink-soft">
        {job.title}
        {context && ` — ${context}`}
      </p>

      {error && (
        <p className="mt-4 rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
          {errorMessage[error] ?? `Couldn't save: ${error}`}
        </p>
      )}

      <form action={updateJob} className="mt-6 space-y-4 rounded-lg border border-line bg-card p-6">
        <input type="hidden" name="id" value={job.id} />

        <div>
          <label htmlFor="title" className="label">Job title</label>
          <input id="title" name="title" required className="field" defaultValue={job.title} />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label htmlFor="scheduled_date" className="label">Date</label>
            <input
              id="scheduled_date"
              name="scheduled_date"
              type="date"
              required
              className="field"
              defaultValue={job.scheduled_date}
            />
          </div>
          <div>
            <label htmlFor="window_start" className="label">Window start</label>
            <input
              id="window_start"
              name="window_start"
              type="time"
              className="field"
              defaultValue={job.window_start?.slice(0, 5) ?? ""}
            />
          </div>
          <div>
            <label htmlFor="window_end" className="label">Window end</label>
            <input
              id="window_end"
              name="window_end"
              type="time"
              className="field"
              defaultValue={job.window_end?.slice(0, 5) ?? ""}
            />
          </div>
        </div>

        <div>
          <label htmlFor="assigned_to" className="label">Assign to</label>
          <select
            id="assigned_to"
            name="assigned_to"
            className="field"
            defaultValue={job.assigned_to ?? ""}
          >
            <option value="">Unassigned</option>
            {techs.map((t) => (
              <option key={t.id} value={t.id}>
                {t.full_name} ({t.role})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="status" className="label">Status</label>
          <select id="status" name="status" className="field" defaultValue={job.status}>
            {Object.entries(statusLabel).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex gap-2">
          <button type="submit" className="btn-primary">Save job</button>
          <Link href="/schedule" className="btn-ghost">Cancel</Link>
        </div>
      </form>
    </div>
  );
}
