import type { createClient } from "@/lib/supabase/server";
import { addMonthsISO, todayISO } from "@/lib/format";
import type { PlanFrequency } from "@/lib/types";

export type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/** Months between visits. One-time plans never generate a follow-up. */
export const intervalMonths: Record<PlanFrequency, number | null> = {
  one_time: null,
  monthly: 1,
  bimonthly: 2,
  quarterly: 3,
  semiannual: 6,
  annual: 12,
};

export type RecurrenceResult =
  | { status: "created"; date: string }
  | { status: "skipped"; reason: string };

function skip(reason: string): RecurrenceResult {
  return { status: "skipped", reason };
}

/** ISO dates sort lexicographically, so the later one is just the greater string */
export function laterOfISO(a: string, b: string) {
  return a > b ? a : b;
}

/**
 * Idempotency guard shared by both schedulers: a plan that already has an open
 * job dated today or later is covered, so re-completing (or reopening and
 * re-completing) a job must not stack up duplicates.
 */
export async function hasUpcomingJob(
  supabase: SupabaseServerClient,
  planId: string,
  onOrAfter: string,
) {
  const { data } = await supabase
    .from("jobs")
    .select("id")
    .eq("service_plan_id", planId)
    .in("status", ["scheduled", "in_progress"])
    .gte("scheduled_date", onOrAfter)
    .limit(1);
  return (data ?? []).length > 0;
}

interface CompletedJobRow {
  service_plan_id: string | null;
  property_id: string;
  title: string;
  scheduled_date: string;
  window_start: string | null;
  window_end: string | null;
  assigned_to: string | null;
}

interface PlanRow {
  id: string;
  frequency: PlanFrequency;
  active: boolean;
}

/**
 * Called after a job is marked completed: books the plan's next visit, carrying
 * over the same crew and arrival window. Never throws — recurrence failing must
 * not block the status change that triggered it.
 */
export async function maybeScheduleNext(
  supabase: SupabaseServerClient,
  jobId: string,
): Promise<RecurrenceResult> {
  const { data: job } = await supabase
    .from("jobs")
    .select(
      "service_plan_id, property_id, title, scheduled_date, window_start, window_end, assigned_to",
    )
    .eq("id", jobId)
    .single<CompletedJobRow>();

  if (!job) return skip("job not found");
  if (!job.service_plan_id) return skip("one-off job, no plan");

  const { data: plan } = await supabase
    .from("service_plans")
    .select("id, frequency, active")
    .eq("id", job.service_plan_id)
    .single<PlanRow>();

  if (!plan) return skip("plan not found");
  if (!plan.active) return skip("plan inactive");

  const months = intervalMonths[plan.frequency];
  if (!months) return skip("plan is one-time");

  const today = todayISO();
  if (await hasUpcomingJob(supabase, plan.id, today)) {
    return skip("plan already has an upcoming job");
  }

  // a long-overdue completion would otherwise land the next visit in the past
  const next = laterOfISO(addMonthsISO(job.scheduled_date, months), today);

  const { error } = await supabase.from("jobs").insert({
    property_id: job.property_id,
    service_plan_id: plan.id,
    title: job.title,
    scheduled_date: next,
    window_start: job.window_start,
    window_end: job.window_end,
    assigned_to: job.assigned_to,
    status: "scheduled",
  });

  if (error) return skip(`insert failed: ${error.message}`);
  return { status: "created", date: next };
}

/** One-line log string for either scheduler's outcome */
export function describeRecurrence(jobOrPlanId: string, result: RecurrenceResult) {
  return result.status === "created"
    ? `recurrence: ${jobOrPlanId} -> next visit ${result.date}`
    : `recurrence: ${jobOrPlanId} -> skipped (${result.reason})`;
}
