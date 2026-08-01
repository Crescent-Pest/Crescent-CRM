import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { updateCustomer } from "@/lib/actions/customers";
import { customerName, type Customer } from "@/lib/types";

export default async function EditCustomerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;

  const supabase = await createClient();
  const { data: customer } = await supabase
    .from("customers")
    .select("*")
    .eq("id", id)
    .single<Customer>();
  if (!customer) notFound();

  return (
    <div className="mx-auto max-w-xl">
      <Link
        href={`/customers/${customer.id}`}
        className="inline-flex items-center gap-1.5 text-sm text-ink-soft hover:text-denim"
      >
        <ArrowLeft size={14} /> {customerName(customer)}
      </Link>
      <h1 className="mt-2 font-display text-4xl font-bold uppercase tracking-wide text-denim-ink">
        Edit customer
      </h1>

      {error && (
        <p className="mt-4 rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
          {error === "name"
            ? "A residential customer needs a first or last name; a commercial customer needs a company name."
            : `Couldn't save: ${error}`}
        </p>
      )}

      <form
        action={updateCustomer}
        className="mt-6 space-y-4 rounded-lg border border-line bg-card p-6"
      >
        <input type="hidden" name="id" value={customer.id} />

        <div>
          <label htmlFor="type" className="label">Type</label>
          <select id="type" name="type" className="field" defaultValue={customer.type}>
            <option value="residential">Residential</option>
            <option value="commercial">Commercial</option>
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="first_name" className="label">First name</label>
            <input
              id="first_name"
              name="first_name"
              className="field"
              defaultValue={customer.first_name}
            />
          </div>
          <div>
            <label htmlFor="last_name" className="label">Last name</label>
            <input
              id="last_name"
              name="last_name"
              className="field"
              defaultValue={customer.last_name}
            />
          </div>
        </div>

        <div>
          <label htmlFor="company_name" className="label">
            Company name <span className="normal-case tracking-normal">(commercial only)</span>
          </label>
          <input
            id="company_name"
            name="company_name"
            className="field"
            defaultValue={customer.company_name}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="phone" className="label">Phone</label>
            <input
              id="phone"
              name="phone"
              type="tel"
              className="field"
              defaultValue={customer.phone ?? ""}
            />
          </div>
          <div>
            <label htmlFor="phone_alt" className="label">Alt phone</label>
            <input
              id="phone_alt"
              name="phone_alt"
              type="tel"
              className="field"
              defaultValue={customer.phone_alt ?? ""}
            />
          </div>
        </div>

        <div>
          <label htmlFor="email" className="label">Email</label>
          <input
            id="email"
            name="email"
            type="email"
            className="field"
            defaultValue={customer.email ?? ""}
          />
        </div>

        <div>
          <label htmlFor="source" className="label">How did they find us?</label>
          <input
            id="source"
            name="source"
            className="field"
            placeholder="Referral, Google, yard sign…"
            defaultValue={customer.source ?? ""}
          />
        </div>

        <div className="flex gap-2">
          <button type="submit" className="btn-primary">Save changes</button>
          <Link href={`/customers/${customer.id}`} className="btn-ghost">Cancel</Link>
        </div>
      </form>
    </div>
  );
}
