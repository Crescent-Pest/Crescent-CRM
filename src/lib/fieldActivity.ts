import { createClient } from "@/lib/supabase/server";
import type { ActionItem, Customer, Inspection, VisitNote } from "@/lib/types";

/**
 * Read queries for the tables the Crescent Inspect app writes
 * (inspections, visit_notes, action_items). The CRM only displays them —
 * creation happens in Inspect.
 */

/** Display labels for Inspect's pest catalog slugs (see that repo's src/lib/pests.ts). */
const PEST_LABELS: Record<string, string> = {
  "german-cockroach": "German Cockroach",
  "american-cockroach": "American Cockroach",
  "subterranean-termite": "Subterranean Termite",
  ants: "Ants",
  "rodents-mice": "Mice",
  "rodents-rats": "Rats",
  spiders: "Spiders",
  "bed-bugs": "Bed Bugs",
};

/** Slug -> display name, falling back to title-cased words for unknown slugs. */
export function pestLabel(slug: string) {
  return (
    PEST_LABELS[slug] ??
    slug
      .split("-")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ")
  );
}

const PHOTO_URL_TTL_SECONDS = 60 * 60;
const ACTIVITY_LIMIT = 10;

export interface InspectionActivity extends Inspection {
  tech: { full_name: string } | null;
  /** short-lived signed URL into the private inspection-photos bucket */
  photoUrl: string | null;
}

export interface VisitNoteActivity extends VisitNote {
  tech: { full_name: string } | null;
  action_items: Pick<
    ActionItem,
    "id" | "description" | "due_date" | "priority" | "status"
  >[];
}

type InspectionRow = Inspection & { tech: { full_name: string } | null };

/**
 * A customer's recent inspections (with signed photo URLs) and visit notes
 * (with their follow-up items). Errors degrade to empty lists so this bonus
 * panel can never take the customer page down.
 */
export async function fetchCustomerFieldActivity(customerId: string) {
  const supabase = await createClient();

  const [inspectionsRes, notesRes] = await Promise.all([
    supabase
      .from("inspections")
      .select("*, tech:profiles(full_name)")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false })
      .limit(ACTIVITY_LIMIT),
    supabase
      .from("visit_notes")
      .select(
        "*, tech:profiles(full_name), action_items(id, description, due_date, priority, status)",
      )
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false })
      .limit(ACTIVITY_LIMIT),
  ]);
  if (inspectionsRes.error) {
    console.error("field activity: inspections failed:", inspectionsRes.error.message);
  }
  if (notesRes.error) {
    console.error("field activity: visit notes failed:", notesRes.error.message);
  }

  const rows = (inspectionsRes.data ?? []) as unknown as InspectionRow[];
  const visitNotes = (notesRes.data ?? []) as unknown as VisitNoteActivity[];

  // one batched signed-URL call for every photo in the list
  const paths = rows
    .map((r) => r.photo_path)
    .filter((p): p is string => Boolean(p));
  const urlByPath = new Map<string, string>();
  if (paths.length > 0) {
    const { data: signed, error } = await supabase.storage
      .from("inspection-photos")
      .createSignedUrls(paths, PHOTO_URL_TTL_SECONDS);
    if (error) console.error("field activity: signing photo URLs failed:", error.message);
    for (const s of signed ?? []) {
      if (s.path && s.signedUrl) urlByPath.set(s.path, s.signedUrl);
    }
  }

  const inspections = rows.map<InspectionActivity>((r) => ({
    ...r,
    photoUrl: r.photo_path ? (urlByPath.get(r.photo_path) ?? null) : null,
  }));

  return { inspections, visitNotes };
}

/** Action item with its creator (tech), its assignee, and (via its visit note)
 * customer context joined in */
export interface FollowupRow extends ActionItem {
  tech: { full_name: string } | null;
  /** undefined on a pre-009 database, where the creator is the de facto owner */
  assignee?: { full_name: string } | null;
  visit_note: {
    id: string;
    customer: Pick<
      Customer,
      "id" | "type" | "first_name" | "last_name" | "company_name"
    > | null;
  } | null;
}

const VISIT_NOTE_SELECT = `visit_note:visit_notes(id,
    customer:customers(id, type, first_name, last_name, company_name))`;

// Two FKs point at profiles once 009 lands, so both embeds need a column hint.
const FOLLOWUP_SELECT = `*,
  tech:profiles!tech_id(full_name),
  assignee:profiles!assigned_to(full_name),
  ${VISIT_NOTE_SELECT}`;

// Pre-009 shape: no assigned_to column, so profiles embeds unambiguously.
const LEGACY_FOLLOWUP_SELECT = `*,
  tech:profiles(full_name),
  ${VISIT_NOTE_SELECT}`;

/** "Done recently" horizon — anything checked off in the last week still shows. */
const DONE_WINDOW_DAYS = 7;
const FOLLOWUP_LIMIT = 200;

/** All open follow-ups plus recently done ones, optionally scoped to the staff
 * member they're assigned to. Until migration 009 is applied the assignment
 * query errors, so this falls back to the creator-keyed view. */
export async function fetchFollowups(assigneeId?: string | null) {
  const supabase = await createClient();
  const cutoff = new Date(
    Date.now() - DONE_WINDOW_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  function buildQuery(select: string, filterColumn: "assigned_to" | "tech_id") {
    const query = supabase
      .from("action_items")
      .select(select)
      .or(`status.eq.open,done_at.gte.${cutoff}`)
      .order("due_date", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(FOLLOWUP_LIMIT);
    return assigneeId ? query.eq(filterColumn, assigneeId) : query;
  }

  const { data, error } = await buildQuery(FOLLOWUP_SELECT, "assigned_to");
  if (!error) return (data ?? []) as unknown as FollowupRow[];

  console.error(
    "follow-ups: assignment query failed (apply migration 009_assignments.sql), falling back to tech_id:",
    error.message,
  );
  const legacy = await buildQuery(LEGACY_FOLLOWUP_SELECT, "tech_id");
  if (legacy.error) {
    throw new Error(`Failed to load follow-ups: ${legacy.error.message}`);
  }
  return (legacy.data ?? []) as unknown as FollowupRow[];
}

/** Open/overdue follow-up counts for the dashboard summary. Errors degrade to zero. */
export async function fetchFollowupCounts(today: string) {
  const supabase = await createClient();
  const [open, overdue] = await Promise.all([
    supabase
      .from("action_items")
      .select("id", { count: "exact", head: true })
      .eq("status", "open")
      .then(({ count }) => count ?? 0),
    supabase
      .from("action_items")
      .select("id", { count: "exact", head: true })
      .eq("status", "open")
      .lt("due_date", today)
      .then(({ count }) => count ?? 0),
  ]);
  return { open, overdue };
}
