import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { customerName, type Customer } from "@/lib/types";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = (q ?? "").trim();

  const supabase = await createClient();
  let request = supabase
    .from("customers")
    .select("*")
    .order("last_name")
    .order("company_name")
    .limit(200);

  if (query) {
    const like = `%${query}%`;
    request = request.or(
      `first_name.ilike.${like},last_name.ilike.${like},company_name.ilike.${like},email.ilike.${like},phone.ilike.${like}`
    );
  }

  const { data, error } = await request;
  if (error) throw new Error(`Failed to load customers: ${error.message}`);
  const customers = (data ?? []) as Customer[];

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex items-end justify-between">
        <h1 className="font-display text-4xl font-bold uppercase tracking-wide text-denim-ink">
          Customers
        </h1>
        <Link href="/customers/new" className="btn-primary">
          <Plus size={16} /> New customer
        </Link>
      </div>

      <form className="relative mt-6 max-w-md">
        <Search
          size={16}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft"
        />
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Search name, company, phone, email…"
          className="field pl-9"
        />
      </form>

      <div className="mt-4 overflow-hidden rounded-lg border border-line bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-gold/60 bg-denim-ink text-left text-white">
              <th className="px-4 py-2.5 font-display font-semibold uppercase tracking-wider">Name</th>
              <th className="px-4 py-2.5 font-display font-semibold uppercase tracking-wider">Type</th>
              <th className="px-4 py-2.5 font-display font-semibold uppercase tracking-wider">Phone</th>
              <th className="hidden px-4 py-2.5 font-display font-semibold uppercase tracking-wider md:table-cell">
                Email
              </th>
              <th className="px-4 py-2.5 font-display font-semibold uppercase tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody>
            {customers.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-ink-soft">
                  {query ? `No customers match "${query}".` : "No customers yet — add the first one."}
                </td>
              </tr>
            )}
            {customers.map((c) => (
              <tr key={c.id} className="border-b border-line last:border-b-0 hover:bg-denim/5">
                <td className="px-4 py-2.5">
                  <Link
                    href={`/customers/${c.id}`}
                    className="font-semibold text-denim hover:underline"
                  >
                    {customerName(c)}
                  </Link>
                </td>
                <td className="px-4 py-2.5 capitalize text-ink-soft">{c.type}</td>
                <td className="px-4 py-2.5">{c.phone ?? "—"}</td>
                <td className="hidden px-4 py-2.5 md:table-cell">{c.email ?? "—"}</td>
                <td className="px-4 py-2.5">
                  <span
                    className={`font-display text-xs font-semibold uppercase tracking-wider ${
                      c.status === "active" ? "text-ok" : "text-ink-soft"
                    }`}
                  >
                    {c.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
