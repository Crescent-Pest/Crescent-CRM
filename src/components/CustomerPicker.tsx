"use client";

import { useEffect, useState } from "react";
import { Building2, Loader2, MapPin, PenLine, Search, User, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  customerDisplayName,
  propertyAddress,
  searchCustomers,
  type CustomerLink,
  type CustomerMatch,
  type PropertyMatch,
} from "@/lib/customers";

const DEBOUNCE_MS = 300;
const MIN_QUERY_CHARS = 2;

/**
 * Search-and-pick a CRM customer, optionally with one of their properties.
 * Linking is always optional — an empty picker is a first-class state.
 * `suggestedName` pre-fills the search (e.g. a name the AI heard in a note)
 * so the tech can confirm with one tap; it never auto-links.
 */
export function CustomerPicker({
  value,
  onChange,
  suggestedName,
  fallbackName,
  onFallbackNameChange,
}: {
  value: CustomerLink | null;
  onChange: (link: CustomerLink | null) => void;
  /** Seed for the search box — shown for one-tap confirm, never auto-linked. */
  suggestedName?: string | null;
  /** Provide both fallback props to offer a "not in the system yet" free-text name. */
  fallbackName?: string;
  onFallbackNameChange?: (name: string) => void;
}) {
  const [query, setQuery] = useState(() => (!value && suggestedName ? suggestedName : ""));
  // latest completed search, tagged with the query it answered — everything
  // else (searching flag, visible results) derives from it
  const [search, setSearch] = useState<{
    q: string;
    matches: CustomerMatch[];
    error: string | null;
  }>({ q: "", matches: [], error: null });
  const [pending, setPending] = useState<CustomerMatch | null>(null);
  const [showFallback, setShowFallback] = useState(false);

  const hasFallback = typeof onFallbackNameChange === "function";
  const q = query.trim();
  const searchable = q.length >= MIN_QUERY_CHARS;
  const current = searchable && search.q === q;
  const searching = searchable && !current;
  const results = current ? search.matches : [];
  const searchError = current ? search.error : null;

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < MIN_QUERY_CHARS) return;
    let stale = false;
    const timer = setTimeout(async () => {
      try {
        const matches = await searchCustomers(createClient(), trimmed);
        if (!stale) setSearch({ q: trimmed, matches, error: null });
      } catch {
        if (!stale) {
          setSearch({
            q: trimmed,
            matches: [],
            error: "Customer search failed. Check your connection and try again.",
          });
        }
      }
    }, DEBOUNCE_MS);
    return () => {
      stale = true;
      clearTimeout(timer);
    };
  }, [query]);

  function link(customer: CustomerMatch, property: PropertyMatch | null) {
    setPending(null);
    setQuery("");
    setShowFallback(false);
    onFallbackNameChange?.("");
    onChange({ customer, property });
  }

  function pick(customer: CustomerMatch) {
    // several properties → let the tech pick; zero or one → just link it
    if (customer.properties.length > 1) setPending(customer);
    else link(customer, customer.properties[0] ?? null);
  }

  if (value) {
    const Icon = value.customer.type === "commercial" ? Building2 : User;
    return (
      <div className="flex items-start gap-2.5 rounded-md border border-denim/40 bg-denim/5 px-3 py-2.5">
        <Icon size={18} className="mt-0.5 shrink-0 text-denim" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-ink">
            {customerDisplayName(value.customer)}
          </p>
          <p className="truncate text-xs text-ink-soft">
            {value.property ? propertyAddress(value.property) : "No property linked"}
            {value.customer.phone ? ` · ${value.customer.phone}` : ""}
          </p>
        </div>
        <button
          type="button"
          aria-label="Remove customer link"
          onClick={() => onChange(null)}
          className="flex min-h-8 min-w-8 shrink-0 items-center justify-center rounded-md text-ink-soft transition-colors hover:text-danger"
        >
          <X size={17} />
        </button>
      </div>
    );
  }

  if (pending) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-ink">
          <span className="font-semibold">{customerDisplayName(pending)}</span>
          <span className="text-ink-soft"> — which property?</span>
        </p>
        <ul className="space-y-1.5">
          {pending.properties.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => link(pending, p)}
                className="flex w-full items-center gap-2 rounded-md border border-line bg-white px-3 py-2.5 text-left transition-colors hover:border-denim"
              >
                <MapPin size={15} className="shrink-0 text-denim" />
                <span className="min-w-0 text-sm text-ink">
                  {p.label && <span className="font-semibold">{p.label} · </span>}
                  {propertyAddress(p)}
                </span>
              </button>
            </li>
          ))}
        </ul>
        <div className="flex gap-2">
          <button type="button" onClick={() => link(pending, null)} className="btn-ghost flex-1">
            Skip — customer only
          </button>
          <button type="button" onClick={() => setPending(null)} className="btn-ghost flex-1">
            Back
          </button>
        </div>
      </div>
    );
  }

  const suggestionActive = Boolean(suggestedName && q && q === suggestedName.trim());

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search
          size={16}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft"
        />
        <input
          type="text"
          inputMode="search"
          aria-label="Search customers"
          className="field pl-9 pr-9"
          placeholder="Search name, company, or phone"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {searching ? (
          <Loader2
            size={16}
            className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-denim"
          />
        ) : (
          query && (
            <button
              type="button"
              aria-label="Clear customer search"
              onClick={() => setQuery("")}
              className="absolute right-1 top-1/2 flex min-h-8 min-w-8 -translate-y-1/2 items-center justify-center text-ink-soft transition-colors hover:text-ink"
            >
              <X size={15} />
            </button>
          )
        )}
      </div>

      {suggestionActive && (
        <p className="text-xs text-ink-soft">
          Name heard in the note — tap the right match to confirm, or clear the search.
        </p>
      )}
      {!q && (
        <p className="text-xs text-ink-soft">Optional — leave empty to save without a customer.</p>
      )}
      {searchError && <p className="text-xs text-danger">{searchError}</p>}
      {!searching && !searchError && q.length >= MIN_QUERY_CHARS && results.length === 0 && (
        <p className="text-xs text-ink-soft">No matching customers in the system.</p>
      )}

      {results.length > 0 && (
        <ul className="space-y-1.5">
          {results.map((c) => {
            const Icon = c.type === "commercial" ? Building2 : User;
            const hint = c.properties[0] ? propertyAddress(c.properties[0]) : null;
            const extra = c.properties.length > 1 ? ` (+${c.properties.length - 1} more)` : "";
            return (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => pick(c)}
                  className="flex w-full items-start gap-2.5 rounded-md border border-line bg-white px-3 py-2.5 text-left transition-colors hover:border-denim"
                >
                  <Icon size={17} className="mt-0.5 shrink-0 text-denim" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-ink">
                      {customerDisplayName(c)}
                    </span>
                    <span className="block truncate text-xs text-ink-soft">
                      {([c.phone, hint].filter(Boolean).join(" · ") || "No phone or property on file") + extra}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {hasFallback &&
        (showFallback || fallbackName ? (
          <div>
            <label htmlFor="customer-fallback" className="label">
              Customer name (not in the system yet)
            </label>
            <input
              id="customer-fallback"
              type="text"
              className="field"
              placeholder="e.g. Mrs. Harper"
              value={fallbackName ?? ""}
              onChange={(e) => onFallbackNameChange?.(e.target.value)}
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowFallback(true)}
            className="inline-flex min-h-8 items-center gap-1.5 text-sm font-medium text-denim transition-colors hover:text-denim-deep"
          >
            <PenLine size={14} />
            Not in the system yet? Type the name
          </button>
        ))}
    </div>
  );
}
