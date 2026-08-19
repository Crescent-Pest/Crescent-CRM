import Link from "next/link";
import { AlertTriangle, ChevronRight, ListTodo, Mic } from "lucide-react";
import { formatDate, formatLongDate, todayISO } from "@/lib/format";
import { fetchTeamOverview, type RecentNote, type WorkloadChip } from "@/lib/team";
import { customerName } from "@/lib/types";
import { TeamFollowupItem } from "./TeamFollowupItem";

function WorkloadCard({ chip }: { chip: WorkloadChip }) {
  const alert = chip.overdue > 0;
  return (
    <div
      className={`rounded-md border bg-card p-2 text-center md:rounded-lg md:p-4 md:text-left ${
        alert ? "border-danger/40" : "border-line"
      }`}
    >
      <p
        className={`font-display text-xl font-bold md:text-3xl ${
          alert ? "text-danger" : "text-denim"
        }`}
      >
        {chip.open}
        {alert && (
          <span className="ml-1.5 font-display text-xs font-semibold uppercase tracking-wider text-danger md:text-sm">
            {chip.overdue} overdue
          </span>
        )}
      </p>
      <p className="label mb-0 mt-0.5 truncate text-[10px] leading-tight tracking-[0.08em] md:mt-1 md:text-xs md:tracking-[0.12em]">
        {chip.name}
      </p>
    </div>
  );
}

function RecentNoteRow({ note }: { note: RecentNote }) {
  return (
    <li className="border-b border-line last:border-b-0">
      <Link
        href={`/notes/${note.id}`}
        className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-denim/5 md:px-4 md:py-3"
      >
        <Mic size={14} className="shrink-0 text-denim" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm">{note.summary}</p>
          <p className="truncate text-xs text-ink-soft">
            {formatDate(note.created_at.slice(0, 10))} ·{" "}
            {note.techName ?? "Unknown tech"}
            {note.customer && ` · ${customerName(note.customer)}`}
          </p>
        </div>
        <ChevronRight size={16} className="shrink-0 text-ink-soft" />
      </Link>
    </li>
  );
}

export default async function TeamPage() {
  const today = todayISO();
  const {
    assignmentsEnabled,
    workload,
    groups,
    recentNotes,
    openCount,
    overdueCount,
  } = await fetchTeamOverview(today);

  return (
    <div className="mx-auto max-w-5xl">
      <div>
        <h1 className="font-display text-2xl font-bold uppercase tracking-wide text-denim-ink md:text-4xl">
          Team Board
        </h1>
        <p className="mt-1 text-ink-soft">
          {formatLongDate(today)}
          <span className="mx-1.5">·</span>
          {openCount} open
          {overdueCount > 0 && (
            <span className="font-semibold text-danger">
              {" "}
              · {overdueCount} overdue
            </span>
          )}
        </p>
      </div>

      {!assignmentsEnabled && (
        <p className="mt-3 rounded-md border border-dashed border-line bg-card px-3 py-2 text-xs text-ink-soft">
          Assignments aren&apos;t enabled yet — follow-ups are grouped by the
          tech who logged them.
        </p>
      )}

      <section className="mt-4 md:mt-6">
        <h2 className="mb-2 font-display text-base font-bold uppercase tracking-wide text-denim-ink md:text-lg">
          Workload
        </h2>
        {workload.length === 0 ? (
          <p className="rounded-lg border border-dashed border-line bg-card px-4 py-6 text-center text-ink-soft">
            No active staff on the roster.
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-2 md:grid-cols-4 md:gap-4">
            {workload.map((chip) => (
              <WorkloadCard key={chip.id} chip={chip} />
            ))}
          </div>
        )}
      </section>

      <section className="mt-6 md:mt-8">
        <h2 className="mb-2 flex items-center gap-2 font-display text-base font-bold uppercase tracking-wide text-denim-ink md:text-lg">
          <ListTodo size={18} /> Open follow-ups
        </h2>
        {groups.length === 0 ? (
          <p className="rounded-lg border border-dashed border-line bg-card px-4 py-6 text-center text-ink-soft md:py-8">
            Nothing open across the team.
          </p>
        ) : (
          <div className="space-y-4">
            {groups.map((group) => (
              <div key={group.id ?? "unassigned"}>
                <h3 className="mb-1.5 flex items-center gap-2 font-display text-sm font-bold uppercase tracking-wider text-ink-soft">
                  {group.name}
                  <span className="font-semibold text-ink-soft">
                    {group.items.length}
                  </span>
                  {group.overdue > 0 && (
                    <span className="inline-flex items-center gap-0.5 font-semibold text-danger">
                      <AlertTriangle size={12} /> {group.overdue} overdue
                    </span>
                  )}
                </h3>
                <ul
                  className={`rounded-lg border bg-card ${
                    group.overdue > 0 ? "border-danger/40" : "border-line"
                  }`}
                >
                  {group.items.map((item) => (
                    <TeamFollowupItem key={item.id} item={item} today={today} />
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mt-6 md:mt-8">
        <h2 className="mb-2 flex items-center gap-2 font-display text-base font-bold uppercase tracking-wide text-denim-ink md:text-lg">
          <Mic size={18} /> Recent field activity
        </h2>
        {recentNotes.length === 0 ? (
          <p className="rounded-lg border border-dashed border-line bg-card px-4 py-6 text-center text-ink-soft md:py-8">
            No visit notes yet — techs capture these as voice notes in Crescent
            Inspect.
          </p>
        ) : (
          <ul className="rounded-lg border border-line bg-card">
            {recentNotes.map((note) => (
              <RecentNoteRow key={note.id} note={note} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
