import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ArrowLeft, CheckCircle2, Circle, ClipboardList } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { customerDisplayName } from "@/lib/customers";
import type { ActionItem, VisitNote } from "@/lib/types";

interface VisitNoteRow extends VisitNote {
  profiles: { full_name: string } | null;
  customers: { first_name: string; last_name: string; company_name: string } | null;
}

function formatDue(dueDate: string) {
  // parse as local midnight so the date doesn't shift a day
  return new Date(`${dueDate}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export default async function NoteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data } = await supabase
    .from("visit_notes")
    .select("*, profiles(full_name), customers(first_name, last_name, company_name)")
    .eq("id", id)
    .single();
  if (!data) notFound();
  const note = data as VisitNoteRow;

  const { data: itemRows } = await supabase
    .from("action_items")
    .select("*")
    .eq("visit_note_id", id)
    .order("due_date", { ascending: true, nullsFirst: false });
  const items = (itemRows ?? []) as ActionItem[];

  let audioUrl: string | null = null;
  if (note.audio_path) {
    const { data: signed } = await supabase.storage
      .from("voice-notes")
      .createSignedUrl(note.audio_path, 60 * 60);
    audioUrl = signed?.signedUrl ?? null;
  }

  const created = new Date(note.created_at).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
  // linked CRM customer wins; fall back to whatever name the tech typed
  const customer =
    (note.customers ? customerDisplayName(note.customers) : null) ||
    note.structured?.customer_name ||
    note.structured?.mentioned_customer ||
    null;

  return (
    <div className="space-y-4">
      <Link
        href="/followups"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-denim hover:text-denim-deep"
      >
        <ArrowLeft size={16} />
        Follow-ups
      </Link>

      <div>
        <h1 className="font-display text-xl font-bold uppercase tracking-[0.08em] text-denim-ink">
          {customer ? `Visit — ${customer}` : "Visit Note"}
        </h1>
        <p className="text-xs text-ink-soft">
          {created} · {note.profiles?.full_name ?? "Unknown tech"}
        </p>
      </div>

      {note.inspection_id && (
        <Link
          href={`/history/${note.inspection_id}`}
          className="inline-flex items-center gap-1.5 rounded-full bg-denim/10 px-3 py-1 text-xs font-medium text-denim hover:bg-denim/15"
        >
          <ClipboardList size={13} />
          View linked inspection
        </Link>
      )}

      {note.summary && (
        <div className="card">
          <p className="label">Visit summary</p>
          <p className="text-sm text-ink">{note.summary}</p>
        </div>
      )}

      {(note.structured?.customer_commitments?.length ?? 0) > 0 && (
        <div className="card">
          <p className="label">Customer agreed to</p>
          <ul className="list-disc space-y-0.5 pl-4 text-sm text-ink">
            {note.structured!.customer_commitments.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="card">
        <p className="label">Follow-ups</p>
        {items.length === 0 && (
          <p className="text-sm text-ink-soft">No follow-ups on this note.</p>
        )}
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.id} className="flex items-start gap-2 text-sm">
              {item.status === "done" ? (
                <CheckCircle2 size={17} className="mt-0.5 shrink-0 text-ok" />
              ) : (
                <Circle size={17} className="mt-0.5 shrink-0 text-ink-soft" />
              )}
              <div className="min-w-0">
                <p className={item.status === "done" ? "text-ink-soft line-through" : "text-ink"}>
                  {item.description}
                </p>
                <p className="flex items-center gap-1.5 text-xs text-ink-soft">
                  {item.due_date ? `Due ${formatDue(item.due_date)}` : "No due date"}
                  {item.priority === "urgent" && (
                    <span className="inline-flex items-center gap-0.5 font-semibold text-danger">
                      <AlertTriangle size={11} />
                      URGENT
                    </span>
                  )}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {audioUrl && (
        <div className="card">
          <p className="label">Recording</p>
          <audio controls preload="none" src={audioUrl} className="w-full" />
        </div>
      )}

      {note.transcript && (
        <details className="card">
          <summary className="label mb-0 cursor-pointer select-none">
            Full transcript
          </summary>
          <p className="mt-2 whitespace-pre-wrap text-sm text-ink">{note.transcript}</p>
        </details>
      )}
    </div>
  );
}
