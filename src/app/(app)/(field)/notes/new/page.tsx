import { createClient } from "@/lib/supabase/server";
import { NoteCapture } from "@/components/notes/NoteCapture";
import type { Profile } from "@/lib/types";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Capture screen. Server component so the client never learns whether the
 * transcription key exists — it just gets a "recording available" boolean.
 * It also carries the active-staff roster used by the assignee dropdown. */
export default async function NewNotePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { inspection } = await searchParams;
  const inspectionId =
    typeof inspection === "string" && UUID_RE.test(inspection) ? inspection : null;

  const supabase = await createClient();
  const [userRes, staffRes] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from("profiles").select("id, full_name").eq("active", true).order("full_name"),
  ]);
  if (staffRes.error) {
    console.error("new note: staff lookup failed:", staffRes.error.message);
  }
  const staff = (staffRes.data ?? []) as Pick<Profile, "id" | "full_name">[];

  return (
    <NoteCapture
      recordingEnabled={Boolean(process.env.TRANSCRIPTION_API_KEY)}
      inspectionId={inspectionId}
      staff={staff}
      selfId={userRes.data.user?.id ?? ""}
    />
  );
}
