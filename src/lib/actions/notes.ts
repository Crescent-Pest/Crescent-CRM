"use server";

import { after } from "next/server";
import {
  appBaseUrl,
  renderEmailHtml,
  renderEmailText,
  sendEmail,
  type EmailItem,
  type RenderEmailInput,
} from "@/lib/email";
import { createClient } from "@/lib/supabase/server";
import type { Profile, ReviewedActionItem, StructuredNote } from "@/lib/types";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Subjects get elided rather than wrapped in the client's list view. */
const SUBJECT_DESCRIPTION_MAX = 60;

/** True when the insert failed only because migration 009 hasn't been applied
 * to this database yet (PostgREST reports an unknown column). */
function isMissingAssignedTo(error: { code?: string; message?: string }) {
  return (
    (error.code === "PGRST204" || error.code === "42703") &&
    (error.message ?? "").includes("assigned_to")
  );
}

type ServerClient = Awaited<ReturnType<typeof createClient>>;
type StaffContact = Pick<Profile, "id" | "full_name" | "email">;

interface AssignedItem {
  description: string;
  due_date: string | null;
  priority: "normal" | "urgent";
  assigned_to: string;
}

/**
 * Email each teammate the note just handed work to — one message per person,
 * never to the creator about their own items.
 *
 * Never throws and never rethrows: like enqueueCustomerSync, a broken outbound
 * path must not cost staff their save. Callers run it from `after()` so the
 * tech's response is already gone by the time Resend is dialed.
 */
async function notifyAssignees(
  supabase: ServerClient,
  creatorId: string,
  items: AssignedItem[],
  customerName: string | null
) {
  try {
    const byAssignee = new Map<string, AssignedItem[]>();
    for (const item of items) {
      if (item.assigned_to === creatorId) continue;
      const existing = byAssignee.get(item.assigned_to);
      if (existing) existing.push(item);
      else byAssignee.set(item.assigned_to, [item]);
    }
    if (byAssignee.size === 0) return;

    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("id", [creatorId, ...byAssignee.keys()]);
    if (error) throw error;

    const staff = (data ?? []) as StaffContact[];
    const fromName =
      staff.find((p) => p.id === creatorId)?.full_name || "A teammate";
    const buttonHref = `${appBaseUrl()}/followups`;

    for (const [assigneeId, assigned] of byAssignee) {
      const to = staff.find((p) => p.id === assigneeId)?.email;
      if (!to) {
        console.warn(`email: no address on profile ${assigneeId} — skipped`);
        continue;
      }

      const first = assigned[0].description;
      const headline =
        first.length > SUBJECT_DESCRIPTION_MAX
          ? `${first.slice(0, SUBJECT_DESCRIPTION_MAX - 1).trimEnd()}…`
          : first;
      const extra = assigned.length - 1;
      const subject =
        `New follow-up${extra > 0 ? "s" : ""} from ${fromName}: "${headline}"` +
        (extra > 0 ? ` +${extra} more` : "");

      const content: RenderEmailInput = {
        heading: `${fromName} assigned you ${assigned.length} follow-up${
          assigned.length === 1 ? "" : "s"
        }`,
        intro: customerName
          ? `From a visit note on ${customerName}.`
          : "From a visit note just saved in the CRM.",
        sections: [
          {
            title: "Assigned to you",
            tone: "normal",
            // customer is omitted per item — the intro already names it
            items: assigned.map<EmailItem>((item) => ({
              description: item.description,
              due_date: item.due_date,
              urgent: item.priority === "urgent",
            })),
          },
        ],
        buttonLabel: "Open follow-ups",
        buttonHref,
      };

      await sendEmail({
        to,
        subject,
        html: renderEmailHtml(content),
        text: renderEmailText(content),
      });
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(`email: assignment ping failed: ${message}`);
  }
}

export interface SaveVisitNoteInput {
  transcript: string;
  summary: string;
  structured: StructuredNote;
  /** CRM customer picked by the tech, or null when skipped / not in system. */
  customer_id: string | null;
  customer_name: string | null;
  inspection_id: string | null;
  audio_path: string | null;
  action_items: ReviewedActionItem[];
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

  // Re-validate the (tech-edited) action items server-side. An assignee the
  // tech didn't set — or one that isn't a uuid — falls back to the creator.
  const items = (input.action_items ?? [])
    .slice(0, 20)
    .map<AssignedItem>((item) => ({
      description: String(item.description ?? "").slice(0, 500).trim(),
      due_date:
        item.due_date && DATE_RE.test(item.due_date) ? item.due_date : null,
      priority: item.priority === "urgent" ? "urgent" : "normal",
      assigned_to:
        item.assigned_to && UUID_RE.test(item.assigned_to)
          ? item.assigned_to
          : user.id,
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
    const rows = items.map((item) => ({
      visit_note_id: note.id,
      tech_id: user.id,
      ...item,
    }));

    let assignmentsSaved = true;
    let { error: itemsError } = await supabase.from("action_items").insert(rows);
    if (itemsError && isMissingAssignedTo(itemsError)) {
      // Pre-009 database: save the follow-ups owned by their creator rather
      // than losing them. They re-key to assigned_to once the migration runs.
      assignmentsSaved = false;
      console.warn(
        "action_items: assigned_to column missing — apply migration 009_assignments.sql"
      );
      ({ error: itemsError } = await supabase.from("action_items").insert(
        rows.map((row) => ({
          visit_note_id: row.visit_note_id,
          tech_id: row.tech_id,
          description: row.description,
          due_date: row.due_date,
          priority: row.priority,
        }))
      ));
    }

    if (itemsError) {
      console.error("action_items insert failed:", itemsError);
      return {
        id: note.id,
        error:
          "The note saved, but its follow-ups didn't. Open the note and add them by hand.",
      };
    }

    // Fire-and-forget past the response boundary: the tech's save has already
    // returned by the time this runs, and notifyAssignees swallows its own
    // errors. On a pre-009 database nothing was assigned, so nobody is pinged.
    if (assignmentsSaved) {
      after(() => notifyAssignees(supabase, user.id, items, customerName));
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
