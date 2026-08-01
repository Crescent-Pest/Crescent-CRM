"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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

export async function createCustomer(formData: FormData) {
  const type = str(formData, "type") === "commercial" ? "commercial" : "residential";
  const first_name = str(formData, "first_name");
  const last_name = str(formData, "last_name");
  const company_name = str(formData, "company_name");

  const hasName =
    type === "residential" ? first_name || last_name : company_name;
  if (!hasName) {
    redirect("/customers/new?error=name");
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customers")
    .insert({
      type,
      first_name,
      last_name,
      company_name,
      email: orNull(str(formData, "email")),
      phone: orNull(str(formData, "phone")),
      phone_alt: orNull(str(formData, "phone_alt")),
      source: orNull(str(formData, "source")),
    })
    .select("id")
    .single();

  if (error || !data) {
    redirect(`/customers/new?error=${encodeURIComponent(error?.message ?? "save failed")}`);
  }

  revalidatePath("/customers");
  redirect(`/customers/${data.id}`);
}

/** Hard delete — cascades to properties, plans, jobs, and notes */
export async function deleteCustomer(formData: FormData) {
  const id = str(formData, "id");
  if (!id) return;

  const supabase = await createClient();
  const { error } = await supabase.from("customers").delete().eq("id", id);

  if (error) {
    redirect(`/customers?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/customers");
  revalidatePath("/");
  revalidatePath("/schedule");
  revalidatePath("/today");
  redirect("/customers");
}

export async function updateCustomer(formData: FormData) {
  const id = str(formData, "id");
  if (!id) redirect("/customers");

  const type = str(formData, "type") === "commercial" ? "commercial" : "residential";
  const first_name = str(formData, "first_name");
  const last_name = str(formData, "last_name");
  const company_name = str(formData, "company_name");

  const hasName =
    type === "residential" ? first_name || last_name : company_name;
  if (!hasName) {
    redirect(`/customers/${id}/edit?error=name`);
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("customers")
    .update({
      type,
      first_name,
      last_name,
      company_name,
      email: orNull(str(formData, "email")),
      phone: orNull(str(formData, "phone")),
      phone_alt: orNull(str(formData, "phone_alt")),
      source: orNull(str(formData, "source")),
    })
    .eq("id", id);

  if (error) {
    redirect(`/customers/${id}/edit?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/customers");
  revalidatePath(`/customers/${id}`);
  redirect(`/customers/${id}`);
}

export async function setCustomerStatus(formData: FormData) {
  const id = str(formData, "id");
  const status = str(formData, "status") === "inactive" ? "inactive" : "active";

  const supabase = await createClient();
  await supabase.from("customers").update({ status }).eq("id", id);

  revalidatePath(`/customers/${id}`);
  revalidatePath("/customers");
}

export async function addProperty(formData: FormData) {
  const customer_id = str(formData, "customer_id");
  const address_line1 = str(formData, "address_line1");
  const city = str(formData, "city");
  const zip = str(formData, "zip");

  if (!customer_id || !address_line1 || !city || !zip) {
    redirect(`/customers/${customer_id}?error=address`);
  }

  const supabase = await createClient();
  const { error } = await supabase.from("properties").insert({
    customer_id,
    label: str(formData, "label"),
    address_line1,
    address_line2: orNull(str(formData, "address_line2")),
    city,
    state: str(formData, "state") || "SC",
    zip,
    access_notes: orNull(str(formData, "access_notes")),
  });

  if (error) {
    redirect(`/customers/${customer_id}?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath(`/customers/${customer_id}`);
  redirect(`/customers/${customer_id}`);
}

export async function updateProperty(formData: FormData) {
  const id = str(formData, "id");
  const customer_id = str(formData, "customer_id");
  if (!id || !customer_id) redirect("/customers");

  const editPath = `/customers/${customer_id}/properties/${id}/edit`;
  const address_line1 = str(formData, "address_line1");
  const city = str(formData, "city");
  const zip = str(formData, "zip");

  if (!address_line1 || !city || !zip) {
    redirect(`${editPath}?error=address`);
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("properties")
    .update({
      label: str(formData, "label"),
      address_line1,
      address_line2: orNull(str(formData, "address_line2")),
      city,
      state: str(formData, "state") || "SC",
      zip,
      access_notes: orNull(str(formData, "access_notes")),
      active: checked(formData, "active"),
    })
    .eq("id", id)
    .eq("customer_id", customer_id);

  if (error) {
    redirect(`${editPath}?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath(`/customers/${customer_id}`);
  revalidatePath("/schedule/new");
  redirect(`/customers/${customer_id}`);
}

export async function addNote(formData: FormData) {
  const customer_id = str(formData, "customer_id");
  const body = str(formData, "body");
  if (!customer_id || !body) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  await supabase.from("customer_notes").insert({
    customer_id,
    body,
    author_id: user?.id ?? null,
  });

  revalidatePath(`/customers/${customer_id}`);
}
