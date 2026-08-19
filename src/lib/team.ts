import { createClient } from "@/lib/supabase/server";
import type {
  ActionItemPriority,
  Customer,
  Profile,
  StructuredNote,
} from "@/lib/types";

/**
 * Reads for /team — the management view of what the crew owes and what the
 * field just logged. Ownership lives on action_items.assigned_to; until that
 * column exists the reads fall back to tech_id (see fetchOpenFollowups).
 */

type CustomerRef = Pick<
  Customer,
  "id" | "type" | "first_name" | "last_name" | "company_name"
>;

/** One open follow-up, flattened for display (names already resolved). */
export interface TeamFollowup {
  id: string;
  description: string;
  due_date: string | null;
  priority: ActionItemPriority;
  customer: CustomerRef | null;
  /** name of whoever logged it, only when that isn't the owner */
  fromName: string | null;
}

/** Open follow-ups for one owner; `id` is null for the unassigned bucket. */
export interface AssigneeGroup {
  id: string | null;
  name: string;
  overdue: number;
  items: TeamFollowup[];
}

export interface WorkloadChip {
  id: string;
  name: string;
  open: number;
  overdue: number;
}

export interface RecentNote {
  id: string;
  created_at: string;
  techName: string | null;
  customer: CustomerRef | null;
  summary: string;
}

export interface TeamOverview {
  /** false when action_items.assigned_to is missing — grouping used tech_id */
  assignmentsEnabled: boolean;
  workload: WorkloadChip[];
  groups: AssigneeGroup[];
  recentNotes: RecentNote[];
  openCount: number;
  overdueCount: number;
}

const OPEN_LIMIT = 300;
const RECENT_NOTE_LIMIT = 15;

const FOLLOWUP_COLUMNS = `id, created_at, description, due_date, priority, tech_id,
  visit_note:visit_notes(id,
    customer:customers(id, type, first_name, last_name, company_name))`;
const FOLLOWUP_COLUMNS_ASSIGNED = `assigned_to, ${FOLLOWUP_COLUMNS}`;

const NOTE_COLUMNS = `id, created_at, summary, structured,
  tech:profiles(full_name),
  customer:customers(id, type, first_name, last_name, company_name)`;

interface FollowupSourceRow {
  id: string;
  description: string;
  due_date: string | null;
  priority: ActionItemPriority;
  tech_id: string | null;
  assigned_to?: string | null;
  visit_note: { id: string; customer: CustomerRef | null } | null;
}

interface NoteSourceRow {
  id: string;
  created_at: string;
  summary: string | null;
  structured: StructuredNote | null;
  tech: { full_name: string } | null;
  customer: CustomerRef | null;
}

/**
 * PostgREST codes that mean "assigned_to isn't there yet": 42703 is Postgres'
 * undefined column, PGRST200 a missing embed relationship.
 */
const MISSING_ASSIGNED_TO_CODES = new Set(["42703", "PGRST200", "PGRST204"]);

/** Every open follow-up, preferring assigned_to and degrading to tech_id. */
async function fetchOpenFollowups() {
  const supabase = await createClient();
  const query = (columns: string) =>
    supabase
      .from("action_items")
      .select(columns)
      .eq("status", "open")
      .order("due_date", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(OPEN_LIMIT);

  let assignmentsEnabled = true;
  let { data, error } = await query(FOLLOWUP_COLUMNS_ASSIGNED);
  if (error && MISSING_ASSIGNED_TO_CODES.has(error.code)) {
    assignmentsEnabled = false;
    ({ data, error } = await query(FOLLOWUP_COLUMNS));
  }
  if (error) throw new Error(`Failed to load follow-ups: ${error.message}`);

  return {
    assignmentsEnabled,
    rows: (data ?? []) as unknown as FollowupSourceRow[],
  };
}

/** Newest visit notes across the team. Errors degrade to an empty list. */
async function fetchRecentNotes() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("visit_notes")
    .select(NOTE_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(RECENT_NOTE_LIMIT);
  if (error) console.error("team: recent visit notes failed:", error.message);
  return (data ?? []) as unknown as NoteSourceRow[];
}

/** The whole roster — active staff drive the workload strip, the rest still
 *  need names so follow-ups logged by since-deactivated techs read right. */
async function fetchRoster() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, active")
    .order("full_name");
  if (error) throw new Error(`Failed to load staff: ${error.message}`);
  return (data ?? []) as Pick<Profile, "id" | "full_name" | "active">[];
}

/** Overdue first, then soonest due; undated items sink to the bottom. */
function byDueDate(a: TeamFollowup, b: TeamFollowup) {
  if (a.due_date === b.due_date) return 0;
  if (a.due_date === null) return 1;
  if (b.due_date === null) return -1;
  return a.due_date.localeCompare(b.due_date);
}

export async function fetchTeamOverview(today: string): Promise<TeamOverview> {
  const [roster, { assignmentsEnabled, rows }, noteRows] = await Promise.all([
    fetchRoster(),
    fetchOpenFollowups(),
    fetchRecentNotes(),
  ]);

  const nameById = new Map(roster.map((p) => [p.id, p.full_name]));

  const groupById = new Map<string | null, AssigneeGroup>();
  let overdueCount = 0;

  for (const row of rows) {
    const ownerId = row.assigned_to ?? row.tech_id;
    const creatorId = row.tech_id;
    const overdue = row.due_date !== null && row.due_date < today;
    if (overdue) overdueCount += 1;

    let group = groupById.get(ownerId);
    if (!group) {
      group = {
        id: ownerId,
        name: (ownerId && nameById.get(ownerId)) || "Unassigned",
        overdue: 0,
        items: [],
      };
      groupById.set(ownerId, group);
    }
    if (overdue) group.overdue += 1;
    group.items.push({
      id: row.id,
      description: row.description,
      due_date: row.due_date,
      priority: row.priority,
      customer: row.visit_note?.customer ?? null,
      fromName:
        creatorId && creatorId !== ownerId
          ? (nameById.get(creatorId) ?? null)
          : null,
    });
  }

  const groups = [...groupById.values()]
    .map((g) => ({ ...g, items: [...g.items].sort(byDueDate) }))
    // busiest desks first, unassigned work last so it can't hide at the top
    .sort((a, b) => {
      if ((a.id === null) !== (b.id === null)) return a.id === null ? 1 : -1;
      if (a.overdue !== b.overdue) return b.overdue - a.overdue;
      if (a.items.length !== b.items.length) return b.items.length - a.items.length;
      return a.name.localeCompare(b.name);
    });

  const workload = roster
    .filter((p) => p.active)
    .map<WorkloadChip>((p) => {
      const group = groupById.get(p.id);
      return {
        id: p.id,
        name: p.full_name,
        open: group?.items.length ?? 0,
        overdue: group?.overdue ?? 0,
      };
    })
    .sort((a, b) => b.overdue - a.overdue || b.open - a.open || a.name.localeCompare(b.name));

  const recentNotes = noteRows.map<RecentNote>((n) => ({
    id: n.id,
    created_at: n.created_at,
    techName: n.tech?.full_name ?? null,
    customer: n.customer,
    summary:
      n.summary || n.structured?.summary || "Voice note (no summary)",
  }));

  return {
    assignmentsEnabled,
    workload,
    groups,
    recentNotes,
    openCount: rows.length,
    overdueCount,
  };
}
