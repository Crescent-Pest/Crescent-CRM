import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { updateProperty } from "@/lib/actions/customers";
import { customerName, type Customer, type Property } from "@/lib/types";

export default async function EditPropertyPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; propertyId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id, propertyId } = await params;
  const { error } = await searchParams;

  const supabase = await createClient();
  // match on both ids so a property can't be edited from another customer's URL
  const [{ data: property }, { data: customer }] = await Promise.all([
    supabase
      .from("properties")
      .select("*")
      .eq("id", propertyId)
      .eq("customer_id", id)
      .maybeSingle<Property>(),
    supabase.from("customers").select("*").eq("id", id).maybeSingle<Customer>(),
  ]);
  if (!property || !customer) notFound();

  return (
    <div className="mx-auto max-w-xl">
      <Link
        href={`/customers/${id}`}
        className="inline-flex items-center gap-1.5 text-sm text-ink-soft hover:text-denim"
      >
        <ArrowLeft size={14} /> {customerName(customer)}
      </Link>
      <h1 className="mt-2 font-display text-4xl font-bold uppercase tracking-wide text-denim-ink">
        Edit address
      </h1>

      {error && (
        <p className="mt-4 rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
          {error === "address"
            ? "Street address, city, and zip are required."
            : `Couldn't save: ${error}`}
        </p>
      )}

      <form
        action={updateProperty}
        className="mt-6 space-y-3 rounded-lg border border-line bg-card p-6"
      >
        <input type="hidden" name="id" value={property.id} />
        <input type="hidden" name="customer_id" value={id} />

        <div>
          <label className="label" htmlFor="label">Label</label>
          <input
            id="label"
            name="label"
            className="field"
            placeholder="Home, Rental, Office…"
            defaultValue={property.label}
          />
        </div>
        <div>
          <label className="label" htmlFor="address_line1">Street address</label>
          <input
            id="address_line1"
            name="address_line1"
            required
            className="field"
            defaultValue={property.address_line1}
          />
        </div>
        <div>
          <label className="label" htmlFor="address_line2">Unit / suite</label>
          <input
            id="address_line2"
            name="address_line2"
            className="field"
            defaultValue={property.address_line2 ?? ""}
          />
        </div>
        <div className="grid grid-cols-[2fr_1fr_1fr] gap-3">
          <div>
            <label className="label" htmlFor="city">City</label>
            <input id="city" name="city" required className="field" defaultValue={property.city} />
          </div>
          <div>
            <label className="label" htmlFor="state">State</label>
            <input id="state" name="state" className="field" defaultValue={property.state} />
          </div>
          <div>
            <label className="label" htmlFor="zip">Zip</label>
            <input id="zip" name="zip" required className="field" defaultValue={property.zip} />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="access_notes">Access notes</label>
          <input
            id="access_notes"
            name="access_notes"
            className="field"
            placeholder="Gate code, pets, key location…"
            defaultValue={property.access_notes ?? ""}
          />
        </div>

        <label className="flex items-start gap-2 pt-1 text-sm" htmlFor="active">
          <input
            id="active"
            name="active"
            type="checkbox"
            defaultChecked={property.active}
            className="mt-0.5 h-4 w-4 accent-denim"
          />
          <span>
            Active
            <span className="block text-xs text-ink-soft">
              Inactive addresses stay on file but stop showing up when scheduling new jobs.
            </span>
          </span>
        </label>

        <div className="flex gap-2 pt-1">
          <button type="submit" className="btn-primary">Save address</button>
          <Link href={`/customers/${id}`} className="btn-ghost">Cancel</Link>
        </div>
      </form>
    </div>
  );
}
