// FieldRoutes -> Crescent CRM importer (skeleton).
//
// Usage (run locally, never deployed):
//   node scripts/import-fieldroutes.mjs stage <file.csv> --entity customer --label "july export"
//   node scripts/import-fieldroutes.mjs review <batch-id>
//   node scripts/import-fieldroutes.mjs apply <batch-id>
//
// Requires env vars (put them in .env.import, which is gitignored):
//   SUPABASE_URL                — https://rfihahqbgakanjqisnbv.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY   — Dashboard -> Settings -> API Keys -> secret key
//     (service role bypasses RLS; that's why this script must stay local-only)
//   FIELDROUTES_KEY / FIELDROUTES_TOKEN — for API sync, once Sean provides them
//
// IMPORTANT: the column names in mapCustomer() are educated guesses at
// FieldRoutes CSV export headers. Verify against a real export before the
// first apply — this is deliberately the only place mapping lives.

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

// ---------- tiny CSV parser (handles quoted fields + embedded commas) ----------
function parseCSV(text) {
  const rows = [];
  let row = [], field = "", inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') inQuotes = false;
      else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((f) => f !== "")) rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  const [header, ...data] = rows;
  return data.map((r) =>
    Object.fromEntries(header.map((h, i) => [h.trim(), (r[i] ?? "").trim()]))
  );
}

// ---------- mappers: FieldRoutes export row -> CRM shape ----------
// VERIFY these header names against a real FieldRoutes export.
function mapCustomer(row) {
  const isCommercial = Boolean(row.companyName);
  return {
    fieldroutes_id: Number(row.customerID),
    type: isCommercial ? "commercial" : "residential",
    first_name: row.fname ?? "",
    last_name: row.lname ?? "",
    company_name: row.companyName ?? "",
    email: row.email || null,
    phone: row.phone1 || null,
    phone_alt: row.phone2 || null,
    status: row.status === "0" || /inactive/i.test(row.status ?? "") ? "inactive" : "active",
    billing_address_line1: row.billingAddress || null,
    billing_city: row.billingCity || null,
    billing_state: row.billingState || null,
    billing_zip: row.billingZip || null,
    // service address becomes a property row during apply
    _property: row.address
      ? { address_line1: row.address, city: row.city, state: row.state || "SC", zip: row.zip }
      : null,
  };
}

const mappers = { customer: mapCustomer };

// ---------- helpers ----------
function env(name) {
  const v = process.env[name];
  if (!v) { console.error(`Missing env var ${name} (see header comment)`); process.exit(1); }
  return v;
}

function makeClient() {
  return createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"));
}

function arg(flag, fallback = null) {
  const i = process.argv.indexOf(flag);
  return i > -1 ? process.argv[i + 1] : fallback;
}

// ---------- commands ----------
async function stage(file) {
  const entity = arg("--entity", "customer");
  const mapper = mappers[entity];
  if (!mapper) { console.error(`No mapper for entity "${entity}" yet`); process.exit(1); }

  // Accepts either a FieldRoutes CSV export or a JSON dump produced by
  // Crescent-Inspect's pull-fieldroutes.mjs ({records: [...]}).
  const rows = file.endsWith(".json")
    ? JSON.parse(readFileSync(file, "utf8")).records
    : parseCSV(readFileSync(file, "utf8"));
  console.log(`Parsed ${rows.length} rows from ${file}`);

  const supabase = makeClient();
  const { data: batch, error: batchErr } = await supabase
    .from("import_batches")
    .insert({ source: "csv", label: arg("--label", file) })
    .select("id")
    .single();
  if (batchErr) throw batchErr;

  const staged = rows.map((row) => {
    const mapped = mapper(row);
    return {
      batch_id: batch.id,
      entity,
      external_id: Number.isFinite(mapped.fieldroutes_id) ? mapped.fieldroutes_id : null,
      payload: { raw: row, mapped },
    };
  });

  for (let i = 0; i < staged.length; i += 500) {
    const { error } = await supabase.from("import_staging").insert(staged.slice(i, i + 500));
    if (error) throw error;
  }
  console.log(`Staged ${staged.length} ${entity} rows in batch ${batch.id}`);
  console.log(`Next: node scripts/import-fieldroutes.mjs review ${batch.id}`);
}

async function review(batchId) {
  const supabase = makeClient();
  const { data, error } = await supabase
    .from("import_staging")
    .select("entity, external_id, payload, status")
    .eq("batch_id", batchId);
  if (error) throw error;

  const problems = [];
  for (const r of data) {
    const m = r.payload.mapped;
    if (!r.external_id) problems.push(`missing FieldRoutes id: ${JSON.stringify(r.payload.raw).slice(0, 80)}`);
    if (r.entity === "customer" && !m.first_name && !m.last_name && !m.company_name)
      problems.push(`no name at all for FR id ${r.external_id}`);
    if (r.entity === "customer" && !m._property)
      problems.push(`no service address for FR id ${r.external_id}`);
  }
  console.log(`${data.length} staged rows, ${problems.length} problems`);
  problems.slice(0, 25).forEach((p) => console.log(`  - ${p}`));
  if (problems.length > 25) console.log(`  ...and ${problems.length - 25} more`);
}

async function apply(batchId) {
  const supabase = makeClient();
  const { data, error } = await supabase
    .from("import_staging")
    .select("id, entity, external_id, payload")
    .eq("batch_id", batchId)
    .eq("status", "pending");
  if (error) throw error;

  let imported = 0, failed = 0;
  for (const r of data) {
    const { _property, ...customer } = r.payload.mapped;
    // upsert on fieldroutes_id makes re-runs safe
    const { data: c, error: cErr } = await supabase
      .from("customers")
      .upsert(customer, { onConflict: "fieldroutes_id" })
      .select("id")
      .single();

    let pErr = null;
    if (!cErr && _property) {
      ({ error: pErr } = await supabase
        .from("properties")
        .upsert(
          { ...(_property), customer_id: c.id, fieldroutes_id: r.external_id },
          { onConflict: "fieldroutes_id" }
        ));
    }

    const err = cErr ?? pErr;
    await supabase
      .from("import_staging")
      .update({ status: err ? "error" : "imported", error: err?.message ?? null })
      .eq("id", r.id);
    err ? failed++ : imported++;
  }

  await supabase
    .from("import_batches")
    .update({ finished_at: new Date().toISOString(), summary: { imported, failed } })
    .eq("id", batchId);
  console.log(`Imported ${imported}, failed ${failed}. Failures stay in staging with status=error.`);
}

// ---------- main ----------
const [, , command, target] = process.argv;
const commands = { stage, review, apply };
if (!commands[command] || !target) {
  console.log("Usage: node scripts/import-fieldroutes.mjs <stage file.csv | review batch-id | apply batch-id>");
  process.exit(1);
}
commands[command](target).catch((e) => { console.error(e); process.exit(1); });
