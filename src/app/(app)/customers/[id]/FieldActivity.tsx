import { AlertTriangle, Bug, Circle, Mic } from "lucide-react";
import {
  fetchCustomerFieldActivity,
  pestLabel,
  type InspectionActivity,
  type VisitNoteActivity,
} from "@/lib/fieldActivity";
import { formatDate, formatMoney, todayISO } from "@/lib/format";
import { Markdown } from "@/lib/markdown";
import type { InspectionStatus } from "@/lib/types";

const statusChip: Record<InspectionStatus, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-ink-soft/10 text-ink-soft" },
  presented: { label: "Presented", className: "bg-denim/10 text-denim" },
  sold: { label: "Sold", className: "bg-ok/10 text-ok" },
};

function InspectionCard({ inspection }: { inspection: InspectionActivity }) {
  const chip = statusChip[inspection.status] ?? statusChip.draft;
  return (
    <div className="rounded-lg border border-line bg-card p-4">
      <div className="flex items-start gap-3">
        {inspection.photoUrl && (
          <a
            href={inspection.photoUrl}
            target="_blank"
            rel="noreferrer"
            aria-label="Open inspection photo"
            className="shrink-0"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL */}
            <img
              src={inspection.photoUrl}
              alt="Inspection photo"
              className="h-14 w-14 rounded-md border border-line object-cover"
            />
          </a>
        )}
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-semibold">
            <Bug size={15} className="text-gold-deep" />
            {inspection.pest_confirmed
              ? pestLabel(inspection.pest_confirmed)
              : "Pest not confirmed"}
            {inspection.estimate_cents != null && (
              <span className="font-normal text-ink-soft">
                · {formatMoney(inspection.estimate_cents)} estimate
              </span>
            )}
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 font-display text-xs font-semibold uppercase tracking-wider ${chip.className}`}
            >
              {chip.label}
            </span>
          </p>
          <p className="mt-0.5 text-sm text-ink-soft">
            {formatDate(inspection.created_at.slice(0, 10))} ·{" "}
            {inspection.tech?.full_name ?? "Unknown tech"}
          </p>
          {inspection.plan_md && (
            <details className="mt-1.5">
              <summary className="cursor-pointer text-sm font-semibold text-denim hover:text-denim-deep">
                Treatment plan
              </summary>
              <div className="mt-2 rounded-md border border-line bg-white p-3">
                <Markdown text={inspection.plan_md} />
              </div>
            </details>
          )}
        </div>
      </div>
    </div>
  );
}

function VisitNoteCard({ note, today }: { note: VisitNoteActivity; today: string }) {
  const openItems = note.action_items.filter((i) => i.status === "open");
  return (
    <div className="rounded-lg border border-line bg-card p-4">
      <p className="flex items-start gap-2 text-sm">
        <Mic size={14} className="mt-0.5 shrink-0 text-denim" />
        <span>{note.summary ?? "Voice note (no summary)"}</span>
      </p>
      <p className="mt-1 text-xs text-ink-soft">
        {note.tech?.full_name ?? "Unknown tech"} ·{" "}
        {formatDate(note.created_at.slice(0, 10))}
      </p>
      {openItems.length > 0 && (
        <ul className="mt-2 space-y-1 border-t border-line pt-2">
          {openItems.map((item) => (
            <li key={item.id} className="flex items-start gap-1.5 text-sm">
              <Circle size={13} className="mt-1 shrink-0 text-ink-soft" />
              <span>
                {item.description}
                {item.due_date && (
                  <span
                    className={
                      item.due_date < today
                        ? "font-semibold text-danger"
                        : "text-ink-soft"
                    }
                  >
                    {" "}
                    · due {formatDate(item.due_date)}
                  </span>
                )}
                {item.priority === "urgent" && (
                  <span className="ml-1.5 inline-flex items-center gap-0.5 text-xs font-semibold text-danger">
                    <AlertTriangle size={11} /> URGENT
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Inspections and visit notes techs logged in Crescent Inspect for this customer. */
export async function FieldActivity({ customerId }: { customerId: string }) {
  const { inspections, visitNotes } = await fetchCustomerFieldActivity(customerId);
  const today = todayISO();

  return (
    <section>
      <h2 className="mb-2 font-display text-base font-bold uppercase tracking-wide md:text-lg text-denim-ink">
        Field activity
      </h2>
      {inspections.length === 0 && visitNotes.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line bg-card px-4 py-6 text-center text-sm text-ink-soft">
          No inspections or visit notes yet — techs log these from Crescent Inspect.
        </p>
      ) : (
        <div className="space-y-4">
          {inspections.length > 0 && (
            <div>
              <h3 className="mb-2 font-display text-sm font-bold uppercase tracking-wider text-ink-soft">
                Inspections
              </h3>
              <div className="space-y-3">
                {inspections.map((i) => (
                  <InspectionCard key={i.id} inspection={i} />
                ))}
              </div>
            </div>
          )}
          {visitNotes.length > 0 && (
            <div>
              <h3 className="mb-2 font-display text-sm font-bold uppercase tracking-wider text-ink-soft">
                Visit notes
              </h3>
              <div className="space-y-3">
                {visitNotes.map((n) => (
                  <VisitNoteCard key={n.id} note={n} today={today} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
