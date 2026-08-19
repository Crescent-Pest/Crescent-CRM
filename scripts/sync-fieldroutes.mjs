// Crescent CRM -> FieldRoutes outbox worker. Runs locally, never deployed.
//
// Usage:
//   node scripts/sync-fieldroutes.mjs                        # dry run (default)
//   node scripts/sync-fieldroutes.mjs --limit=10             # dry run, 10 customers max
//   node scripts/sync-fieldroutes.mjs --live --allow-write   # actually push
//
// Credentials load from .env.import in the repo root (gitignored):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY — service role bypasses RLS, which
//     is why this script must stay local-only
//   FIELDROUTES_SUBDOMAIN, FIELDROUTES_KEY, FIELDROUTES_TOKEN — live pushes only
//
// The CRM is the source of truth. Server actions enqueue rows into
// fieldroutes_sync_queue (supabase/migrations/007_fieldroutes_sync.sql); a queue
// row only means "this customer changed", so the current customer row is read
// here at sync time and changed_fields is audit trail, not payload.
//
// Writes are double-gated: --live opts into calling FieldRoutes at all, and
// --allow-write is the same guard scripts/fieldroutes.mjs uses, so pushing for
// real is always a deliberate two-flag act. --limit caps FieldRoutes write calls
// per run — the daily write budget is 250, shared with anything else on the key.

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const QUEUE_TABLE = "fieldroutes_sync_queue";
const DEFAULT_LIMIT = 25;
const DAILY_WRITE_BUDGET = 250;
const MAX_ATTEMPTS = 3;
// stay under 20 requests/min when a run pushes several customers
const THROTTLE_MS = 3200;
// generous: many queue rows coalesce into far fewer pushes
const QUEUE_SCAN_LIMIT = 500;

const USAGE =
  "Usage: node scripts/sync-fieldroutes.mjs [--limit=N] [--live --allow-write]";

// ---------- args ----------
const flags = { live: false, allowWrite: false, limit: DEFAULT_LIMIT };
for (const a of process.argv.slice(2)) {
  const limit = a.match(/^--limit=(\d+)$/);
  if (a === "--live") flags.live = true;
  else if (a === "--allow-write") flags.allowWrite = true;
  else if (limit) flags.limit = Number(limit[1]);
  else {
    console.error(`Unknown argument "${a}"`);
    console.log(USAGE);
    process.exit(1);
  }
}

if (flags.limit < 1) {
  console.error("--limit must be at least 1");
  process.exit(1);
}
if (flags.live && !flags.allowWrite) {
  console.error(
    "--live writes real customer data to FieldRoutes. Re-run with --live --allow-write if you really mean it."
  );
  process.exit(1);
}

// ---------- credentials ----------
function loadEnv() {
  const path = new URL("../.env.import", import.meta.url);
  let text;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    console.error("Missing .env.import in repo root — see its template comments. Nothing synced.");
    process.exit(1);
  }
  const vars = {};
  for (const line of text.split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) vars[m[1]] = m[2].trim();
  }
  // a dry run reads the queue but never calls FieldRoutes, so it needs no FR keys
  const needed = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];
  if (flags.live) {
    needed.push("FIELDROUTES_SUBDOMAIN", "FIELDROUTES_KEY", "FIELDROUTES_TOKEN");
  }
  for (const name of needed) {
    if (!vars[name] || vars[name].startsWith("paste-")) {
      console.error(`${name} not filled in yet — open .env.import and paste the real value.`);
      process.exit(1);
    }
  }
  return vars;
}

// ---------- mapping: CRM -> FieldRoutes ----------
const CUSTOMER_COLUMNS =
  "id, type, status, first_name, last_name, company_name, email, phone, phone_alt, " +
  "fieldroutes_id, billing_address_line1, billing_city, billing_state, billing_zip";

/**
 * Reverse of mapCustomer() in scripts/import-fieldroutes.mjs.
 * Empty values are left out rather than sent blank: an empty param reads as
 * "erase this field" to FieldRoutes, and a v1 push should never wipe their data
 * as a side effect of a CRM field simply being unset.
 */
