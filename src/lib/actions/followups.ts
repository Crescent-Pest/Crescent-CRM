"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Check a follow-up off (done=true) or reopen it (done=false). Any active
 * staff member can toggle — RLS limits writes to active staff.
 */
export async function setFollowupStatus(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();
  const done = String(formData.get("done") ?? "") === "true";
  if (!UUID_RE.test(id)) return;

  const supabase = await createClient();
  const { error } = await supabase
    .from("action_items")
    .update(
      done
        ? { status: "done", done_at: new Date().toISOString() }
        : { status: "open", done_at: null },
    )
    .eq("id", id);
  if (error) console.error("setFollowupStatus failed:", error.message);

  revalidatePath("/followups");
  revalidatePath("/team");
  revalidatePath("/");
}
