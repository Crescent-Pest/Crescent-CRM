import { Plus } from "lucide-react";
import { createPlan } from "@/lib/actions/plans";
import { todayISO } from "@/lib/format";
import { frequencyOptions } from "../planFrequency";

export function PlanForm({
  customerId,
  propertyId,
}: {
  customerId: string;
  propertyId: string;
}) {
  // several of these render per page, so field ids have to stay unique
  const uid = (name: string) => `${name}-${propertyId}`;

  return (
    <details className="group mt-3 rounded-md border border-dashed border-line">
      <summary className="flex cursor-pointer items-center gap-2 px-3 py-2 font-display text-xs font-semibold uppercase tracking-wider text-denim [&::-webkit-details-marker]:hidden">
        <Plus size={14} className="transition-transform group-open:rotate-45" />
        Add plan
      </summary>
      <form action={createPlan} className="space-y-3 border-t border-line px-3 py-3">
        <input type="hidden" name="customer_id" value={customerId} />
        <input type="hidden" name="property_id" value={propertyId} />

        <div>
          <label className="label" htmlFor={uid("name")}>Plan name</label>
          <input
            id={uid("name")}
            name="name"
            required
            className="field"
            placeholder="Quarterly pest control…"
          />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="label" htmlFor={uid("frequency")}>Frequency</label>
            <select
              id={uid("frequency")}
              name="frequency"
              className="field"
              defaultValue="quarterly"
            >
              {frequencyOptions.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor={uid("price")}>Price</label>
            <input
              id={uid("price")}
              name="price"
              type="number"
              min="0"
              step="0.01"
              className="field"
              placeholder="0.00"
            />
          </div>
          <div>
            <label className="label" htmlFor={uid("start_date")}>Starts</label>
            <input
              id={uid("start_date")}
              name="start_date"
              type="date"
              required
              defaultValue={todayISO()}
              className="field"
            />
          </div>
        </div>

        <div>
          <label className="label" htmlFor={uid("notes")}>Notes</label>
          <input
            id={uid("notes")}
            name="notes"
            className="field"
            placeholder="Covers ants, roaches, spiders…"
          />
        </div>

        <button type="submit" className="btn-primary">Save plan</button>
      </form>
    </details>
  );
}
