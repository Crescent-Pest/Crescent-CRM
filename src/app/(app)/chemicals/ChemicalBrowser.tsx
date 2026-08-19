"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { ChemicalCard } from "@/components/procedures/ChemicalCard";
import type { Chemical } from "@/lib/types";

const ALL = "__all__";

/** Everything a tech might type: name, EPA number, target, ratio, label notes. */
function haystack(chemical: Chemical) {
  return [
    chemical.name,
    chemical.epa_number ?? "",
    chemical.category,
    chemical.repellency,
    chemical.notes ?? "",
    ...chemical.mix_ratios.map((m) => `${m.context} ${m.ratio}`),
  ]
    .join(" ")
    .toLowerCase();
}

export function ChemicalBrowser({ chemicals }: { chemicals: Chemical[] }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState(ALL);

  const indexed = useMemo(
    () => chemicals.map((chemical) => ({ chemical, text: haystack(chemical) })),
    [chemicals],
  );

  const categories = useMemo(
    () => [...new Set(chemicals.map((c) => c.category))].sort(),
    [chemicals],
  );

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return indexed
      .filter(({ chemical, text }) => {
        if (category !== ALL && chemical.category !== category) return false;
        return q === "" || text.includes(q);
      })
      .map(({ chemical }) => chemical);
  }, [indexed, query, category]);

  return (
    <div>
      <div className="relative mt-4">
        <Search
          size={16}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft"
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Name, EPA number, target, ratio"
          aria-label="Search chemicals"
          autoComplete="off"
          className="field pl-9"
        />
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {[ALL, ...categories].map((name) => {
          const active = category === name;
          return (
            <button
              key={name}
              type="button"
              onClick={() => setCategory(active ? ALL : name)}
              aria-pressed={active}
              className={`rounded-full border px-3 py-1.5 font-display text-xs font-semibold uppercase tracking-wider transition-colors ${
                active
                  ? "border-gold bg-gold/25 text-denim-ink"
                  : "border-line bg-white text-ink-soft hover:border-denim hover:text-denim"
              }`}
            >
              {name === ALL ? "All" : name}
            </button>
          );
        })}
      </div>

      <p aria-live="polite" className="mt-3 text-xs text-ink-soft">
        {results.length} of {chemicals.length} products
      </p>

      {results.length === 0 ? (
        <div className="mt-3 rounded-lg border border-dashed border-line bg-card px-4 py-6 text-center">
          <p className="text-ink-soft">
            Nothing matches that. Try the product name, or clear the filters.
          </p>
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setCategory(ALL);
            }}
            className="btn-ghost btn-tap mt-3"
          >
            Reset filters
          </button>
        </div>
      ) : (
        <div className="mt-3 grid gap-3">
          {results.map((chemical) => (
            <ChemicalCard key={chemical.id} chemical={chemical} />
          ))}
        </div>
      )}
    </div>
  );
}
