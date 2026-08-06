// FieldRoutes API query tool — read-only by design, runs locally only.
//
// Usage:
//   node scripts/fieldroutes.mjs <endpoint> <action> [param=value ...]
//
// Examples:
//   node scripts/fieldroutes.mjs customer search                      # all customer IDs
//   node scripts/fieldroutes.mjs customer get customerIDs=[12,34]     # full records (max 1000 IDs)
//   node scripts/fieldroutes.mjs appointment search dateStart=2026-08-01 dateEnd=2026-08-05
//
// Credentials load from .env.import in the repo root (gitignored).
// API reference: https://developer.fieldroutes.com
//
// Search actions return ID lists; feed those into the matching get action
// for full records. Write actions (create/update/etc.) are blocked unless
// --allow-write is passed, so exploratory queries can't touch live data.

import { readFileSync } from "node:fs";

const WRITE_ACTIONS = /create|update|delete|cancel|apply|add|change|complete|reschedule/i;

function loadEnv() {
  const path = new URL("../.env.import", import.meta.url);
  let text;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    console.error("Missing .env.import in repo root — see its template comments.");
    process.exit(1);
  }
  const vars = {};
  for (const line of text.split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) vars[m[1]] = m[2].trim();
  }
  for (const name of ["FIELDROUTES_SUBDOMAIN", "FIELDROUTES_KEY", "FIELDROUTES_TOKEN"]) {
    if (!vars[name] || vars[name].startsWith("paste-")) {
      console.error(`${name} not filled in yet — open .env.import and paste the real value.`);
      process.exit(1);
    }
  }
  return vars;
}

// Long ID arrays (search can return tens of thousands) get summarized so the
// output stays readable; pass --full to print everything.
function truncateArrays(value, limit) {
  if (Array.isArray(value)) {
    if (value.length > limit) {
      return [...value.slice(0, limit), `...(${value.length - limit} more, ${value.length} total; use --full to print all)`];
    }
    return value.map((v) => truncateArrays(v, limit));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, truncateArrays(v, limit)]));
  }
  return value;
}

const argv = process.argv.slice(2);
const flags = { full: false, allowWrite: false };
const positional = [];
for (const a of argv) {
  if (a === "--full") flags.full = true;
  else if (a === "--allow-write") flags.allowWrite = true;
  else positional.push(a);
}

const [endpoint, action, ...paramArgs] = positional;
if (!endpoint || !action) {
  console.log("Usage: node scripts/fieldroutes.mjs <endpoint> <action> [param=value ...] [--full] [--allow-write]");
  console.log("Common endpoints: customer, appointment, route, ticket, payment, subscription, employee, office");
  process.exit(1);
}

if (WRITE_ACTIONS.test(action) && !flags.allowWrite) {
  console.error(`Action "${action}" looks like a write. Re-run with --allow-write if you really mean it.`);
  process.exit(1);
}

const env = loadEnv();
const params = new URLSearchParams({
  authenticationKey: env.FIELDROUTES_KEY,
  authenticationToken: env.FIELDROUTES_TOKEN,
});
for (const p of paramArgs) {
  const i = p.indexOf("=");
  if (i === -1) { console.error(`Bad param "${p}" — expected key=value`); process.exit(1); }
  params.append(p.slice(0, i), p.slice(i + 1));
}

const url = `https://${env.FIELDROUTES_SUBDOMAIN}.fieldroutes.com/api/${endpoint}/${action}`;
const res = await fetch(url, { method: "POST", body: params });
const text = await res.text();

let data;
try {
  data = JSON.parse(text);
} catch {
  console.error(`Non-JSON response (HTTP ${res.status}) from ${endpoint}/${action}:`);
  console.error(text.slice(0, 500));
  process.exit(1);
}

// FieldRoutes echoes request params back, including the auth pair — strip
// them so credentials never land in terminal output or logs.
if (data.params) {
  delete data.params.authenticationKey;
  delete data.params.authenticationToken;
}

if (data.success === false || data.success === "false") {
  console.error(`FieldRoutes error on ${endpoint}/${action}: ${data.errorMessage ?? JSON.stringify(data)}`);
  process.exit(1);
}

console.log(JSON.stringify(flags.full ? data : truncateArrays(data, 100), null, 2));
