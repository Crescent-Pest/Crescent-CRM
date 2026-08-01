"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { describeRecurrence, maybeScheduleNext } from "@/lib/recurrence";
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

// Record keyed by the enum so TypeScript flags drift if job_status changes
const JOB_STATUSES: Record<JobStatus, true> = {
  scheduled: true,
  in_progress: true,
  completed: true,
  canceled: true,
};

export async function updateJob(formData: FormData) {
  const id = str(formData, "id");
  if (!id) redirect("/schedule");

  const editPath = `/jobs/${id}/edit`;
  const title = str(formData, "title");
  const scheduled_date = str(formData, "scheduled_date");
  if (!title || !scheduled_date) {
    redirect(`${editPath}?error=missing`);
  }

  const raw = str(formData, "status");
  const status = raw in JOB_STATUSES ? (raw as JobStatus) : null;
  if (!status) redirect(`${editPath}?error=status`);

  const supabase = await createClient();
  const { data: current } = await supabase
    .from("jobs")
    .select("completed_at")
    .eq("id", id)
    .single<{ completed_at: string | null }>();
  if (!current) redirect(`${editPath}?error=notfound`);

  // stamp completion on the way in, clear it on the way back out
  let completed_at: string | null = null;
  if (status === "completed") {
    completed_at = current.completed_at ?? new Date().toISOString();
  }

  const { error } = await supabase
    .from("jobs")
    .update({
      title,
      scheduled_date,
      window_start: orNull(str(formData, "window_start")),
      window_end: orNull(str(formData, "window_end")),
      assigned_to: orNull(str(formData, "assigned_to")),
      status,
      completed_at,
    })
    .eq("id", id);

  if (error) {
    redirect(`${editPath}?error=${encodeURIComponent(error.message)}`);
  }

  if (status === "completed") {
    console.log(describeRecurrence(id, await maybeScheduleNext(supabase, id)));
  }

  revalidatePath("/schedule");
  revalidatePath("/today");
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
  const { error } = await supabase.from("jobs").update(update).eq("id", id);

  if (!error && status === "completed") {
    console.log(describeRecurrence(id, await maybeScheduleNext(supabase, id)));
  }

  revalidatePath("/schedule");
  revalidatePath("/today");
  revalidatePath("/");
}
