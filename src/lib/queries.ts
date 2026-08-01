import { createClient } from "@/lib/supabase/server";
import type { Customer, Job, PlanFrequency } from "@/lib/types";

/** Job row with property, customer, and assigned-tech context joined in */
export interface JobRow extends Job {
  property: {
    id: string;
    address_line1: string;
    city: string;
    customer: Pick<
      Customer,
      "id" | "type" | "first_name" | "last_name" | "company_name"
    > | null;
  } | null;
  assigned: { full_name: string } | null;
}

const JOB_SELECT = `*,
  property:properties(id, address_line1, city,
    customer:customers(id, type, first_name, last_name, company_name)),
  assigned:profiles(full_name)`;

export async function fetchJobsBetween(fromDate: string, toDate: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("jobs")
    .select(JOB_SELECT)
    .gte("scheduled_date", fromDate)
    .lte("scheduled_date", toDate)
    .order("scheduled_date")
    .order("window_start", { nullsFirst: false });
  if (error) throw new Error(`Failed to load jobs: ${error.message}`);
  return (data ?? []) as unknown as JobRow[];
}

/** Jobs still marked scheduled with a date in the past — the "needs attention" list */
export async function fetchOverdueJobs(beforeDate: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("jobs")
    .select(JOB_SELECT)
    .lt("scheduled_date", beforeDate)
    .in("status", ["scheduled", "in_progress"])
    .order("scheduled_date");
  if (error) throw new Error(`Failed to load overdue jobs: ${error.message}`);
  return (data ?? []) as unknown as JobRow[];
}

/** JobRow plus the property detail a tech needs on site (full address, gate codes, pets) */
export interface RunSheetJobRow extends JobRow {
  property: {
    id: string;
    address_line1: string;
    address_line2: string | null;
    city: string;
    state: string;
    zip: string;
    access_notes: string | null;
    customer: Pick<
      Customer,
      "id" | "type" | "first_name" | "last_name" | "company_name"
    > | null;
  } | null;
}

const RUN_SHEET_SELECT = `*,
  property:properties(id, address_line1, address_line2, city, state, zip, access_notes,
    customer:customers(id, type, first_name, last_name, company_name, phone)),
  assigned:profiles(full_name)`;

/**
 * A day's run sheet: everything scheduled for `date` plus anything still open from
 * earlier days, oldest first then by time window. Pass `assignedTo` to scope to one tech.
 */
export async function fetchRunSheet(date: string, assignedTo?: string | null) {
  const supabase = await createClient();
  let query = supabase
    .from("jobs")
    .select(RUN_SHEET_SELECT)
    .or(
      `scheduled_date.eq.${date},and(scheduled_date.lt.${date},status.in.(scheduled,in_progress))`,
    )
    .order("scheduled_date")
    .order("window_start", { nullsFirst: false });

  if (assignedTo) query = query.eq("assigned_to", assignedTo);

  const { data, error } = await query;
  if (error) throw new Error(`Failed to load run sheet: ${error.message}`);
  return (data ?? []) as unknown as RunSheetJobRow[];
}

/** A recurring plan with no upcoming visit booked — the "schedule me" nudge list */
export interface PlanNeedingScheduling {
  id: string;
  name: string;
  frequency: PlanFrequency;
  property: {
    id: string;
    address_line1: string;
    city: string;
    customer: Pick<
      Customer,
      "id" | "type" | "first_name" | "last_name" | "company_name"
    > | null;
  } | null;
  lastVisit: string | null;
}

interface PlanScanRow {
  id: string;
  name: string;
  frequency: PlanFrequency;
  property: PlanNeedingScheduling["property"];
  jobs: { status: string; scheduled_date: string }[];
}

const PLAN_SCAN_SELECT = `id, name, frequency,
  property:properties(id, address_line1, city,
    customer:customers(id, type, first_name, last_name, company_name)),
  jobs(status, scheduled_date)`;

// scan a bounded slice of plans, surface at most a screenful of gaps
const PLAN_SCAN_LIMIT = 200;
const PLAN_RESULT_LIMIT = 50;

/**
 * Active recurring plans with no scheduled/in-progress job dated today or later.
 * PostgREST can't express NOT EXISTS, so each plan's jobs come along on the
 * nested select and the gap check happens here.
 */
export async function fetchPlansNeedingScheduling(today: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("service_plans")
    .select(PLAN_SCAN_SELECT)
    .eq("active", true)
    .neq("frequency", "one_time")
    .order("start_date")
    .limit(PLAN_SCAN_LIMIT);
  if (error) throw new Error(`Failed to load service plans: ${error.message}`);

  const plans = (data ?? []) as unknown as PlanScanRow[];

  return plans
    .filter(
      (p) =>
        !p.jobs.some(
          (j) =>
            (j.status === "scheduled" || j.status === "in_progress") &&
            j.scheduled_date >= today,
        ),
    )
    .map<PlanNeedingScheduling>((p) => ({
      id: p.id,
      name: p.name,
      frequency: p.frequency,
      property: p.property,
      lastVisit:
        p.jobs
          .filter((j) => j.status === "completed")
          .reduce<string | null>(
            (latest, j) =>
              latest && latest > j.scheduled_date ? latest : j.scheduled_date,
            null,
          ) ?? null,
    }))
    // longest-neglected first; never-visited plans sort to the top
    .sort((a, b) => (a.lastVisit ?? "").localeCompare(b.lastVisit ?? ""))
    .slice(0, PLAN_RESULT_LIMIT);
}
