// Bulk-pull a FieldRoutes endpoint's full records into a local JSON file so
// we can query the copy freely instead of burning the 50-reads/day API limit.
//
// Usage:
//   node scripts/pull-fieldroutes.mjs <endpoint> [search-param=value ...]
//
// Examples:
//   node scripts/pull-fieldroutes.mjs customer
//   node scripts/pull-fieldroutes.mjs appointment dateStart=2026-01-01 dateEnd=2026-08-05
//
// Output: data/fieldroutes/<endpoint>.json  (gitignored — contains customer PII)
// API cost: 1 search + ceil(count/1000) get calls.

import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

function loadEnv() {
  let text;
  try {
    text = readFileSync(new URL("../.env.import", import.meta.url), "utf8");
  } catch {
    console.error("Missing .env.import in repo root.");
    process.exit(1);
  }
  const vars = {};
  for (const line of text.split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) vars[m[1]] = m[2].trim();
  }
  return vars;
}

const env = loadEnv();
const args = process.argv.slice(2);
// --budget=N stops pulling once N daily reads are used (default 48, API cap is 50)
let readBudget = 48;
const paramArgs = args.filter((a) => {
  const m = a.match(/^--budget=(\d+)$/);
  if (m) { readBudget = Number(m[1]); return false; }
  return true;
});
const [endpoint, ...searchArgs] = paramArgs;
if (!endpoint) {
  console.log("Usage: node scripts/pull-fieldroutes.mjs <endpoint> [search-param=value ...] [--budget=N]");
  process.exit(1);
}

async function call(action, extraParams) {
  const params = new URLSearchParams({
    authenticationKey: env.FIELDROUTES_KEY,
    authenticationToken: env.FIELDROUTES_TOKEN,
    ...extraParams,
  });
  const res = await fetch(
    `https://${env.FIELDROUTES_SUBDOMAIN}.fieldroutes.com/api/${endpoint}/${action}`,
    { method: "POST", body: params }
  );
  const data = await res.json();
  if (data.success === false || data.success === "false") {
    console.error(`FieldRoutes error on ${endpoint}/${action}: ${data.errorMessage ?? "unknown"}`);
    process.exit(1);
  }
  return data;
}

const searchParams = Object.fromEntries(
  searchArgs.map((p) => {
    const i = p.indexOf("=");
    if (i === -1) { console.error(`Bad param "${p}" — expected key=value`); process.exit(1); }
    return [p.slice(0, i), p.slice(i + 1)];
  })
);

// Stop before the API's 50/day read limit so there's always headroom left.
const READ_BUDGET = readBudget;

const search = await call("search", searchParams);
const ids = search[search.propertyName] ?? [];
const idName = search.idName;
const usedAfterSearch = Number(search.tokenUsage?.requestsReadToday ?? 0);
console.log(`${endpoint}/search: ${ids.length} IDs, needs ${Math.ceil(ids.length / 1000)} get calls (${usedAfterSearch}/${READ_BUDGET} budget used)`);
if (usedAfterSearch >= READ_BUDGET) {
  console.error("Daily read budget exhausted — skipping fetch. Re-run tomorrow.");
  process.exit(1);
}

const records = [];
let truncated = false;
for (let i = 0; i < ids.length; i += 1000) {
  const chunk = ids.slice(i, i + 1000);
  const got = await call("get", { [idName]: JSON.stringify(chunk) });
  records.push(...(got[got.propertyName] ?? []));
  const used = Number(got.tokenUsage?.requestsReadToday ?? 0);
  console.log(`  fetched ${records.length}/${ids.length} (${used}/${READ_BUDGET} budget used)`);
  if (used >= READ_BUDGET && i + 1000 < ids.length) {
    truncated = true;
    console.error(`  BUDGET HIT — saving the ${records.length} records fetched so far; re-run tomorrow for the rest.`);
    break;
  }
  // stay under 20 requests/min on big pulls
  if (i + 1000 < ids.length) await new Promise((r) => setTimeout(r, 3200));
}

const outDir = fileURLToPath(new URL("../data/fieldroutes/", import.meta.url));
mkdirSync(outDir, { recursive: true });
const outFile = `${outDir}${endpoint}.json`;
writeFileSync(
  outFile,
  JSON.stringify({ pulledAt: new Date().toISOString(), endpoint, searchParams, truncated, count: records.length, records }, null, 1)
);
console.log(`Saved ${records.length} ${endpoint} records -> data/fieldroutes/${endpoint}.json`);
