import type { Chemical } from "@/lib/types";

/**
 * The products a step names, with the first mix ratio inline — the number a
 * tech actually needs while standing at the truck.
 */
export function ChemicalChips({
  ids,
  chemicals,
}: {
  ids: string[];
  chemicals: Map<string, Chemical>;
}) {
  const found = ids
    .map((id) => chemicals.get(id))
    .filter((c): c is Chemical => Boolean(c));
  if (found.length === 0) return null;

  return (
    <ul className="mt-1.5 flex flex-wrap gap-1.5">
      {found.map((chemical) => (
        <li
          key={chemical.id}
          className="inline-flex items-baseline gap-1.5 rounded-md border border-denim/25 bg-denim/5 px-2 py-1"
        >
          <span className="font-display text-xs font-semibold uppercase tracking-wider text-denim">
            {chemical.name}
          </span>
          {chemical.mix_ratios[0] && (
            <span className="text-xs text-ink-soft">
              {chemical.mix_ratios[0].ratio}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
