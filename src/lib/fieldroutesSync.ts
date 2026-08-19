import { createClient } from "@/lib/supabase/server";
import type { SyncQueueRow } from "@/lib/types";

/**
 * FieldRoutes outbox: enqueueing from server actions plus the read queries the
 * dashboard and customer page use to show queue health.
 *
 * The CRM is the source of truth; scripts/sync-fieldroutes.mjs drains the queue
 * and pushes to FieldRoutes. Enqueueing lives here (not in a DB trigger) so the
 * FieldRoutes import scripts can write the same tables without echoing back out.
 */

const QUEUE_TABLE = "fieldroutes_sync_queue";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Queue a customer for the next push. Never throws and never redirects: a
 * broken outbox must not cost staff their save, so failures are logged and
 * the caller carries on.
 */
export async function enqueueCustomerSync(
  supabase: ServerClient,
  customerId: string,
  changedFields: Record<string, unknown>,
) {
  try {
    // a customer FieldRoutes has never seen needs create, everyone else update;
    // the worker re-checks this at sync time in case the id lands first
    const { data, error: lookupError } = await supabase
      .from("customers")
      .select("fieldroutes_id")
      .eq("id", customerId)
      .single<{ fieldroutes_id: number | null }>();
    if (lookupError) throw lookupError;

    const { error } = await supabase.from(QUEUE_TABLE).insert({
      entity: "customer",
      entity_id: customerId,
      fr_action: data?.fieldroutes_id ? "update" : "create",
      changed_fields: changedFields,
    });
    if (error) throw error;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(`fieldroutes sync: enqueue failed for customer ${customerId}: ${message}`);
  }
}

export interface SyncQueueCounts {
  pending: number;
  failed: number;
}

/** Queue health for the dashboard card. Errors degrade to zero so a missing
 *  table (the migration is applied by hand) can't take the dashboard down. */
export async function fetchSyncQueueCounts(): Promise<SyncQueueCounts> {
  const supabase = await createClient();
  const [pending, failed] = await Promise.all([
    supabase
      .from(QUEUE_TABLE)
      .select("id", { count: "exact", head: true })
      .eq("status", "pending")
      .then(({ count }) => count ?? 0),
    supabase
      .from(QUEUE_TABLE)
      .select("id", { count: "exact", head: true })
      .eq("status", "failed")
      .then(({ count }) => count ?? 0),
  ]);
  return { pending, failed };
}

export interface CustomerSyncStatus extends SyncQueueCounts {
  /** most recent successful push, null if this customer has never synced */
  syncedAt: string | null;
  /** last_error of the newest failed row, for the "see last_error" hint */
  lastError: string | null;
}

const CUSTOMER_QUEUE_LIMIT = 50;

/** The one-line sync state shown on a customer's detail page. */
export async function fetchCustomerSyncStatus(
  customerId: string,
): Promise<CustomerSyncStatus> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from(QUEUE_TABLE)
    .select("status, last_error, synced_at")
    .eq("entity", "customer")
    .eq("entity_id", customerId)
    .order("created_at", { ascending: false })
    .limit(CUSTOMER_QUEUE_LIMIT);
  if (error) {
    console.error(`fieldroutes sync: status lookup failed for ${customerId}: ${error.message}`);
    return { pending: 0, failed: 0, syncedAt: null, lastError: null };
  }

  const rows = (data ?? []) as Pick<SyncQueueRow, "status" | "last_error" | "synced_at">[];
  return {
    pending: rows.filter((r) => r.status === "pending").length,
    failed: rows.filter((r) => r.status === "failed").length,
    syncedAt: rows.find((r) => r.status === "synced")?.synced_at ?? null,
    lastError: rows.find((r) => r.status === "failed")?.last_error ?? null,
  };
}
