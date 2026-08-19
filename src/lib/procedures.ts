import { createClient } from "@/lib/supabase/server";
import type {
  Chemical,
  Procedure,
  ProcedureSection,
  ProcedureStep,
  StepSuggestion,
} from "@/lib/types";

/**
 * Read queries for the ops manual: procedures, their sections and steps, the
 * chemical cheat sheet, and the field suggestion queue. Content edits go
 * through src/lib/actions/procedures.ts.
 */

/** Is the signed-in user an admin? Admins edit content and review suggestions. */
export async function isAdminUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const { data } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  return data?.role === "admin";
}

export async function fetchProcedures() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("procedures")
    .select("*")
    .order("sort")
    .order("title");
  if (error) throw new Error(`Failed to load procedures: ${error.message}`);
  return (data ?? []) as Procedure[];
}

export interface ProcedureDetail {
  procedure: Procedure;
  sections: ProcedureSection[];
  steps: ProcedureStep[];
  /** only the chemicals referenced by a step in this procedure */
  chemicals: Chemical[];
}

/** A procedure with everything the detail page renders, or null if the slug is unknown. */
export async function fetchProcedureBySlug(
  slug: string,
): Promise<ProcedureDetail | null> {
  const supabase = await createClient();

  const { data: procedure, error } = await supabase
    .from("procedures")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(`Failed to load procedure: ${error.message}`);
  if (!procedure) return null;

  const { data: sectionData, error: sectionError } = await supabase
    .from("procedure_sections")
    .select("*")
    .eq("procedure_id", procedure.id)
    .order("position");
  if (sectionError) {
    throw new Error(`Failed to load sections: ${sectionError.message}`);
  }
  const sections = (sectionData ?? []) as ProcedureSection[];

  let steps: ProcedureStep[] = [];
  if (sections.length > 0) {
    const { data: stepData, error: stepError } = await supabase
      .from("procedure_steps")
      .select("*")
      .in(
        "section_id",
        sections.map((s) => s.id),
      )
      .order("position");
    if (stepError) throw new Error(`Failed to load steps: ${stepError.message}`);
    steps = (stepData ?? []) as ProcedureStep[];
  }

  const referenced = [...new Set(steps.flatMap((s) => s.chemical_ids))];
  let chemicals: Chemical[] = [];
  if (referenced.length > 0) {
    const { data: chemData, error: chemError } = await supabase
      .from("chemicals")
      .select("*")
      .in("id", referenced)
      .order("name");
    if (chemError) {
      throw new Error(`Failed to load chemicals: ${chemError.message}`);
    }
    chemicals = (chemData ?? []) as Chemical[];
  }

  return { procedure: procedure as Procedure, sections, steps, chemicals };
}

export async function fetchChemicals() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("chemicals")
    .select("*")
    .order("category")
    .order("name");
  if (error) throw new Error(`Failed to load chemicals: ${error.message}`);
  return (data ?? []) as Chemical[];
}

/** Suggestion with its author, reviewer, and the step it targets joined in */
export interface SuggestionRow extends StepSuggestion {
  author: { full_name: string } | null;
  reviewer: { full_name: string } | null;
  step: {
    id: string;
    content: string;
    kind: ProcedureStep["kind"];
    position: number;
    section: {
      title: string;
      position: number;
      procedure: { slug: string; title: string } | null;
    } | null;
  } | null;
}

// profiles is referenced twice, so each embed names the column it follows
const SUGGESTION_SELECT = `*,
  author:profiles!author_id(full_name),
  reviewer:profiles!reviewed_by(full_name),
  step:procedure_steps(id, content, kind, position,
    section:procedure_sections(title, position,
      procedure:procedures(slug, title)))`;

const SUGGESTION_LIMIT = 200;

/** The whole suggestion queue, newest first. */
export async function fetchSuggestions() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("step_suggestions")
    .select(SUGGESTION_SELECT)
    .order("created_at", { ascending: false })
    .limit(SUGGESTION_LIMIT);
  if (error) throw new Error(`Failed to load suggestions: ${error.message}`);
  return (data ?? []) as unknown as SuggestionRow[];
}

/**
 * Open suggestions on a set of steps, keyed by step id. Filtering happens here
 * rather than with .in() — a procedure runs to 100+ steps and the open queue
 * is short, so one unfiltered read beats a URL full of step ids.
 */
export async function fetchOpenSuggestionsByStep(stepIds: string[]) {
  const byStep = new Map<string, SuggestionRow[]>();
  if (stepIds.length === 0) return byStep;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("step_suggestions")
    .select(SUGGESTION_SELECT)
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(SUGGESTION_LIMIT);
  if (error) throw new Error(`Failed to load suggestions: ${error.message}`);

  const wanted = new Set(stepIds);
  for (const row of (data ?? []) as unknown as SuggestionRow[]) {
    if (!wanted.has(row.step_id)) continue;
    const bucket = byStep.get(row.step_id);
    if (bucket) bucket.push(row);
    else byStep.set(row.step_id, [row]);
  }
  return byStep;
}

/** Open suggestion count for the queue link. Errors degrade to zero. */
export async function fetchOpenSuggestionCount() {
  const supabase = await createClient();
  const { count } = await supabase
    .from("step_suggestions")
    .select("id", { count: "exact", head: true })
    .eq("status", "open");
  return count ?? 0;
}
