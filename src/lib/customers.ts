import type { SupabaseClient } from "@supabase/supabase-js";

/** CRM customer/property lookups shared by the capture and notes flows.
 * public.customers and public.properties are owned by Crescent-CRM —
 * this app only reads them (RLS: is_active_staff). */

export interface PropertyMatch {
  id: string;
  label: string;
  address_line1: string;
  address_line2: string | null;
  city: string;
  state: string;
  zip: string;
  active: boolean;
}

export interface CustomerMatch {
  id: string;
  type: "residential" | "commercial";
  first_name: string;
  last_name: string;
  company_name: string;
  phone: string | null;
  properties: PropertyMatch[];
}

/** A tech-confirmed link — customer always, property optional. */
export interface CustomerLink {
  customer: CustomerMatch;
  property: PropertyMatch | null;
}

/** Company name for commercial accounts, person name otherwise. */
export function customerDisplayName(c: {
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
}): string {
  const person = [c.first_name, c.last_name].filter(Boolean).join(" ").trim();
  return c.company_name?.trim() || person || "Unnamed customer";
}

export function propertyAddress(p: {
  address_line1: string;
  city: string | null;
}): string {
  return [p.address_line1, p.city].filter(Boolean).join(", ");
}

/** Words that show up in spoken names but never in CRM name columns. */
const HONORIFICS = new Set(["mr", "mrs", "ms", "miss", "dr", "mx"]);

const MAX_TOKENS = 4;
const SEARCH_LIMIT = 8;

/**
 * Search customers by name, company, or phone. Every word must match one of
 * the fields (chained .or() groups AND together in PostgREST), so "john sm"
 * finds John Smith. Characters with meaning in PostgREST's or() syntax are
 * stripped; honorifics are dropped so "Mrs. Harper" still finds Harper.
 */
export async function searchCustomers(
  supabase: SupabaseClient,
  rawQuery: string
): Promise<CustomerMatch[]> {
  const words = rawQuery
    .replace(/[,()."\\]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  const tokens = (
    words.length > 1 ? words.filter((w) => !HONORIFICS.has(w.toLowerCase())) : words
  ).slice(0, MAX_TOKENS);
  if (tokens.length === 0) return [];

  let query = supabase
    .from("customers")
    .select(
      "id, type, first_name, last_name, company_name, phone, " +
        "properties(id, label, address_line1, address_line2, city, state, zip, active)"
    )
    .limit(SEARCH_LIMIT);
  for (const token of tokens) {
    query = query.or(
      `first_name.ilike.%${token}%,last_name.ilike.%${token}%,` +
        `company_name.ilike.%${token}%,phone.ilike.%${token}%`
    );
  }

  const { data, error } = await query;
  if (error) throw error;

  return ((data ?? []) as unknown as CustomerMatch[])
    .map((m) => ({ ...m, properties: (m.properties ?? []).filter((p) => p.active) }))
    .sort((a, b) => customerDisplayName(a).localeCompare(customerDisplayName(b)));
}
