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
      className={`rounded-lg border bg-card p-4 ${
        overdue ? "border-danger/50" : "border-line"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 font-display text-lg font-bold uppercase tracking-wide text-denim-ink">
            <Clock size={16} className="shrink-0 text-gold-deep" />
            {formatWindow(job.window_start, job.window_end)}
          </p>
          <h3 className="mt-1 text-base font-semibold">{job.title}</h3>
          {cust && (
            <Link
              href={`/customers/${cust.id}`}
              className="text-sm font-medium text-denim hover:underline"
            >
              {customerName(cust)}
            </Link>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <StatusBadge status={job.status} />
          {overdue && (
            <span className="font-display text-xs font-semibold uppercase tracking-wider text-danger">
              {formatDate(job.scheduled_date)}
            </span>
          )}
        </div>
      </div>

      {address ? (
        <a
          href={`https://maps.google.com/?q=${encodeURIComponent(address)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 flex min-h-11 items-center gap-2 rounded-md border border-line bg-white px-3 py-2 text-sm text-ink transition-colors hover:border-denim hover:text-denim"
        >
          <MapPin size={16} className="shrink-0 text-gold-deep" />
          <span className="min-w-0 flex-1">{address}</span>
        </a>
      ) : (
        <p className="mt-3 text-sm text-ink-soft">No address on file.</p>
      )}

      {cust?.phone && (
        <PhoneLink
          phone={cust.phone}
          icon
          iconSize={16}
          className="mt-2 flex min-h-11 items-center gap-2 rounded-md border border-line bg-white px-3 py-2 text-sm text-ink transition-colors hover:border-denim hover:text-denim"
        />
      )}

      {property?.access_notes && (
        <div className="mt-3 flex gap-2 rounded-md border border-gold/60 bg-gold/10 px-3 py-2">
          <KeyRound size={16} className="mt-0.5 shrink-0 text-gold-deep" />
          <div className="min-w-0">
            <p className="label mb-0.5">Access</p>
            <p className="text-sm font-medium">{property.access_notes}</p>
          </div>
        </div>
      )}

      <p className="mt-3 flex items-center gap-2 text-sm text-ink-soft">
        <User size={14} className="shrink-0" />
        {job.assigned ? job.assigned.full_name : "Unassigned"}
      </p>

      {job.completion_notes && (
        <p className="mt-2 text-sm text-ink-soft">
          Notes: {job.completion_notes}
        </p>
      )}

      <div className="mt-3 border-t border-line pt-3">
        <JobActions id={job.id} status={job.status} />
      </div>
    </article>
  );
}
