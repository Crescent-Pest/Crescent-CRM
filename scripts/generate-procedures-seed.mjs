#!/usr/bin/env node
// Generates supabase/seed_procedures.sql from data/procedures-seed.json.
// Node only, zero dependencies:  node scripts/generate-procedures-seed.mjs
//
// data/procedures-seed.json is the single source of truth for manual content.
// Never hand-edit supabase/seed_procedures.sql; edit the JSON and re-run this.
//
// The JSON's `suggestions` array is validated but NOT emitted: in the CRM a
// suggestion targets one step and is authored by a real profiles row, so the
// standalone app's two anonymous demo notes have nowhere to land.

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SEED_JSON = path.join(root, "data", "procedures-seed.json");
const OUT_SQL = path.join(root, "supabase", "seed_procedures.sql");

// ------------------------------------------------------------------ escaping

/** Quote a text value as a Postgres string literal, or NULL. */
function text(value) {
  if (value === null || value === undefined) return "NULL";
  return `'${String(value).replace(/'/g, "''")}'`;
}

/** Quote a value as a jsonb literal. */
function jsonb(value) {
  return `${text(JSON.stringify(value ?? []))}::jsonb`;
}

/** Emit an integer literal, rejecting anything that is not a finite integer. */
function int(value, label) {
  if (!Number.isInteger(value)) {
    throw new Error(`Expected an integer for ${label}, got ${JSON.stringify(value)}`);
  }
  return String(value);
}

// ------------------------------------------------------------------ validation

function validate(seed) {
  const errors = [];
  const dupes = (label, ids) => {
    const seen = new Set();
    for (const id of ids) {
      if (seen.has(id)) errors.push(`duplicate ${label} id: ${id}`);
      seen.add(id);
    }
    return seen;
  };

  const procedureIds = dupes("procedure", seed.procedures.map((p) => p.id));
  const sectionIds = dupes("section", seed.sections.map((s) => s.id));
  dupes("step", seed.steps.map((s) => s.id));
  const chemicalIds = dupes("chemical", seed.chemicals.map((c) => c.id));

  for (const section of seed.sections) {
    if (!procedureIds.has(section.procedure_id)) {
      errors.push(`section ${section.id} references missing procedure ${section.procedure_id}`);
    }
  }
  for (const step of seed.steps) {
    if (!sectionIds.has(step.section_id)) {
      errors.push(`step ${step.id} references missing section ${step.section_id}`);
    }
    if (!["step", "warning", "tip"].includes(step.kind)) {
      errors.push(`step ${step.id} has invalid kind "${step.kind}"`);
    }
    if (![0, 1].includes(step.indent)) {
      errors.push(`step ${step.id} has invalid indent ${step.indent}`);
    }
    for (const id of step.chemical_ids) {
      if (!chemicalIds.has(id)) {
        errors.push(`step ${step.id} references missing chemical ${id}`);
      }
    }
  }
  for (const chemical of seed.chemicals) {
    if (!["repellent", "non-repellent", "n/a"].includes(chemical.repellency)) {
      errors.push(`chemical ${chemical.id} has invalid repellency "${chemical.repellency}"`);
    }
  }

  // positions must be 1..n with no gaps, per parent
  const groups = new Map();
  const group = (key, position) => {
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(position);
  };
  for (const section of seed.sections) group(`procedure:${section.procedure_id}`, section.position);
  for (const step of seed.steps) group(`section:${step.section_id}`, step.position);
  for (const [key, positions] of groups) {
    const sorted = [...positions].sort((a, b) => a - b);
    const expected = sorted.map((_, index) => index + 1);
    if (sorted.join(",") !== expected.join(",")) {
      errors.push(`${key} has non-sequential positions: ${sorted.join(",")}`);
    }
  }

  if (errors.length > 0) {
    throw new Error(`procedures-seed.json failed validation:\n  - ${errors.join("\n  - ")}`);
  }
}

// ------------------------------------------------------------------ rows

/**
 * Upsert rather than delete-and-reinsert: step_suggestions cascade off
 * procedure_steps, so wiping steps on a re-run would take real field
 * suggestions with them.
 */
function upsert(table, columns, rows) {
  if (rows.length === 0) return `-- no rows for ${table}\n`;
  const values = rows.map((row) => `  (${row.join(", ")})`).join(",\n");
  const updates = columns
    .filter((column) => column !== "id")
    .map((column) => `  ${column} = excluded.${column}`)
    .join(",\n");
  return (
    `insert into public.${table} (${columns.join(", ")}) values\n${values}\n` +
    `on conflict (id) do update set\n${updates};\n`
  );
}

function build(seed) {
  const blocks = [];

  blocks.push(
    upsert(
      "chemicals",
      ["id", "name", "epa_number", "category", "repellency", "mix_ratios", "notes"],
      seed.chemicals.map((c) => [
        text(c.id),
        text(c.name),
        text(c.epa_number),
        text(c.category),
        text(c.repellency),
        jsonb(c.mix_ratios),
        text(c.notes),
      ]),
    ),
  );

  blocks.push(
    upsert(
      "procedures",
      ["id", "slug", "title", "summary", "category", "frequency", "sort", "updated_at"],
      seed.procedures.map((p) => [
        text(p.id),
        text(p.slug),
        text(p.title),
        text(p.summary),
        text(p.category),
        text(p.frequency),
        int(p.sort, `procedures.sort (${p.id})`),
        text(p.updated_at),
      ]),
    ),
  );

  blocks.push(
    upsert(
      "procedure_sections",
      ["id", "procedure_id", "title", "position"],
      seed.sections.map((s) => [
        text(s.id),
        text(s.procedure_id),
        text(s.title),
        int(s.position, `sections.position (${s.id})`),
      ]),
    ),
  );

  blocks.push(
    upsert(
      "procedure_steps",
      ["id", "section_id", "content", "kind", "indent", "position", "chemical_ids"],
      seed.steps.map((s) => [
        text(s.id),
        text(s.section_id),
        text(s.content),
        text(s.kind),
        int(s.indent, `steps.indent (${s.id})`),
        int(s.position, `steps.position (${s.id})`),
        jsonb(s.chemical_ids),
      ]),
    ),
  );

  const header = [
    "-- GENERATED FILE - do not edit by hand.",
    "-- Source: data/procedures-seed.json",
    "-- Regenerate: node scripts/generate-procedures-seed.mjs",
    "--",
    "-- NOT APPLIED to the live database. Run supabase/migrations/008_procedures.sql",
    "-- first, then run this file in the Supabase SQL editor.",
    "--",
    "-- Rows are upserted by id, so re-running is safe and leaves field",
    "-- suggestions alone. Rows dropped from the JSON are NOT deleted here.",
    "",
    "begin;",
    "",
  ].join("\n");

  return `${header}\n${blocks.join("\n")}\ncommit;\n`;
}

// ------------------------------------------------------------------ main

const seed = JSON.parse(readFileSync(SEED_JSON, "utf8"));
validate(seed);
writeFileSync(OUT_SQL, build(seed), "utf8");

console.log(
  [
    `Wrote ${path.relative(root, OUT_SQL)}`,
    `  procedures: ${seed.procedures.length}`,
    `  sections:   ${seed.sections.length}`,
    `  steps:      ${seed.steps.length}`,
    `  chemicals:  ${seed.chemicals.length}`,
  ].join("\n"),
);