function mapCustomerParams(customer, property) {
  const params = {};
  const put = (key, value) => {
    const text = value === null || value === undefined ? "" : String(value).trim();
    if (text !== "") params[key] = text;
  };

  if (customer.fieldroutes_id) put("customerID", customer.fieldroutes_id);
  put("fname", customer.first_name);
  put("lname", customer.last_name);
  put("companyName", customer.company_name);
  put("email", customer.email);
  put("phone1", customer.phone);
  put("phone2", customer.phone_alt);
  // service address = the first active property, the same one the CRM's
  // customer page preselects for scheduling
  if (property) {
    put("address", property.address_line1);
    put("city", property.city);
    put("state", property.state);
    put("zip", property.zip);
  }
  put("billingAddress", customer.billing_address_line1);
  put("billingCity", customer.billing_city);
  put("billingState", customer.billing_state);
  put("billingZip", customer.billing_zip);
  // both flags are always meaningful, so they skip the empty-value check
  params.commercialAccount = customer.type === "commercial" ? "1" : "0";
  params.status = customer.status === "inactive" ? "0" : "1";
  return params;
}

function customerLabel(customer) {
  return (
    customer.company_name ||
    `${customer.first_name} ${customer.last_name}`.trim() ||
    customer.id
  );
}

/** FieldRoutes returns a new record's id in `result`; accept the obvious aliases. */
function createdCustomerId(data) {
  const id = Number(data.customerID ?? data.result ?? data.customerIDs?.[0]);
  return Number.isFinite(id) && id > 0 ? id : null;
}

// ---------- queue ----------
async function loadPendingGroups(supabase) {
  const { data, error } = await supabase
    .from(QUEUE_TABLE)
    .select("id, entity_id, changed_fields, attempts")
    .eq("entity", "customer")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(QUEUE_SCAN_LIMIT);
  if (error) throw error;

  // several edits to one customer collapse into a single push; every row in the
  // group is then marked with that push's outcome
  const groups = new Map();
  for (const row of data ?? []) {
    const group = groups.get(row.entity_id) ?? { entityId: row.entity_id, rows: [] };
    group.rows.push(row);
    groups.set(row.entity_id, group);
  }
  return [...groups.values()];
}

async function readCustomer(supabase, customerId) {
  const { data: customer, error } = await supabase
    .from("customers")
    .select(CUSTOMER_COLUMNS)
    .eq("id", customerId)
    .maybeSingle();
  if (error) throw error;
  if (!customer) return { customer: null, property: null };

  const { data: properties, error: propertyError } = await supabase
    .from("properties")
    .select("address_line1, city, state, zip")
    .eq("customer_id", customerId)
    .eq("active", true)
    .order("created_at", { ascending: true })
    .limit(1);
  if (propertyError) throw propertyError;

  return { customer, property: properties?.[0] ?? null };
}

async function markSkipped(supabase, rows, reason) {
  const { error } = await supabase
    .from(QUEUE_TABLE)
    .update({ status: "skipped", last_error: reason })
    .in("id", rows.map((r) => r.id));
  if (error) console.error(`  could not mark queue rows skipped: ${error.message}`);
}

async function markSynced(supabase, rows, createdId) {
  const syncedAt = new Date().toISOString();
  for (const row of rows) {
    const patch = { status: "synced", synced_at: syncedAt, last_error: null };
    // a create's new FieldRoutes id lands on the queue row too, so the audit
    // trail shows which push minted it
    if (createdId) {
      patch.changed_fields = { ...(row.changed_fields ?? {}), fieldroutes_id: createdId };
    }
    const { error } = await supabase.from(QUEUE_TABLE).update(patch).eq("id", row.id);
    if (error) console.error(`  could not mark queue row ${row.id} synced: ${error.message}`);
  }
}

/** Bump attempts per row; a row that has burned all its attempts parks at
 *  'failed' and is skipped by later runs until someone resets it by hand. */
async function markFailed(supabase, rows, message) {
  for (const row of rows) {
    const attempts = row.attempts + 1;
    const { error } = await supabase
      .from(QUEUE_TABLE)
      .update({
        attempts,
        last_error: message,
        status: attempts >= MAX_ATTEMPTS ? "failed" : "pending",
      })
      .eq("id", row.id);
    if (error) console.error(`  could not record failure on queue row ${row.id}: ${error.message}`);
  }
}

