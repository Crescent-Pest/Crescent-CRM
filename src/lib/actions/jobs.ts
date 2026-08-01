"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { JobStatus } from "@/lib/types";

function str(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function orNull(value: string) {
  return value === "" ? null : value;
}

export async function createJob(formData: FormData) {
  const property_id = str(formData, "property_id");
  const title = str(formData, "title");
  const scheduled_date = str(formData, "scheduled_date");

  if (!property_id || !title || !scheduled_date) {
    redirect("/schedule/new?error=missing");
  }

  const supabase = await createClient();
  const { error } = await supabase.from("jobs").insert({
    property_id,
    title,
    scheduled_date,
    window_start: orNull(str(formData, "window_start")),
    window_end: orNull(str(formData, "window_end")),
    assigned_to: orNull(str(formData, "assigned_to")),
  });

  if (error) {
    redirect(`/schedule/new?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/schedule");
  revalidatePath("/");
  redirect("/schedule");
}

const allowedTransitions: Record<string, JobStatus> = {
  start: "in_progress",
  complete: "completed",
  cancel: "canceled",
  reopen: "scheduled",
};

export async function setJobStatus(formData: FormData) {
  const id = str(formData, "id");
  const action = str(formData, "action");
  const status = allowedTransitions[action];
  if (!id || !status) return;

  const update: {
    status: JobStatus;
    completed_at: string | null;
    completion_notes?: string;
  } = {
    status,
    completed_at: status === "completed" ? new Date().toISOString() : null,
  };

  const notes = str(formData, "completion_notes");
  if (notes) update.completion_notes = notes;

  const supabase = await createClient();
  await supabase.from("jobs").update(update).eq("id", id);

  revalidatePath("/schedule");
  revalidatePath("/");
}
