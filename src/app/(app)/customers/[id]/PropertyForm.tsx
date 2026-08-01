import { Plus } from "lucide-react";
import { addProperty } from "@/lib/actions/customers";

export function PropertyForm({ customerId }: { customerId: string }) {
  return (
    <details className="group rounded-lg border border-dashed border-line bg-card">
      <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 font-display text-sm font-semibold uppercase tracking-wider text-denim [&::-webkit-details-marker]:hidden">
        <Plus size={15} className="transition-transform group-open:rotate-45" />
        Add service address
      </summary>
      <form action={addProperty} className="space-y-3 border-t border-line px-4 py-4">
        <input type="hidden" name="customer_id" value={customerId} />
        <div>
          <label className="label" htmlFor="label">Label</label>
          <input id="label" name="label" className="field" placeholder="Home, Rental, Office…" />
        </div>
        <div>
          <label className="label" htmlFor="address_line1">Street address</label>
          <input id="address_line1" name="address_line1" required className="field" />
        </div>
        <div>
          <label className="label" htmlFor="address_line2">Unit / suite</label>
          <input id="address_line2" name="address_line2" className="field" />
        </div>
        <div className="grid grid-cols-[2fr_1fr_1fr] gap-3">
          <div>
            <label className="label" htmlFor="city">City</label>
            <input id="city" name="city" required className="field" />
          </div>
          <div>
            <label className="label" htmlFor="state">State</label>
            <input id="state" name="state" defaultValue="SC" className="field" />
          </div>
          <div>
            <label className="label" htmlFor="zip">Zip</label>
            <input id="zip" name="zip" required className="field" />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="access_notes">Access notes</label>
          <input
            id="access_notes"
            name="access_notes"
            className="field"
            placeholder="Gate code, pets, key location…"
          />
        </div>
        <button type="submit" className="btn-primary">Save address</button>
      </form>
    </details>
  );
}
