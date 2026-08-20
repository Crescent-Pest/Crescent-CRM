import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client for work that runs with no user session — right
 * now only the 7am digest cron (src/app/api/cron/digest/route.ts).
 *
 * This key bypasses RLS entirely, so nothing that serves a browser request may
 * import this module; "server-only" makes that a build error rather than a leak.
 * Returns null when the key isn't configured so callers can degrade instead of
 * crashing at import time.
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;

  return createSupabaseClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
