import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MapPin, Phone, Mail, CalendarPlus, Pencil } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { addNote, setCustomerStatus } from "@/lib/actions/customers";
import { formatDate, formatMoney, formatWindow } from "@/lib/format";
import { customerName, type Customer, type Job, type Property, type ServicePlan } from "@/lib/types";
import { StatusBadge } from "@/components/StatusBadge";
import { PhoneLink } from "@/components/phone";
import { frequencyLabel } from "../planFrequency";
import { PropertyForm } from "./PropertyForm";
import { PlanForm } from "./PlanForm";

interface PropertyWithPlans extends Property {
  service_plans: ServicePlan[];
}

interface NoteRow {
  id: string;
  body: string;
  created_at: string;
  author: { full_name: string } | null;
}

const errorMessage: Record<string, string> = {
  address: "Street address, city, and zip are required.",
  plan_missing: "Plan name and start date are required.",
  plan_frequency: "Pick a service frequency.",
  plan_price: "Enter the price as a positive dollar amount, like 129.50.",
};

export default async function CustomerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error: formError } = await searchParams;
  const supabase = await createClient();

  const { data: customer } = await supabase
    .from("customers")
    .select("*")
    .eq("id", id)
    .single<Customer>();
  if (!customer) notFound();

  const { data: propData } = await supabase
    .from("properties")
    .select("*, service_plans(*)")
    .eq("customer_id", id)
    .order("created_at");
  const properties = (propData ?? []) as PropertyWithPlans[];
  const propertyIds = properties.map((p) => p.id);

  const [{ data: jobData }, { data: noteData }] = await Promise.all([
    propertyIds.length
      ? supabase
          .from("jobs")
          .select("*")
          .in("property_id", propertyIds)
          .order("scheduled_date", { ascending: false })
          .limit(10)
      : Promise.resolve({ data: [] as Job[] }),
    supabase
      .from("customer_notes")
      .select("id, body, created_at, author:profiles(full_name)")
      .eq("customer_id", id)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);
  const jobs = (jobData ?? []) as Job[];
  const notes = (noteData ?? []) as unknown as NoteRow[];
  const addressById = new Map(properties.map((p) => [p.id, p.address_line1]));
  // header button preselects the address staff will almost always mean
  const firstActive = properties.find((p) => p.active);
  const scheduleHref = firstActive
    ? `/schedule/new?property=${firstActive.id}`
    : "/schedule/new";

  return (
    <div className="mx-auto max-w-5xl">
      <Link
        href="/customers"
        className="inline-flex items-center gap-1.5 text-sm text-ink-soft hover:text-denim"
      >
        <ArrowLeft size={14} /> Customers
      </Link>

      <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold uppercase tracking-wide text-denim-ink md:text-4xl">
            {customerName(customer)}
          </h1>
          <p className="mt-1 capitalize text-ink-soft">
            {customer.type}
            {customer.source && ` · via ${customer.source}`}
            {customer.status === "inactive" && (
              <span className="ml-2 font-display text-xs font-bold uppercase tracking-wider text-danger">
                Inactive
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href={`/customers/${customer.id}/edit`} className="btn-ghost">
            <Pencil size={14} /> Edit
          </Link>
          <form action={setCustomerStatus}>
            <input type="hidden" name="id" value={customer.id} />
            <input
              type="hidden"
              name="status"
              value={customer.status === "active" ? "inactive" : "active"}
            />
            <button type="submit" className="btn-ghost">
              {customer.status === "active" ? "Mark inactive" : "Reactivate"}
            </button>
          </form>
          <Link href={scheduleHref} className="btn-primary">
            <CalendarPlus size={16} /> Schedule job
          </Link>
        </div>
      </div>

      {formError && (
        <p className="mt-4 rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
          {errorMessage[formError] ?? `Couldn't save: ${formError}`}
        </p>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-6">
          <section>
            <h2 className="mb-2 font-display text-lg font-bold uppercase tracking-wide text-denim-ink">
              Service addresses
            </h2>
            <div className="space-y-3">
              {properties.length === 0 && (
                <p className="rounded-lg border border-dashed border-line bg-card px-4 py-6 text-center text-sm text-ink-soft">
                  No addresses yet — add one below to schedule jobs.
                </p>
              )}
              {properties.map((p) => (
                <div key={p.id} className="rounded-lg border border-line bg-card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="flex flex-wrap items-center gap-2 font-semibold">
                      <MapPin size={15} className="text-gold-deep" />
                      {p.address_line1}
                      {p.address_line2 && `, ${p.address_line2}`}
                      <span className="font-normal text-ink-soft">
                        {p.city}, {p.state} {p.zip}
                      </span>
                      {p.label && (
                        <span className="rounded-full bg-denim/10 px-2 py-0.5 font-display text-xs font-semibold uppercase tracking-wider text-denim">
                          {p.label}
                        </span>
                      )}
                      {!p.active && (
                        <span className="font-display text-xs font-bold uppercase tracking-wider text-ink-soft">
                          Inactive
                        </span>
                      )}
                    </p>
                    <div className="flex shrink-0 items-center gap-3 text-sm">
                      <Link
                        href={`/schedule/new?property=${p.id}`}
                        className="inline-flex items-center gap-1 text-ink-soft hover:text-denim"
                      >
                        <CalendarPlus size={13} /> Schedule job
                      </Link>
                      <Link
                        href={`/customers/${customer.id}/properties/${p.id}/edit`}
                        className="inline-flex items-center gap-1 text-ink-soft hover:text-denim"
                      >
                        <Pencil size={13} /> Edit
                      </Link>
                    </div>
                  </div>
                  {p.access_notes && (
                    <p className="mt-1.5 text-sm text-ink-soft">Access: {p.access_notes}</p>
                  )}
                  {/* active plans first so cancelled ones sink to the bottom of the card */}
                  {[...p.service_plans]
                    .sort((a, b) => Number(b.active) - Number(a.active))
                    .map((sp) => (
                    <p
                      key={sp.id}
                      className={`mt-1.5 flex flex-wrap items-center gap-x-1.5 text-sm ${
                        sp.active ? "" : "opacity-60"
                      }`}
                    >
                      <span className={sp.active ? "font-semibold text-denim" : "font-semibold"}>
                        {sp.name}
                      </span>
                      <span className="text-ink-soft">
                        · {frequencyLabel[sp.frequency] ?? sp.frequency} ·{" "}
                        {formatMoney(sp.price_cents)}
                      </span>
                      {!sp.active && (
                        <span className="font-display text-xs font-bold uppercase tracking-wider text-ink-soft">
                          Inactive
                        </span>
                      )}
                      <Link
                        href={`/customers/${customer.id}/properties/${p.id}/plans/${sp.id}/edit`}
                        aria-label={`Edit ${sp.name}`}
                        className="text-ink-soft hover:text-denim"
                      >
                        <Pencil size={12} />
                      </Link>
                    </p>
                  ))}
                  <PlanForm customerId={customer.id} propertyId={p.id} />
                </div>
              ))}
              <PropertyForm customerId={customer.id} />
            </div>
          </section>

          <section>
            <h2 className="mb-2 font-display text-lg font-bold uppercase tracking-wide text-denim-ink">
              Job history
            </h2>
            {jobs.length === 0 ? (
              <p className="rounded-lg border border-dashed border-line bg-card px-4 py-6 text-center text-sm text-ink-soft">
                No jobs yet for this customer.
              </p>
            ) : (
              <ul className="rounded-lg border border-line bg-card">
                {jobs.map((j) => (
                  <li key={j.id} className="border-b border-line last:border-b-0">
                    <Link
                      href={`/jobs/${j.id}/edit`}
                      className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 hover:bg-denim/5"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold">{j.title}</p>
                        <p className="truncate text-sm text-ink-soft">
                          {addressById.get(j.property_id) ?? "—"} ·{" "}
                          {formatWindow(j.window_start, j.window_end)}
                        </p>
                      </div>
                      <span className="text-sm text-ink-soft">{formatDate(j.scheduled_date)}</span>
                      <StatusBadge status={j.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="space-y-6">
          <section className="rounded-lg border border-line bg-card p-4">
            <h2 className="mb-3 font-display text-sm font-bold uppercase tracking-wider text-ink-soft">
              Contact
            </h2>
            <div className="space-y-2 text-sm">
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <Phone size={14} className="text-denim" />
                {customer.phone ? <PhoneLink phone={customer.phone} /> : "No phone"}
                {customer.phone_alt && (
                  <span className="text-ink-soft">
                    ·{" "}
                    <PhoneLink
                      phone={customer.phone_alt}
                      className="text-ink-soft hover:text-denim hover:underline"
                    />
                  </span>
                )}
              </p>
              <p className="flex items-center gap-2">
                <Mail size={14} className="text-denim" />
                {customer.email ?? "No email"}
              </p>
            </div>
          </section>

          <section>
            <h2 className="mb-2 font-display text-lg font-bold uppercase tracking-wide text-denim-ink">
              Notes
            </h2>
            <form action={addNote} className="rounded-lg border border-line bg-card p-3">
              <input type="hidden" name="customer_id" value={customer.id} />
              <textarea
                name="body"
                required
                rows={2}
                className="field resize-y"
                placeholder="Log a call, complaint, follow-up…"
              />
              <button type="submit" className="btn-primary mt-2">Add note</button>
            </form>
            <ul className="mt-3 space-y-2">
              {notes.map((n) => (
                <li key={n.id} className="rounded-lg border border-line bg-card px-3 py-2.5">
                  <p className="text-sm">{n.body}</p>
                  <p className="mt-1 text-xs text-ink-soft">
                    {n.author?.full_name ?? "Staff"} · {formatDate(n.created_at.slice(0, 10))}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
