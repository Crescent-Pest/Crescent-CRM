"use server";

import { createClient } from "@/lib/supabase/server";
import type { StructuredActionItem, StructuredNote } from "@/lib/types";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export interface SaveVisitNoteInput {
  transcript: string;
  summary: string;
  structured: StructuredNote;
  /** CRM customer picked by the tech, or null when skipped / not in system. */
  customer_id: string | null;
  customer_name: string | null;
  inspection_id: string | null;
  audio_path: string | null;
  action_items: StructuredActionItem[];
}

export interface SaveVisitNoteResult {
  id: string | null;
  error: string | null;
}

/** Insert the reviewed visit note plus its follow-up action items. Audio (if
 * any) is already uploaded to the voice-notes bucket by the client. */
export async function saveVisitNote(
  input: SaveVisitNoteInput
): Promise<SaveVisitNoteResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { id: null, error: "Your session expired. Sign in again." };
  }

  const transcript = String(input.transcript ?? "").slice(0, 12_000).trim();
  const summary = String(input.summary ?? "").slice(0, 4_000).trim();
  if (!transcript || !summary) {
    return { id: null, error: "Missing note text or summary — finish the flow first." };
  }

  const inspectionId =
    input.inspection_id && UUID_RE.test(input.inspection_id)
      ? input.inspection_id
      : null;
  const customerId =
    input.customer_id && UUID_RE.test(input.customer_id) ? input.customer_id : null;
  const customerName = input.customer_name
    ? String(input.customer_name).slice(0, 200).trim() || null
    : null;

  // Re-validate the (tech-edited) action items server-side.
  const items = (input.action_items ?? [])
    .slice(0, 20)
    .map((item) => ({
      description: String(item.description ?? "").slice(0, 500).trim(),
      due_date:
        item.due_date && DATE_RE.test(item.due_date) ? item.due_date : null,
      priority: item.priority === "urgent" ? "urgent" : "normal",
    }))
    .filter((item) => item.description.length > 0);

  const { data: note, error: noteError } = await supabase
    .from("visit_notes")
    .insert({
      tech_id: user.id,
      customer_id: customerId,
      inspection_id: inspectionId,
      audio_path: input.audio_path || null,
      transcript,
      summary,
      structured: { ...input.structured, customer_name: customerName },
    })
    .select("id")
    .single();

  if (noteError || !note) {
    console.error("saveVisitNote failed:", noteError);
    return {
      id: null,
      error: "Couldn't save the note. Check your connection and try again.",
    };
  }

  if (items.length > 0) {
    const { error: itemsError } = await supabase.from("action_items").insert(
      items.map((item) => ({
        visit_note_id: note.id,
        tech_id: user.id,
        ...item,
      }))
    );
    if (itemsError) {
      console.error("action_items insert failed:", itemsError);
      return {
        id: note.id,
        error:
          "The note saved, but its follow-ups didn't. Open the note and add them by hand.",
      };
    }
  }

  return { id: note.id, error: null };
}

/** Check or un-check a follow-up. Any active staff member can toggle. */
export async function setActionItemStatus(
  id: string,
  done: boolean
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Your session expired. Sign in again." };
  }
  if (!UUID_RE.test(id)) {
    return { error: "Unknown follow-up item." };
  }

  const { error } = await supabase
    .from("action_items")
    .update(
      done
        ? { status: "done", done_at: new Date().toISOString() }
        : { status: "open", done_at: null }
    )
    .eq("id", id);

  if (error) {
    console.error("setActionItemStatus failed:", error);
    return { error: "Couldn't update the follow-up. Try again." };
  }
  return { error: null };
}
