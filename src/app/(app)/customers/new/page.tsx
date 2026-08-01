import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createCustomer } from "@/lib/actions/customers";

export default async function NewCustomerPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="mx-auto max-w-xl">
      <Link
        href="/customers"
        className="inline-flex items-center gap-1.5 text-sm text-ink-soft hover:text-denim"
      >
        <ArrowLeft size={14} /> Customers
      </Link>
      <h1 className="mt-2 font-display text-4xl font-bold uppercase tracking-wide text-denim-ink">
        New customer
      </h1>

      {error && (
        <p className="mt-4 rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
          {error === "name"
            ? "A residential customer needs a first or last name; a commercial customer needs a company name."
            : `Couldn't save: ${error}`}
        </p>
      )}

      <form action={createCustomer} className="mt-6 space-y-4 rounded-lg border border-line bg-card p-6">
        <div>
          <label htmlFor="type" className="label">Type</label>
          <select id="type" name="type" className="field" defaultValue="residential">
            <option value="residential">Residential</option>
            <option value="commercial">Commercial</option>
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="first_name" className="label">First name</label>
            <input id="first_name" name="first_name" className="field" />
          </div>
          <div>
            <label htmlFor="last_name" className="label">Last name</label>
            <input id="last_name" name="last_name" className="field" />
          </div>
        </div>

        <div>
          <label htmlFor="company_name" className="label">
            Company name <span className="normal-case tracking-normal">(commercial only)</span>
          </label>
          <input id="company_name" name="company_name" className="field" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="phone" className="label">Phone</label>
            <input id="phone" name="phone" type="tel" className="field" />
          </div>
          <div>
            <label htmlFor="phone_alt" className="label">Alt phone</label>
            <input id="phone_alt" name="phone_alt" type="tel" className="field" />
          </div>
        </div>

        <div>
          <label htmlFor="email" className="label">Email</label>
          <input id="email" name="email" type="email" className="field" />
        </div>

        <div>
          <label htmlFor="source" className="label">How did they find us?</label>
          <input id="source" name="source" className="field" placeholder="Referral, Google, yard sign…" />
        </div>

        <button type="submit" className="btn-primary">Save customer</button>
      </form>
    </div>
  );
}
