import Link from "next/link";
import { AlertTriangle, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { fetchJobsBetween, fetchOverdueJobs, type JobRow } from "@/lib/queries";
import { addDaysISO, formatLongDate, todayISO } from "@/lib/format";
import { CustomerSearch } from "@/components/CustomerSearch";
import { JobCard } from "./JobCard";

const DAYS_SHOWN = 7;

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const { from } = await searchParams;
  const today = todayISO();
  const start = /^\d{4}-\d{2}-\d{2}$/.test(from ?? "") ? from! : today;
  const end = addDaysISO(start, DAYS_SHOWN - 1);

  const [jobs, overdue] = await Promise.all([
    fetchJobsBetween(start, end),
    start === today ? fetchOverdueJobs(today) : Promise.resolve([] as JobRow[]),
  ]);

  const byDate = new Map<string, JobRow[]>();
  for (const job of jobs) {
    const list = byDate.get(job.scheduled_date) ?? [];
    list.push(job);
    byDate.set(job.scheduled_date, list);
  }
  const days = Array.from({ length: DAYS_SHOWN }, (_, i) => addDaysISO(start, i));

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-display text-3xl font-bold uppercase tracking-wide text-denim-ink md:text-4xl">
          Schedule
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <CustomerSearch />
          <Link
            href={`/schedule?from=${addDaysISO(start, -DAYS_SHOWN)}`}
            aria-label="Previous week"
            className="btn-ghost min-h-11 min-w-11 justify-center px-2 md:min-h-0 md:min-w-0"
          >
            <ChevronLeft size={16} />
          </Link>
          {start !== today && (
            <Link href="/schedule" className="btn-ghost">
              Today
            </Link>
          )}
          <Link
            href={`/schedule?from=${addDaysISO(start, DAYS_SHOWN)}`}
            aria-label="Next week"
            className="btn-ghost min-h-11 min-w-11 justify-center px-2 md:min-h-0 md:min-w-0"
          >
            <ChevronRight size={16} />
          </Link>
          <Link href="/schedule/new" className="btn-primary">
            <Plus size={16} /> New job
          </Link>
        </div>
      </div>

      {overdue.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 flex items-center gap-2 font-display text-lg font-bold uppercase tracking-wide text-danger">
            <AlertTriangle size={18} /> Overdue
          </h2>
          <div className="space-y-3">
            {overdue.map((j) => (
              <JobCard key={j.id} job={j} />
            ))}
          </div>
        </section>
      )}

      <div className="mt-6 space-y-8">
        {days.map((date) => {
          const dayJobs = byDate.get(date) ?? [];
          return (
            <section key={date}>
              <h2
                className={`mb-2 border-b-2 pb-1 font-display text-lg font-bold uppercase tracking-wide ${
                  date === today
                    ? "border-gold text-denim-ink"
                    : "border-line text-ink-soft"
                }`}
              >
                {formatLongDate(date)}
                {date === today && (
                  <span className="ml-2 text-sm font-semibold text-gold-deep">Today</span>
                )}
              </h2>
              {dayJobs.length === 0 ? (
                <p className="py-1 text-sm text-ink-soft/70">No jobs.</p>
              ) : (
                <div className="space-y-3">
                  {dayJobs.map((j) => (
                    <JobCard key={j.id} job={j} />
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
