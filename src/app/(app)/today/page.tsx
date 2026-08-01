import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { fetchRunSheet } from "@/lib/queries";
import { formatLongDate, todayISO } from "@/lib/format";
import { RunSheetCard } from "@/components/RunSheetCard";
import { CustomerSearch } from "@/components/CustomerSearch";

function ViewToggle({ showAll }: { showAll: boolean }) {
  const base =
    "flex min-h-11 flex-1 items-center justify-center rounded px-4 font-display text-sm font-semibold uppercase tracking-[0.08em] transition-colors md:flex-none";
  const on = "bg-denim text-white";
  const off = "text-ink-soft hover:text-denim";

  return (
    <div className="flex gap-1 rounded-md border border-line bg-white p-1">
      <Link href="/today" className={`${base} ${showAll ? off : on}`}>
        Mine
      </Link>
      <Link href="/today?view=all" className={`${base} ${showAll ? on : off}`}>
        Everyone
      </Link>
    </div>
  );
}

export default async function TodayPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const { view } = await searchParams;
  const today = todayISO();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // falls back to the full board if there is somehow no session user to scope by
  const assignedTo = view === "all" ? null : (user?.id ?? null);
  const showAll = assignedTo === null;
  const jobs = await fetchRunSheet(today, assignedTo);

  const overdue = jobs.filter((j) => j.scheduled_date < today);
  const dueToday = jobs.filter((j) => j.scheduled_date === today);
  const remaining = jobs.filter(
    (j) => j.status === "scheduled" || j.status === "in_progress",
  ).length;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold uppercase tracking-wide text-denim-ink md:text-4xl">
            My Day
          </h1>
          <p className="mt-1 text-ink-soft">
            {formatLongDate(today)}
            <span className="mx-1.5">·</span>
            {remaining} {remaining === 1 ? "stop" : "stops"} left
          </p>
        </div>
        <CustomerSearch />
      </div>

      <div className="mt-4">
        <ViewToggle showAll={showAll} />
      </div>

      {jobs.length === 0 && (
        <div className="mt-6 rounded-lg border border-dashed border-line bg-card px-4 py-10 text-center">
          {showAll ? (
            <p className="text-ink-soft">
              Nothing on the board today.{" "}
              <Link
                href="/schedule/new"
                className="font-semibold text-denim underline"
              >
                Schedule a job
              </Link>
              .
            </p>
          ) : (
            <p className="text-ink-soft">
              No jobs assigned to you today. Enjoy the quiet, or{" "}
              <Link
                href="/today?view=all"
                className="font-semibold text-denim underline"
              >
                see everyone&apos;s run
              </Link>
              .
            </p>
          )}
        </div>
      )}

      {overdue.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 flex items-center gap-2 font-display text-lg font-bold uppercase tracking-wide text-danger">
            <AlertTriangle size={18} /> Still open
          </h2>
          <div className="space-y-3">
            {overdue.map((j) => (
              <RunSheetCard key={j.id} job={j} overdue />
            ))}
          </div>
        </section>
      )}

      {dueToday.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 border-b-2 border-gold pb-1 font-display text-lg font-bold uppercase tracking-wide text-denim-ink">
            Today&apos;s run
          </h2>
          <div className="space-y-3">
            {dueToday.map((j) => (
              <RunSheetCard key={j.id} job={j} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
