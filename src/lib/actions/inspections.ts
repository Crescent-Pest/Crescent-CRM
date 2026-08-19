"use server";

import { createClient } from "@/lib/supabase/server";
import { isKnownPest } from "@/lib/pests";
import type { EstimateBreakdown, PestCandidate } from "@/lib/types";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface SaveInspectionInput {
  photo_path: string;
  /** Optional CRM link picked by the tech — both null when skipped. */
  customer_id: string | null;
  property_id: string | null;
  pest_confirmed: string;
  pest_candidates: PestCandidate[];
  confidence: number | null;
  plan_md: string;
  estimate_cents: number;
  estimate_breakdown: EstimateBreakdown;
  notes: string | null;
}

export interface SaveInspectionResult {
  id: string | null;
  error: string | null;
}

/** Insert the finished inspection. The photo is already uploaded to the
 * inspection-photos bucket by the client before this runs. */
export async function saveInspection(
  input: SaveInspectionInput
): Promise<SaveInspectionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { id: null, error: "Your session expired. Sign in again." };
  }
  if (!isKnownPest(input.pest_confirmed)) {
    return { id: null, error: "Unknown pest — pick one from the list." };
  }
  if (!input.photo_path || !input.plan_md) {
    return { id: null, error: "Missing photo or plan — finish the flow first." };
  }

  const customerId =
    input.customer_id && UUID_RE.test(input.customer_id) ? input.customer_id : null;
  // a property only makes sense alongside its customer
  const propertyId =
    customerId && input.property_id && UUID_RE.test(input.property_id)
      ? input.property_id
      : null;

  const { data, error } = await supabase
    .from("inspections")
    .insert({
      tech_id: user.id,
      customer_id: customerId,
      property_id: propertyId,
      photo_path: input.photo_path,
      pest_confirmed: input.pest_confirmed,
      pest_candidates: input.pest_candidates,
      confidence: input.confidence,
      plan_md: input.plan_md,
      estimate_cents: input.estimate_cents,
      estimate_breakdown: input.estimate_breakdown,
      status: "draft",
      notes: input.notes,
    })
    .select("id")
    .single();

  if (error) {
    console.error("saveInspection failed:", error);
    return {
      id: null,
      error: "Couldn't save the inspection. Check your connection and try again.",
    };
  }

  return { id: data.id, error: null };
}