// ---------- FieldRoutes ----------
async function callFieldRoutes(env, action, params) {
  const body = new URLSearchParams({
    authenticationKey: env.FIELDROUTES_KEY,
    authenticationToken: env.FIELDROUTES_TOKEN,
    ...params,
  });
  const res = await fetch(
    `https://${env.FIELDROUTES_SUBDOMAIN}.fieldroutes.com/api/customer/${action}`,
    { method: "POST", body }
  );
  const text = await res.text();

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`non-JSON response (HTTP ${res.status}): ${text.slice(0, 200)}`);
  }
  // FieldRoutes echoes request params back, auth pair included — strip them so
  // credentials never reach the terminal or the queue's last_error column
  if (data.params) {
    delete data.params.authenticationKey;
    delete data.params.authenticationToken;
  }
  if (data.success === false || data.success === "false") {
    throw new Error(data.errorMessage ?? JSON.stringify(data).slice(0, 200));
  }
  return data;
}

// ---------- main ----------
async function main() {
  const env = loadEnv();
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

  const groups = await loadPendingGroups(supabase);
  if (groups.length === 0) {
    console.log("Nothing pending in the FieldRoutes outbox.");
    return;
  }

  const queuedRows = groups.reduce((n, g) => n + g.rows.length, 0);
  const batch = groups.slice(0, flags.limit);
  console.log(
    `${queuedRows} pending queue rows -> ${groups.length} customers; this run handles ${batch.length} ` +
      `(--limit=${flags.limit}, daily FieldRoutes write budget ${DAILY_WRITE_BUDGET}).`
  );
  console.log(
    flags.live
      ? "LIVE — these changes will be written to FieldRoutes."
      : "DRY RUN — nothing remote is touched and the queue is left alone. Add --live --allow-write to push."
  );

  let pushed = 0;
  let failed = 0;
  let skipped = 0;

  for (const [index, group] of batch.entries()) {
    const { customer, property } = await readCustomer(supabase, group.entityId);
    if (!customer) {
      console.log(`  skip ${group.entityId} — customer row no longer exists`);
      if (flags.live) await markSkipped(supabase, group.rows, "customer row no longer exists");
      skipped++;
      continue;
    }

    // re-derived rather than taken from the queue row: an earlier create in this
    // same run may already have given the customer its FieldRoutes id
    const action = customer.fieldroutes_id ? "update" : "create";
    const params = mapCustomerParams(customer, property);
    const label = customerLabel(customer);
    const rowCount = `${group.rows.length} queue row${group.rows.length === 1 ? "" : "s"}`;

    if (!property) {
      console.log(`  note: ${label} has no active property — sending no service address`);
    }

    if (!flags.live) {
      console.log(`  [dry run] customer/${action} — ${label} (${rowCount})`);
      console.log(`    ${JSON.stringify(params)}`);
      continue;
    }

    try {
      const data = await callFieldRoutes(env, action, params);
      let createdId = null;
      if (action === "create") {
        createdId = createdCustomerId(data);
        if (!createdId) {
          throw new Error(
            `create reported success but returned no customerID: ${JSON.stringify(data).slice(0, 200)}`
          );
        }
        const { error } = await supabase
          .from("customers")
          .update({ fieldroutes_id: createdId })
          .eq("id", customer.id);
        // the FieldRoutes record exists either way; a storage failure here means
        // the next run would create a duplicate, so it must surface as a failure
        if (error) {
          throw new Error(
            `FieldRoutes created customerID ${createdId} but storing it failed: ${error.message}`
          );
        }
      }
      await markSynced(supabase, group.rows, createdId);
      console.log(
        `  customer/${action} ok — ${label}${createdId ? ` (new customerID ${createdId})` : ""} (${rowCount})`
      );
      pushed++;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.error(`  customer/${action} FAILED — ${label}: ${message}`);
      await markFailed(supabase, group.rows, message);
      failed++;
    }

    if (index < batch.length - 1) await new Promise((r) => setTimeout(r, THROTTLE_MS));
  }

  if (flags.live) {
    console.log(`Pushed ${pushed}, failed ${failed}, skipped ${skipped}.`);
    if (failed > 0) {
      console.log(
        `Failed pushes retry on the next run; after ${MAX_ATTEMPTS} attempts a row parks at status='failed' until reset by hand.`
      );
    }
  } else {
    const wouldPush = batch.length - skipped;
    console.log(
      `Dry run complete — ${wouldPush} customer${wouldPush === 1 ? "" : "s"} would be pushed` +
        `${skipped > 0 ? `, ${skipped} skipped` : ""}. Re-run with --live --allow-write to send.`
    );
  }
  if (groups.length > batch.length) {
    console.log(`${groups.length - batch.length} more customers still queued — re-run to continue.`);
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
