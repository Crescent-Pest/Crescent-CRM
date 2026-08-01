import Link from "next/link";
import { Clock, KeyRound, MapPin, User } from "lucide-react";
import { formatDate, formatWindow } from "@/lib/format";
import { customerName } from "@/lib/types";
import type { RunSheetJobRow } from "@/lib/queries";
import { JobActions } from "@/components/JobActions";
import { StatusBadge } from "@/components/StatusBadge";
import { PhoneLink } from "@/components/phone";

type Property = NonNullable<RunSheetJobRow["property"]>;

/** phone is only present once the run-sheet select asks for it — treat it as optional */
type RunSheetCustomer = NonNullable<Property["customer"]> & { phone?: string | null };

function fullAddress(p: Property) {
  return [p.address_line1, p.address_line2, `${p.city}, ${p.state} ${p.zip}`]
    .filter(Boolean)
    .join(", ");
}

const tapRow =
  "flex min-h-10 items-center gap-2 rounded-md border border-line bg-white px-2.5 py-1.5 text-sm text-ink transition-colors hover:border-denim hover:text-denim";

export function RunSheetCard({
  job,
  overdue = false,
}: {
  job: RunSheetJobRow;
  overdue?: boolean;
}) {
  const property = job.property;
  const cust: RunSheetCustomer | null | undefined = property?.customer;
  const address = property ? fullAddress(property) : null;

  return (
    <article
      className={`rounded-lg border bg-card p-3 md:p-4 ${
        overdue ? "border-danger/50" : "border-line"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 font-display text-base font-bold uppercase tracking-wide text-denim-ink md:text-lg">
            <Clock size={15} className="shrink-0 text-gold-deep" />
            {formatWindow(job.window_start, job.window_end)}
          </p>
          <h3 className="mt-0.5 text-sm font-semibold md:text-base">
            {job.title}
            {cust && (
              <Link
                href={`/customers/${cust.id}`}
                className="ml-1.5 font-medium text-denim hover:underline"
              >
                {customerName(cust)}
              </Link>
            )}
          </h3>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <StatusBadge status={job.status} />
          {overdue && (
            <span className="font-display text-xs font-semibold uppercase tracking-wider text-danger">
              {formatDate(job.scheduled_date)}
            </span>
          )}
        </div>
      </div>

      <div className="mt-2 flex gap-2">
        {address ? (
          <a
            href={`https://maps.google.com/?q=${encodeURIComponent(address)}`}
            target="_blank"
            rel="noopener noreferrer"
            className={`${tapRow} min-w-0 flex-1`}
          >
            <MapPin size={15} className="shrink-0 text-gold-deep" />
            <span className="min-w-0 flex-1 truncate">{address}</span>
          </a>
        ) : (
          <p className="flex-1 py-1.5 text-sm text-ink-soft">No address on file.</p>
        )}
        {cust?.phone && (
          <PhoneLink
            phone={cust.phone}
            iconOnly
            iconSize={16}
            className={`${tapRow} w-10 shrink-0 justify-center`}
          />
        )}
      </div>

      {property?.access_notes && (
        <div className="mt-2 flex gap-2 rounded-md border border-gold/60 bg-gold/10 px-2.5 py-1.5">
          <KeyRound size={15} className="mt-0.5 shrink-0 text-gold-deep" />
          <p className="min-w-0 text-sm font-medium">{property.access_notes}</p>
        </div>
      )}

      <div className="mt-2 flex items-center justify-between gap-2 border-t border-line pt-2">
        <p className="flex items-center gap-1.5 text-sm text-ink-soft">
          <User size={13} className="shrink-0" />
          {job.assigned ? job.assigned.full_name : "Unassigned"}
        </p>
        <JobActions id={job.id} status={job.status} />
      </div>

      {job.completion_notes && (
        <p className="mt-1.5 text-sm text-ink-soft">Notes: {job.completion_notes}</p>
      )}
    </article>
  );
}
