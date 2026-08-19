"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Mic, Square } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

// Auto-stop long recordings so uploads stay well under Whisper's size limit.
const MAX_SECONDS = 5 * 60;
const TRANSCRIBE_TIMEOUT_MS = 120_000;

// First supported container wins; extension must match what /api/transcribe accepts.
const MIME_CANDIDATES: { mime: string; ext: string }[] = [
  { mime: "audio/webm;codecs=opus", ext: "webm" },
  { mime: "audio/webm", ext: "webm" },
  { mime: "audio/mp4", ext: "mp4" },
  { mime: "audio/ogg;codecs=opus", ext: "ogg" },
];

function pickMime(): { mime: string; ext: string } | null {
  for (const c of MIME_CANDIDATES) {
    if (MediaRecorder.isTypeSupported(c.mime)) return c;
  }
  return null;
}

type RecState = "idle" | "recording" | "processing";

/** Record → upload to the private voice-notes bucket → /api/transcribe.
 * Only rendered when TRANSCRIPTION_API_KEY is configured AND the browser
 * supports MediaRecorder; dictation is the always-available fallback. */
export function Recorder({
  onTranscript,
  onError,
}: {
  onTranscript: (text: string, audioPath: string) => void;
  onError: (message: string) => void;
}) {
  const [state, setState] = useState<RecState>("idle");
  const [seconds, setSeconds] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // stop the mic if the tech navigates away mid-recording
  useEffect(() => {
    return () => {
      recorderRef.current?.stream.getTracks().forEach((t) => t.stop());
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  async function start() {
    onError("");
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      onError("Mic access was blocked. Allow the microphone in your browser settings, or dictate with the keyboard mic.");
      return;
    }

    const picked = pickMime();
    const recorder = picked
      ? new MediaRecorder(stream, { mimeType: picked.mime })
      : new MediaRecorder(stream);
    chunksRef.current = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      void finish(picked?.ext ?? "webm", recorder.mimeType || picked?.mime || "audio/webm");
    };

    recorderRef.current = recorder;
    recorder.start();
    setSeconds(0);
    setState("recording");
    timerRef.current = setInterval(() => {
      setSeconds((s) => {
        if (s + 1 >= MAX_SECONDS) stop();
        return s + 1;
      });
    }, 1000);
  }

  function stop() {
    if (timerRef.current) clearInterval(timerRef.current);
    if (recorderRef.current?.state === "recording") {
      setState("processing");
      recorderRef.current.stop();
    }
  }

  async function finish(ext: string, mime: string) {
    try {
      const blob = new Blob(chunksRef.current, { type: mime });
      if (blob.size === 0) throw new Error("The recording came back empty. Try again.");

      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Your session expired. Sign in again.");

      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("voice-notes")
        .upload(path, blob, { contentType: mime.split(";")[0] });
      if (uploadError) {
        throw new Error("Upload failed. Check your connection and try again.");
      }

      const res = await fetch("/api/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audio_path: path }),
        signal: AbortSignal.timeout(TRANSCRIBE_TIMEOUT_MS),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Transcription failed. Try again, or type the note.");
      }
      onTranscript(String(data.transcript ?? ""), path);
    } catch (err) {
      onError(
        err instanceof Error && err.name === "TimeoutError"
          ? "Transcription is taking too long. Check your signal and try again."
          : err instanceof Error
            ? err.message
            : "Recording failed. Try again, or type the note."
      );
    } finally {
      setState("idle");
    }
  }

  const mmss = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

  if (state === "processing") {
    return (
      <button type="button" disabled className="btn-ghost w-full">
        <Loader2 size={16} className="animate-spin" />
        Transcribing…
      </button>
    );
  }

  if (state === "recording") {
    return (
      <button type="button" onClick={stop} className="btn-ghost w-full border-danger text-danger hover:border-danger hover:text-danger">
        <Square size={15} className="fill-current" />
        Stop recording · {mmss}
      </button>
    );
  }

  return (
    <button type="button" onClick={start} className="btn-ghost w-full">
      <Mic size={16} />
      Record voice note
    </button>
  );
}
