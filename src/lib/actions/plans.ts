"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { PlanFrequency } from "@/lib/types";

function str(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function orNull(value: string) {
  return value === "" ? null : value;
}

/** Unchecked checkboxes are absent from FormData entirely */
function checked(formData: FormData, key: string) {
  return formData.get(key) !== null;
}

// Record keyed by the enum so TypeScript flags drift if plan_frequency changes
const FREQUENCIES: Record<PlanFrequency, true> = {
  one_time: true,
  monthly: true,
  bimonthly: true,
  quarterly: true,
  semiannual: true,
  annual: true,
};

function planFrequency(value: string): PlanFrequency | null {
  return value in FREQUENCIES ? (value as PlanFrequency) : null;
}

/** "$1,250.50" -> 125050. Returns null for junk or negative amounts. */
function priceCents(value: string): number | null {
  if (value === "") return 0;
  const dollars = parseFloat(value.replace(/[$,\s]/g, ""));
  if (!Number.isFinite(dollars) || dollars < 0) return null;
  return Math.round(dollars * 100);
}

export async function createPlan(formData: FormData) {
  const property_id = str(formData, "property_id");
  const customer_id = str(formData, "customer_id");
  if (!property_id || !customer_id) redirect("/customers");

  const customerPath = `/customers/${customer_id}`;
  const name = str(formData, "name");
  const start_date = str(formData, "start_date");
  if (!name || !start_date) {
    redirect(`${customerPath}?error=plan_missing`);
  }

  const frequency = planFrequency(str(formData, "frequency"));
  if (!frequency) redirect(`${customerPath}?error=plan_frequency`);

  const price_cents = priceCents(str(formData, "price"));
  if (price_cents === null) redirect(`${customerPath}?error=plan_price`);

  const supabase = await createClient();
  const { error } = await supabase.from("service_plans").insert({
    property_id,
    name,
    frequency,
    price_cents,
    start_date,
    notes: orNull(str(formData, "notes")),
  });

  if (error) {
    redirect(`${customerPath}?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath(customerPath);
  redirect(customerPath);
}

export async function updatePlan(formData: FormData) {
  const id = str(formData, "id");
  const property_id = str(formData, "property_id");
  const customer_id = str(formData, "customer_id");
  if (!id || !property_id || !customer_id) redirect("/customers");

  const customerPath = `/customers/${customer_id}`;
  const editPath = `${customerPath}/properties/${property_id}/plans/${id}/edit`;

  const name = str(formData, "name");
  const start_date = str(formData, "start_date");
  if (!name || !start_date) redirect(`${editPath}?error=plan_missing`);

  const frequency = planFrequency(str(formData, "frequency"));
  if (!frequency) redirect(`${editPath}?error=plan_frequency`);

  const price_cents = priceCents(str(formData, "price"));
  if (price_cents === null) redirect(`${editPath}?error=plan_price`);

  const supabase = await createClient();
  const { error } = await supabase
    .from("service_plans")
    .update({
      name,
      frequency,
      price_cents,
      start_date,
      notes: orNull(str(formData, "notes")),
      active: checked(formData, "active"),
    })
    .eq("id", id)
    .eq("property_id", property_id);

  if (error) {
    redirect(`${editPath}?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath(customerPath);
  redirect(customerPath);
}
