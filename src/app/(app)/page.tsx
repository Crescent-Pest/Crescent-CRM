import Link from "next/link";
import { AlertTriangle, CalendarClock } from "lucide-react";
import { QuickAdd } from "@/components/QuickAdd";
import { createClient } from "@/lib/supabase/server";
import {
  fetchJobsBetween,
  fetchOverdueJobs,
  fetchPlansNeedingScheduling,
  type JobRow,
  type PlanNeedingScheduling,
} from "@/lib/queries";
import { addDaysISO, formatDate, formatLongDate, formatWindow, todayISO } from "@/lib/format";
import { scheduleNextForPlan } from "@/lib/actions/plans";
import { customerName } from "@/lib/types";
import { StatusBadge } from "@/components/StatusBadge";
import { frequencyLabel } from "./customers/planFrequency";

function JobLine({ job, showDate = false }: { job: JobRow; showDate?: boolean }) {
  const cust = job.property?.customer;
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-line px-4 py-3 last:border-b-0">
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">
          {job.title}
          {cust && (
            <span className="font-normal text-ink-soft"> · {customerName(cust)}</span>
          )}
        </p>
        <p className="truncate text-sm text-ink-soft">
          {job.property ? `${job.property.address_line1}, ${job.property.city}` : "—"}
          {job.assigned && ` · ${job.assigned.full_name}`}
        </p>
      </div>
      <span className="text-sm text-ink-soft">
        {showDate && `${formatDate(job.scheduled_date)} · `}
        {formatWindow(job.window_start, job.window_end)}
      </span>
      <StatusBadge status={job.status} />
    </li>
  );
}

function PlanLine({ plan }: { plan: PlanNeedingScheduling }) {
  const cust = plan.property?.customer;
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line px-4 py-3 last:border-b-0">
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">
          {plan.name}
          {cust && (
            <span className="font-normal text-ink-soft"> · {customerName(cust)}</span>
          )}
        </p>
        <p className="truncate text-sm text-ink-soft">
          {plan.property
            ? `${plan.property.address_line1}, ${plan.property.city}`
            : "—"}
          {` · ${frequencyLabel[plan.frequency] ?? plan.frequency}`}
        </p>
      </div>
      <span className="text-sm text-ink-soft">
        {plan.lastVisit ? `Last visit ${formatDate(plan.lastVisit)}` : "Never serviced"}
      </span>
      <form action={scheduleNextForPlan}>
        <input type="hidden" name="plan_id" value={plan.id} />
        <button type="submit" className="btn-ghost">
          Schedule next
        </button>
      </form>
    </li>
  );
}

export default async function DashboardPage() {
  const today = todayISO();
  const supabase = await createClient();

  const [todayJobs, weekJobs, overdue, unscheduledPlans, customerCount] = await Promise.all([
    fetchJobsBetween(today, today),
    fetchJobsBetween(addDaysISO(today, 1), addDaysISO(today, 7)),
    fetchOverdueJobs(today),
    fetchPlansNeedingScheduling(today),
    supabase
      .from("customers")
      .select("id", { count: "exact", head: true })
      .eq("status", "active")
      .then(({ count }) => count ?? 0),
  ]);

  const stats = [
    { label: "Jobs today", value: todayJobs.filter((j) => j.status !== "canceled").length },
    { label: "Next 7 days", value: weekJobs.filter((j) => j.status === "scheduled").length },
    { label: "Overdue", value: overdue.length, alert: overdue.length > 0 },
    { label: "Active customers", value: customerCount },
  ];

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold uppercase tracking-wide text-denim-ink md:text-4xl">
            Dispatch Board
          </h1>
          <p className="mt-1 text-ink-soft">{formatLongDate(today)}</p>
        </div>
        <QuickAdd />
      </div>

      <div className="mt-4 grid grid-cols-4 gap-2 md:mt-6 md:gap-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className={`rounded-md border bg-card p-2 text-center md:rounded-lg md:p-4 md:text-left ${
              s.alert ? "border-danger/40" : "border-line"
            }`}
          >
            <p
              className={`font-display text-xl font-bold md:text-4xl ${
                s.alert ? "text-danger" : "text-denim"
              }`}
            >
              {s.value}
            </p>
            <p className="label mb-0 mt-0.5 text-[10px] leading-tight tracking-[0.08em] md:mt-1 md:text-xs md:tracking-[0.12em]">
              {s.label}
            </p>
          </div>
        ))}
      </div>

      {unscheduledPlans.length > 0 && (
        <section className="mt-6 md:mt-8">
          <h2 className="mb-2 flex items-center gap-2 font-display text-lg font-bold uppercase tracking-wide text-gold-deep">
            <CalendarClock size={18} /> Plans needing scheduling
          </h2>
          <ul className="rounded-lg border border-gold/60 bg-card">
            {unscheduledPlans.map((p) => (
              <PlanLine key={p.id} plan={p} />
            ))}
          </ul>
        </section>
      )}

      {overdue.length > 0 && (
        <section className="mt-6 md:mt-8">
          <h2 className="mb-2 flex items-center gap-2 font-display text-lg font-bold uppercase tracking-wide text-danger">
            <AlertTriangle size={18} /> Needs attention
          </h2>
          <ul className="rounded-lg border border-danger/40 bg-card">
            {overdue.map((j) => (
              <JobLine key={j.id} job={j} showDate />
            ))}
          </ul>
        </section>
      )}

      <section className="mt-6 md:mt-8">
        <h2 className="mb-2 font-display text-lg font-bold uppercase tracking-wide text-denim-ink">
          Today&apos;s run
        </h2>
        {todayJobs.length === 0 ? (
          <p className="rounded-lg border border-dashed border-line bg-card px-4 py-8 text-center text-ink-soft">
            Nothing on the board today.
          </p>
        ) : (
          <ul className="rounded-lg border border-line bg-card">
            {todayJobs.map((j) => (
              <JobLine key={j.id} job={j} />
            ))}
          </ul>
        )}
      </section>

      <section className="mt-6 md:mt-8">
        <h2 className="mb-2 font-display text-lg font-bold uppercase tracking-wide text-denim-ink">
          Coming up
        </h2>
        {weekJobs.length === 0 ? (
          <p className="rounded-lg border border-dashed border-line bg-card px-4 py-8 text-center text-ink-soft">
            No jobs scheduled in the next 7 days.{" "}
            <Link href="/schedule/new" className="font-semibold text-denim underline">
              Schedule one
            </Link>
            .
          </p>
        ) : (
          <ul className="rounded-lg border border-line bg-card">
            {weekJobs.slice(0, 8).map((j) => (
              <JobLine key={j.id} job={j} showDate />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
