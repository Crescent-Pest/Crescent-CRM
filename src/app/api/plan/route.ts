import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  FALLBACK_BETA,
  MISSING_KEY_MESSAGE,
  firstText,
  friendlyClaudeError,
  getAnthropic,
  getModel,
} from "@/lib/claude";
import { isKnownPest, pestBySlug } from "@/lib/pests";

// Fable 5 turns can run long — give the function room on Vercel.
export const maxDuration = 120;

const SAFETY_RULES = `You are writing a treatment plan for a Crescent Pest Control technician in Charleston, SC. A customer will read this plan, so keep it clear, professional, and free of internal jargon.

HARD RULES:
- Use ONLY the products, application methods, and rates in the treatment document below. Never introduce a chemical, device, or method that is not in the document.
- Never invent dilution or application rates. If the document says "per label instructions", repeat exactly that — do not fill in a number.
- Never state prices, discounts, or dollar amounts. Pricing is handled separately by the app.
- Repeat the document's safety warnings that apply to the chosen steps (label restrictions, re-entry intervals, bait/repellent contamination rules).
- Output plain markdown with EXACTLY these five ## sections, in this order:
  ## What We Found
  ## Treatment Plan
  ## Products Used
  ## Customer Prep
  ## Follow-up Schedule
- "Treatment Plan" is a numbered list of steps. "Products Used" lists each product with a one-line purpose (rates only if the document gives them). Keep the whole plan under ~450 words.

TREATMENT DOCUMENT:
`;

interface PlanRequest {
  pest: string;
  notes?: string;
  sqft?: number;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { error: "Not signed in. Log in and try again." },
      { status: 401 }
    );
  }

  const client = getAnthropic();
  if (!client) {
    return NextResponse.json({ error: MISSING_KEY_MESSAGE }, { status: 503 });
  }

  let body: PlanRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  const slug = String(body.pest ?? "");
  if (!isKnownPest(slug)) {
    return NextResponse.json(
      { error: "Unknown pest — pick one from the list and try again." },
      { status: 400 }
    );
  }
  const pest = pestBySlug(slug)!;

  // slug is validated against the catalog above, so this path is safe
  let doc: string;
  try {
    doc = await readFile(
      path.join(process.cwd(), "docs", "pests", `${slug}.md`),
      "utf8"
    );
  } catch (err) {
    console.error("treatment doc missing:", slug, err);
    return NextResponse.json(
      { error: `No treatment document found for ${pest.commonName}.` },
      { status: 500 }
    );
  }

  const notes = String(body.notes ?? "").slice(0, 2000).trim();
  const sqft = Number(body.sqft);
  const details = [
    `Confirmed pest: ${pest.commonName}.`,
    Number.isFinite(sqft) && sqft > 0
      ? `Property size: about ${Math.round(sqft).toLocaleString()} sq ft.`
      : "Property size: not provided.",
    notes ? `Technician's field notes: ${notes}` : "No additional technician notes.",
  ].join("\n");

  try {
    const response = await client.beta.messages.create({
      model: getModel(),
      max_tokens: 8192,
      betas: [FALLBACK_BETA],
      fallbacks: "default",
      // The safety rules + treatment doc are identical for every plan of the
      // same pest, so cache them as the stable system prefix.
      system: [
        {
          type: "text",
          text: SAFETY_RULES + doc,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [
        {
          role: "user",
          content: `Write the treatment plan.\n\n${details}`,
        },
      ],
    });

    if (response.stop_reason === "refusal") {
      return NextResponse.json(
        {
          error:
            "The AI declined to write this plan. Adjust the notes and try again, or write the plan manually.",
        },
        { status: 422 }
      );
    }

    const planMd = firstText(response.content);
    if (!planMd) {
      return NextResponse.json(
        { error: "The AI returned an empty plan. Try again." },
        { status: 502 }
      );
    }

    return NextResponse.json({ plan_md: planMd.trim() });
  } catch (err) {
    const { message, status } = friendlyClaudeError(err);
    console.error("plan failed:", err);
    return NextResponse.json({ error: message }, { status });
  }
}
