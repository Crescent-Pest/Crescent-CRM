import Link from "next/link";
import { AlertTriangle, CheckCircle2, Circle } from "lucide-react";
import { setFollowupStatus } from "@/lib/actions/followups";
import { formatDate } from "@/lib/format";
import type { FollowupRow } from "@/lib/fieldActivity";
import { customerName } from "@/lib/types";

/** One follow-up row: check-off form, description, due date, assignee, customer. */
export function FollowupItem({
  item,
  today,
}: {
  item: FollowupRow;
  today: string;
}) {
  const done = item.status === "done";
  const overdue = !done && item.due_date !== null && item.due_date < today;
  const customer = item.visit_note?.customer ?? null;
  // pre-009 rows have no assignee — the tech who recorded the note owns them
  const assignee = item.assignee ?? item.tech;
  const creatorFirstName = item.tech?.full_name.trim().split(/\s+/)[0] ?? null;
  const fromCreator = Boolean(
    creatorFirstName &&
      item.assigned_to &&
      item.tech_id &&
      item.assigned_to !== item.tech_id
  );

  return (
    <li className="border-b border-line px-3 py-2.5 last:border-b-0 md:px-4 md:py-3">
      <div className="flex items-start gap-2.5">
        <form action={setFollowupStatus} className="shrink-0">
          <input type="hidden" name="id" value={item.id} />
          <input type="hidden" name="done" value={done ? "false" : "true"} />
          <button
            type="submit"
            aria-label={done ? "Mark as open" : "Mark as done"}
            className="mt-0.5 flex min-h-8 min-w-8 items-center justify-center text-ink-soft transition-colors hover:text-denim"
          >
            {done ? (
              <CheckCircle2 size={20} className="text-ok" />
            ) : (
              <Circle size={20} />
            )}
          </button>
        </form>

        <div className="min-w-0 flex-1">
          <p className={`text-sm ${done ? "text-ink-soft line-through" : ""}`}>
            {item.description}
          </p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-ink-soft">
            <span className={overdue ? "font-semibold text-danger" : ""}>
              {item.due_date ? `Due ${formatDate(item.due_date)}` : "No due date"}
            </span>
            {item.priority === "urgent" && !done && (
              <span className="inline-flex items-center gap-0.5 font-semibold text-danger">
                <AlertTriangle size={11} /> URGENT
              </span>
            )}
            <span>{assignee?.full_name ?? "Unassigned"}</span>
            {fromCreator && <span>from {creatorFirstName}</span>}
            {customer ? (
              <Link
                href={`/customers/${customer.id}`}
                className="font-semibold text-denim hover:underline"
              >
                {customerName(customer)}
              </Link>
            ) : (
              <span className="rounded-full bg-ink-soft/10 px-2 py-0.5 font-display font-semibold uppercase tracking-wider">
                Unlinked
              </span>
            )}
          </p>
        </div>
      </div>
    </li>
  );
}
