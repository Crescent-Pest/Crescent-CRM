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
  /** FieldRoutes customerID, set by the importer or the outbox worker's first create */
  fieldroutes_id: number | null;
  billing_address_line1: string | null;
  billing_city: string | null;
  billing_state: string | null;
  billing_zip: string | null;
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

// ---------- FieldRoutes outbox (see supabase/migrations/007_fieldroutes_sync.sql) ----------

export type SyncEntity = "customer";
export type SyncAction = "create" | "update";
export type SyncStatus = "pending" | "synced" | "failed" | "skipped";

/** One "this entity changed, push it" signal. The worker re-reads the row at
 *  sync time, so changed_fields is audit trail rather than the payload. */
export interface SyncQueueRow {
  id: string;
  created_at: string;
  entity: SyncEntity;
  entity_id: string;
  fr_action: SyncAction;
  changed_fields: Record<string, unknown> | null;
  status: SyncStatus;
  attempts: number;
  last_error: string | null;
  synced_at: string | null;
}

// ---------- Field activity (inspections + voice notes, formerly the Crescent-Inspect app) ----------

export type InspectionStatus = "draft" | "presented" | "sold";
export type ActionItemPriority = "normal" | "urgent";
export type ActionItemStatus = "open" | "done";

/** One ranked pest guess from Inspect's AI identify step. Advisory only. */
export interface PestCandidate {
  common_name: string;
  scientific_name: string;
  /** 0–1 */
  confidence: number;
  evidence: string[];
}

/** Result of /api/identify. Advisory until the tech confirms a pest. */
export interface IdentifyResult {
  candidates: PestCandidate[];
  photo_quality_note: string;
}

export interface EstimateBreakdown {
  lines: { label: string; amount_cents: number }[];
  recurring_cents: number;
  demo: boolean;
  sqft: number | null;
}

export interface Inspection {
  id: string;
  created_at: string;
  tech_id: string | null;
  customer_id: string | null;
  property_id: string | null;
  /** object path in the private inspection-photos storage bucket */
  photo_path: string | null;
  /** pest catalog slug confirmed by the tech */
  pest_confirmed: string | null;
  pest_candidates: PestCandidate[] | null;
  confidence: number | null;
  /** AI-generated treatment plan (markdown) */
  plan_md: string | null;
  estimate_cents: number | null;
  estimate_breakdown: EstimateBreakdown | null;
  status: InspectionStatus;
  notes: string | null;
}

/** One follow-up task extracted by the AI from a voice note. The tech edits
 * these on the review screen before anything is saved. */
export interface StructuredActionItem {
  description: string;
  /** ISO date (YYYY-MM-DD) or null when no timing was mentioned */
  due_date: string | null;
  priority: ActionItemPriority;
  /** Staff member the AI heard the task directed at — an exact full_name from
   * the active roster, or null. Advisory: the tech confirms it before saving. */
  assignee_name?: string | null;
}

/** A follow-up after the tech reviewed it: the AI fields plus the profile id
 * of whoever has to do the work (defaults to the tech recording the note). */
export interface ReviewedActionItem extends StructuredActionItem {
  assigned_to: string;
}

/** AI-structured content of a visit note, reviewed by the tech before saving. */
export interface StructuredNote {
  summary: string;
  customer_commitments: string[];
  action_items: StructuredActionItem[];
  mentioned_customer: string | null;
  /** customer name the tech typed on the review screen, if any */
  customer_name?: string | null;
}

export interface VisitNote {
  id: string;
  created_at: string;
  tech_id: string | null;
  customer_id: string | null;
  inspection_id: string | null;
  /** object path in the private voice-notes storage bucket (null for dictated notes) */
  audio_path: string | null;
  transcript: string | null;
  summary: string | null;
  structured: StructuredNote | null;
}

export interface ActionItem {
  id: string;
  created_at: string;
  visit_note_id: string | null;
  tech_id: string | null;
  assigned_to: string | null;
  description: string;
  due_date: string | null;
  priority: ActionItemPriority;
  status: ActionItemStatus;
  done_at: string | null;
}

// ---------- Ops manual (procedures, chemicals, and field suggestions) ----------

export type StepKind = "step" | "warning" | "tip";
export type Repellency = "repellent" | "non-repellent" | "n/a";
export type SuggestionStatus = "open" | "accepted" | "rejected";

/** Manual content uses text ids so data/procedures-seed.json and Postgres match. */
export interface Procedure {
  id: string;
  slug: string;
  title: string;
  summary: string;
  category: string;
  /** e.g. "4x per year"; null means as-needed */
  frequency: string | null;
  sort: number;
  /** ISO date */
  updated_at: string;
}

export interface ProcedureSection {
  id: string;
  procedure_id: string;
  title: string;
  position: number;
}

export interface ProcedureStep {
  id: string;
  section_id: string;
  content: string;
  kind: StepKind;
  /** 0 or 1 — a nested bullet under the step above it */
  indent: number;
  position: number;
  /** chemicals named in this step */
  chemical_ids: string[];
}

export interface MixRatio {
  /** e.g. "Exterior perimeter", "Accusprayer (16 oz)" */
  context: string;
  /** e.g. "0.8 fl oz / 1 gal water" */
  ratio: string;
}

export interface Chemical {
  id: string;
  name: string;
  epa_number: string | null;
  category: string;
  repellency: Repellency;
  mix_ratios: MixRatio[];
  /** label restrictions and usage guidance, including flagged discrepancies */
  notes: string | null;
}

/** A proposed replacement for one step's text. Accepting it applies the edit. */
export interface StepSuggestion {
  id: string;
  created_at: string;
  step_id: string;
  author_id: string;
  proposed_content: string;
  reason: string | null;
  status: SuggestionStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
}
