export type StaffRole = "admin" | "office" | "tech";
export type CustomerType = "residential" | "commercial";
export type CustomerStatus = "active" | "inactive";
export type PlanFrequency =
  | "one_time"
  | "monthly"
  | "bimonthly"
  | "quarterly"
  | "semiannual"
  | "annual";
export type JobStatus = "scheduled" | "in_progress" | "completed" | "canceled";

export interface Profile {
  id: string;
  full_name: string;
  role: StaffRole;
  phone: string | null;
  active: boolean;
}

export interface Customer {
  id: string;
  type: CustomerType;
  status: CustomerStatus;
  first_name: string;
  last_name: string;
  company_name: string;
  email: string | null;
  phone: string | null;
  phone_alt: string | null;
  source: string | null;
  created_at: string;
}

export interface Property {
  id: string;
  customer_id: string;
  label: string;
  address_line1: string;
  address_line2: string | null;
  city: string;
  state: string;
  zip: string;
  access_notes: string | null;
  active: boolean;
}

export interface ServicePlan {
  id: string;
  property_id: string;
  name: string;
  frequency: PlanFrequency;
  price_cents: number;
  start_date: string;
  active: boolean;
  notes: string | null;
}

export interface Job {
  id: string;
  property_id: string;
  service_plan_id: string | null;
  assigned_to: string | null;
  title: string;
  scheduled_date: string;
  window_start: string | null;
  window_end: string | null;
  status: JobStatus;
  completion_notes: string | null;
  completed_at: string | null;
}

export interface CustomerNote {
  id: string;
  customer_id: string;
  author_id: string | null;
  body: string;
  created_at: string;
}

/** Display name for a customer regardless of type */
export function customerName(c: Pick<Customer, "type" | "first_name" | "last_name" | "company_name">) {
  return c.type === "commercial"
    ? c.company_name
    : `${c.first_name} ${c.last_name}`.trim();
}
