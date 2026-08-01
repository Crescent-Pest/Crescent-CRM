import { createClient } from "@/lib/supabase/server";
import type { Customer, Job } from "@/lib/types";

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
