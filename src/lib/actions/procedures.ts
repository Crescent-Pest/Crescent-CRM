"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { StepKind, SuggestionStatus } from "@/lib/types";

/**
 * Writes against the ops manual. Everything here is a plain authenticated
 * Supabase call — RLS decides what sticks: active staff may file suggestions,
 * admins may edit steps and review the queue.
 */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MIN_CONTENT = 5;
const MAX_CONTENT = 4000;
const MAX_REASON = 500;

export const STEP_KINDS: readonly StepKind[] = ["step", "warning", "tip"];

export interface ProcedureFormState {
  error: string | null;
  success: boolean;
}

export const emptyProcedureFormState: ProcedureFormState = {
  error: null,
  success: false,
};

function field(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

/** Re-render every page that shows manual content or the queue. */
function revalidateManual() {
  revalidatePath("/procedures");
  revalidatePath("/procedures/[slug]", "page");
  revalidatePath("/procedures/suggestions");
}

/** File a suggested rewrite of one step. Any active staff member can do this. */
export async function suggestStepChange(
  _prev: ProcedureFormState,
  formData: FormData,
): Promise<ProcedureFormState> {
  const stepId = field(formData, "step_id");
  const proposed = field(formData, "proposed_content");
  const reason = field(formData, "reason");

  if (!stepId) {
    return { error: "That step is missing an id — reload and try again.", success: false };
  }
  if (proposed.length < MIN_CONTENT) {
    return { error: "Write out how the step should read.", success: false };
  }
  if (proposed.length > MAX_CONTENT) {
    return {
      error: `Keep the rewrite under ${MAX_CONTENT} characters.`,
      success: false,
    };
  }
  if (reason.length > MAX_REASON) {
    return { error: `Keep the note under ${MAX_REASON} characters.`, success: false };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Your session expired. Sign in again.", success: false };
  }

  const { error } = await supabase.from("step_suggestions").insert({
    step_id: stepId,
    author_id: user.id,
    proposed_content: proposed,
    reason: reason || null,
  });

  if (error) {
    console.error("suggestStepChange failed:", error.message);
    return {
      error: "Couldn't send that suggestion. Check your signal and try again.",
      success: false,
    };
  }

  revalidateManual();
  return { error: null, success: true };
}

/**
 * Accept or reject a suggestion. Accepting writes the proposed text onto the
 * step first, so a failure there leaves the suggestion open rather than
 * closing it against an unchanged manual.
 */
export async function reviewSuggestion(
  _prev: ProcedureFormState,
  formData: FormData,
): Promise<ProcedureFormState> {
  const id = field(formData, "id");
  const decision = field(formData, "decision");

  if (!UUID_RE.test(id)) {
    return { error: "Unknown suggestion.", success: false };
  }
  if (decision !== "accepted" && decision !== "rejected") {
    return { error: "Pick accept or reject.", success: false };
  }
  const status: SuggestionStatus = decision;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Your session expired. Sign in again.", success: false };
  }

  const { data: suggestion, error: loadError } = await supabase
    .from("step_suggestions")
    .select("id, step_id, proposed_content, status")
    .eq("id", id)
    .maybeSingle();
  if (loadError || !suggestion) {
    console.error("reviewSuggestion load failed:", loadError?.message);
    return { error: "Couldn't find that suggestion.", success: false };
  }
  if (suggestion.status !== "open") {
    return { error: "Someone already reviewed that one.", success: false };
  }

  if (status === "accepted") {
    // select() so an RLS-filtered no-op comes back as zero rows, not as success
    const { data: edited, error: stepError } = await supabase
      .from("procedure_steps")
      .update({ content: suggestion.proposed_content })
      .eq("id", suggestion.step_id)
      .select("id");
    if (stepError || (edited ?? []).length === 0) {
      console.error("reviewSuggestion step update failed:", stepError?.message);
      return {
        error: "Couldn't apply the edit — only an admin can change the manual.",
        success: false,
      };
    }
  }

  const { data: closed, error: statusError } = await supabase
    .from("step_suggestions")
    .update({
      status,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("id");

  if (statusError || (closed ?? []).length === 0) {
    console.error("reviewSuggestion status update failed:", statusError?.message);
    return {
      error:
        status === "accepted"
          ? "The step was updated but the suggestion stayed open. Try closing it again."
          : "Couldn't reject that — only an admin can review suggestions.",
      success: false,
    };
  }

  revalidateManual();
  return { error: null, success: true };
}

/** Admin edit of a single step's text and kind. */
export async function updateStep(
  _prev: ProcedureFormState,
  formData: FormData,
): Promise<ProcedureFormState> {
  const stepId = field(formData, "step_id");
  const content = field(formData, "content");
  const kind = field(formData, "kind") as StepKind;

  if (!stepId) {
    return { error: "That step is missing an id — reload and try again.", success: false };
  }
  if (content.length === 0) {
    return { error: "A step can't be empty.", success: false };
  }
  if (content.length > MAX_CONTENT) {
    return { error: `Keep step text under ${MAX_CONTENT} characters.`, success: false };
  }
  if (!STEP_KINDS.includes(kind)) {
    return { error: "Pick step, warning, or tip.", success: false };
  }

  const supabase = await createClient();
  // select() so an RLS-filtered no-op comes back as zero rows, not as success
  const { data: edited, error } = await supabase
    .from("procedure_steps")
    .update({ content, kind })
    .eq("id", stepId)
    .select("id");

  if (error || (edited ?? []).length === 0) {
    console.error("updateStep failed:", error?.message);
    return {
      error: "Couldn't save that — only an admin can edit the manual.",
      success: false,
    };
  }

  revalidateManual();
  return { error: null, success: true };
}
