import { NoteCapture } from "@/components/notes/NoteCapture";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Capture screen. Server component so the client never learns whether the
 * transcription key exists — it just gets a "recording available" boolean. */
export default async function NewNotePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { inspection } = await searchParams;
  const inspectionId =
    typeof inspection === "string" && UUID_RE.test(inspection) ? inspection : null;

  return (
    <NoteCapture
      recordingEnabled={Boolean(process.env.TRANSCRIPTION_API_KEY)}
      inspectionId={inspectionId}
    />
  );
}
