import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createJob } from "@/lib/actions/jobs";
import { customerName, type Customer, type Profile, type Property } from "@/lib/types";
import { todayISO } from "@/lib/format";

interface PropertyOption extends Property {
  customer: Pick<Customer, "id" | "type" | "first_name" | "last_name" | "company_name"> | null;
}

export default async function NewJobPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; property?: string; estimate?: string }>;
}) {
  const { error, property, estimate } = await searchParams;
  const isEstimate = estimate === "1";
  const supabase = await createClient();

  const [{ data: propData }, { data: techData }] = await Promise.all([
    supabase
      .from("properties")
      .select("*, customer:customers(id, type, first_name, last_name, company_name)")
      .eq("active", true)
      .order("address_line1"),
    supabase.from("profiles").select("*").eq("active", true).order("full_name"),
  ]);
  const properties = (propData ?? []) as unknown as PropertyOption[];
  const techs = (techData ?? []) as Profile[];
  // ignore a stale/inactive ?property so the placeholder still forces a choice
  const preselected = properties.some((p) => p.id === property) ? property! : "";

  return (
    <div className="mx-auto max-w-xl">
      <Link
        href="/schedule"
        className="inline-flex items-center gap-1.5 text-sm text-ink-soft hover:text-denim"
      >
        <ArrowLeft size={14} /> Schedule
      </Link>
      <h1 className="mt-2 font-display text-4xl font-bold uppercase tracking-wide text-denim-ink">
        {isEstimate ? "New estimate" : "New job"}
      </h1>

      {error && (
        <p className="mt-4 rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
          {error === "missing"
            ? "Property, job title, and date are required."
            : `Couldn't save: ${error}`}
        </p>
      )}

      {properties.length === 0 ? (
        <p className="mt-6 rounded-lg border border-dashed border-line bg-card px-4 py-8 text-center text-ink-soft">
          No service addresses on file yet. Add a customer with an address first, then schedule a job.
        </p>
      ) : (
        <form action={createJob} className="mt-6 space-y-4 rounded-lg border border-line bg-card p-6">
          <div>
            <label htmlFor="property_id" className="label">Property</label>
            <select
              id="property_id"
              name="property_id"
              required
              className="field"
              defaultValue={preselected}
            >
              <option value="" disabled>
                Choose a service address…
              </option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.customer ? `${customerName(p.customer)} — ` : ""}
                  {p.address_line1}, {p.city}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="title" className="label">Job title</label>
            <input
              id="title"
              name="title"
              required
              className="field"
              defaultValue={isEstimate ? "Estimate" : undefined}
              placeholder="Quarterly service, termite inspection…"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label htmlFor="scheduled_date" className="label">Date</label>
              <input
                id="scheduled_date"
                name="scheduled_date"
                type="date"
                required
                defaultValue={todayISO()}
                className="field"
              />
            </div>
            <div>
              <label htmlFor="window_start" className="label">Window start</label>
              <input id="window_start" name="window_start" type="time" className="field" />
            </div>
            <div>
              <label htmlFor="window_end" className="label">Window end</label>
              <input id="window_end" name="window_end" type="time" className="field" />
            </div>
          </div>

          <div>
            <label htmlFor="assigned_to" className="label">Assign to</label>
            <select id="assigned_to" name="assigned_to" className="field" defaultValue="">
              <option value="">Unassigned</option>
              {techs.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.full_name} ({t.role})
                </option>
              ))}
            </select>
          </div>

          <button type="submit" className="btn-primary">Schedule job</button>
        </form>
      )}
    </div>
  );
}
