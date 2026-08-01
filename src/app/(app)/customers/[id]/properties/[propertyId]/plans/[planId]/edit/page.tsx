import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { updatePlan } from "@/lib/actions/plans";
import { customerName, type Customer, type Property, type ServicePlan } from "@/lib/types";
import { frequencyOptions } from "../../../../../../planFrequency";

export default async function EditPlanPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; propertyId: string; planId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id, propertyId, planId } = await params;
  const { error } = await searchParams;

  const supabase = await createClient();
  // match on every id in the URL so a plan can't be edited through someone else's path
  const [{ data: plan }, { data: property }, { data: customer }] = await Promise.all([
    supabase
      .from("service_plans")
      .select("*")
      .eq("id", planId)
      .eq("property_id", propertyId)
      .maybeSingle<ServicePlan>(),
    supabase
      .from("properties")
      .select("*")
      .eq("id", propertyId)
      .eq("customer_id", id)
      .maybeSingle<Property>(),
    supabase.from("customers").select("*").eq("id", id).maybeSingle<Customer>(),
  ]);
  if (!plan || !property || !customer) notFound();

  const errorMessage: Record<string, string> = {
    plan_missing: "Plan name and start date are required.",
    plan_frequency: "Pick a service frequency.",
    plan_price: "Enter the price as a positive dollar amount, like 129.50.",
  };

  return (
    <div className="mx-auto max-w-xl">
      <Link
        href={`/customers/${id}`}
        className="inline-flex items-center gap-1.5 text-sm text-ink-soft hover:text-denim"
      >
        <ArrowLeft size={14} /> {customerName(customer)}
      </Link>
      <h1 className="mt-2 font-display text-4xl font-bold uppercase tracking-wide text-denim-ink">
        Edit plan
      </h1>
      <p className="mt-1 text-ink-soft">
        {property.address_line1}, {property.city}
      </p>

      {error && (
        <p className="mt-4 rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
          {errorMessage[error] ?? `Couldn't save: ${error}`}
        </p>
      )}

      <form
        action={updatePlan}
        className="mt-6 space-y-4 rounded-lg border border-line bg-card p-6"
      >
        <input type="hidden" name="id" value={plan.id} />
        <input type="hidden" name="property_id" value={propertyId} />
        <input type="hidden" name="customer_id" value={id} />

        <div>
          <label className="label" htmlFor="name">Plan name</label>
          <input id="name" name="name" required className="field" defaultValue={plan.name} />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="label" htmlFor="frequency">Frequency</label>
            <select
              id="frequency"
              name="frequency"
              className="field"
              defaultValue={plan.frequency}
            >
              {frequencyOptions.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="price">Price</label>
            <input
              id="price"
              name="price"
              type="number"
              min="0"
              step="0.01"
              className="field"
              defaultValue={(plan.price_cents / 100).toFixed(2)}
            />
          </div>
          <div>
            <label className="label" htmlFor="start_date">Starts</label>
            <input
              id="start_date"
              name="start_date"
              type="date"
              required
              className="field"
              defaultValue={plan.start_date}
            />
          </div>
        </div>

        <div>
          <label className="label" htmlFor="notes">Notes</label>
          <input id="notes" name="notes" className="field" defaultValue={plan.notes ?? ""} />
        </div>

        <label className="flex items-start gap-2 text-sm" htmlFor="active">
          <input
            id="active"
            name="active"
            type="checkbox"
            defaultChecked={plan.active}
            className="mt-0.5 h-4 w-4 accent-denim"
          />
          <span>
            Active
            <span className="block text-xs text-ink-soft">
              Inactive plans stay on the customer record but are no longer billed or serviced.
            </span>
          </span>
        </label>

        <div className="flex gap-2">
          <button type="submit" className="btn-primary">Save plan</button>
          <Link href={`/customers/${id}`} className="btn-ghost">Cancel</Link>
        </div>
      </form>
    </div>
  );
}
