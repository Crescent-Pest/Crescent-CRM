import Link from "next/link";
import { AlertTriangle, Circle } from "lucide-react";
import { setFollowupStatus } from "@/lib/actions/followups";
import { formatDate } from "@/lib/format";
import type { TeamFollowup } from "@/lib/team";
import { customerName } from "@/lib/types";

/** One open follow-up under its owner: check-off, description, due date,
 *  priority, linked customer, and who logged it when that wasn't the owner. */
export function TeamFollowupItem({
  item,
  today,
}: {
  item: TeamFollowup;
  today: string;
}) {
  const overdue = item.due_date !== null && item.due_date < today;

  return (
    <li className="border-b border-line px-3 py-2.5 last:border-b-0 md:px-4 md:py-3">
      <div className="flex items-start gap-2.5">
        <form action={setFollowupStatus} className="shrink-0">
          <input type="hidden" name="id" value={item.id} />
          <input type="hidden" name="done" value="true" />
          <button
            type="submit"
            aria-label="Mark as done"
            className="mt-0.5 flex min-h-8 min-w-8 items-center justify-center text-ink-soft transition-colors hover:text-denim"
          >
            <Circle size={20} />
          </button>
        </form>

        <div className="min-w-0 flex-1">
          <p className="text-sm">{item.description}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-ink-soft">
            <span className={overdue ? "font-semibold text-danger" : ""}>
              {item.due_date ? `Due ${formatDate(item.due_date)}` : "No due date"}
            </span>
            {item.priority === "urgent" && (
              <span className="inline-flex items-center gap-0.5 font-semibold text-danger">
                <AlertTriangle size={11} /> URGENT
              </span>
            )}
            {item.customer && (
              <Link
                href={`/customers/${item.customer.id}`}
                className="font-semibold text-denim hover:underline"
              >
                {customerName(item.customer)}
              </Link>
            )}
            {item.fromName && <span>from {item.fromName}</span>}
          </p>
        </div>
      </div>
    </li>
  );
}
