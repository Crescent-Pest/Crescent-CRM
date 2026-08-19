import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Whisper on a several-minute recording can take a while.
export const maxDuration = 120;

// Whisper rejects files over 25 MB; stay under it with margin.
const MAX_AUDIO_BYTES = 20 * 1024 * 1024;

// user-id folder / uuid file, extension limited to what the recorder produces
const AUDIO_PATH_RE = /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(webm|mp4|m4a|ogg)$/;

const WHISPER_URL = "https://api.openai.com/v1/audio/transcriptions";

/**
 * Transcribes a recording the client already uploaded to the private
 * voice-notes bucket. Only reachable when TRANSCRIPTION_API_KEY is set —
 * the UI hides the record button otherwise, so a 503 here means someone
 * bypassed the flow.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { error: "Not signed in. Log in and try again." },
      { status: 401 }
    );
  }

  const apiKey = process.env.TRANSCRIPTION_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Voice transcription isn't configured. Dictate with the keyboard mic instead." },
      { status: 503 }
    );
  }

  let audioPath: string;
  try {
    const body = await request.json();
    audioPath = String(body.audio_path ?? "");
    if (!AUDIO_PATH_RE.test(audioPath)) throw new Error("bad path");
  } catch {
    return NextResponse.json(
      { error: "No recording received. Record again and retry." },
      { status: 400 }
    );
  }
  // Techs can only transcribe their own uploads.
  if (!audioPath.startsWith(`${user.id}/`)) {
    return NextResponse.json({ error: "That recording isn't yours." }, { status: 403 });
  }

  const { data: blob, error: downloadError } = await supabase.storage
    .from("voice-notes")
    .download(audioPath);
  if (downloadError || !blob) {
    console.error("voice-note download failed:", downloadError);
    return NextResponse.json(
      { error: "Couldn't read the recording. Record again and retry." },
      { status: 502 }
    );
  }
  if (blob.size > MAX_AUDIO_BYTES) {
    return NextResponse.json(
      { error: "That recording is too long to transcribe. Keep it under a few minutes." },
      { status: 413 }
    );
  }

  const form = new FormData();
  form.append("file", blob, audioPath.split("/")[1]);
  form.append("model", "whisper-1");

  let whisperRes: Response;
  try {
    whisperRes = await fetch(WHISPER_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });
  } catch (err) {
    console.error("whisper request failed:", err);
    return NextResponse.json(
      { error: "Couldn't reach the transcription service. Check your connection and try again." },
      { status: 503 }
    );
  }

  if (!whisperRes.ok) {
    const detail = await whisperRes.text().catch(() => "");
    console.error("whisper error:", whisperRes.status, detail.slice(0, 500));
    if (whisperRes.status === 401) {
      return NextResponse.json(
        { error: "The transcription key was rejected — check TRANSCRIPTION_API_KEY." },
        { status: 502 }
      );
    }
    if (whisperRes.status === 429) {
      return NextResponse.json(
        { error: "The transcription service is busy. Wait a minute and try again." },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { error: "Transcription failed. Try again, or type the note instead." },
      { status: 502 }
    );
  }

  const data = (await whisperRes.json().catch(() => null)) as { text?: string } | null;
  const transcript = String(data?.text ?? "").trim();
  if (!transcript) {
    return NextResponse.json(
      { error: "The recording came back empty. Speak closer to the phone and try again." },
      { status: 422 }
    );
  }

  return NextResponse.json({ transcript });
}
