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
import type { IdentifyResult, PestCandidate } from "@/lib/types";

// Fable 5 turns can run long — give the function room on Vercel.
export const maxDuration = 120;

// ~10 MB of base64 ≈ 7.5 MB image — well above the client's 1600px JPEG
const MAX_BASE64_LENGTH = 10_000_000;

const ALLOWED_MEDIA_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
type MediaType = (typeof ALLOWED_MEDIA_TYPES)[number];

// Structured-output schema: ranked pest candidates with observed evidence.
// (Numeric range/array-length constraints aren't supported by structured
// outputs, so 0-1 confidence and the 3-5 candidate cap are enforced in code.)
const IDENTIFY_SCHEMA = {
  type: "object",
  properties: {
    candidates: {
      type: "array",
      description: "3 to 5 pest candidates, ranked most likely first.",
      items: {
        type: "object",
        properties: {
          common_name: { type: "string" },
          scientific_name: { type: "string" },
          confidence: {
            type: "number",
            description: "Confidence between 0 and 1.",
          },
          evidence: {
            type: "array",
            description:
              "Specific visual evidence observed in THIS photo (droppings, wing shape, frass, damage pattern...).",
            items: { type: "string" },
          },
        },
        required: ["common_name", "scientific_name", "confidence", "evidence"],
        additionalProperties: false,
      },
    },
    photo_quality_note: {
      type: "string",
      description:
        "One short sentence on photo quality and whether a closer/sharper photo would improve the ID. Empty string if the photo is fine.",
    },
  },
  required: ["candidates", "photo_quality_note"],
  additionalProperties: false,
} as const;

const INSTRUCTION = `You are helping a pest-control technician in Charleston, South Carolina identify a pest from a field photo. The photo may show the insect/rodent itself, droppings, shed skins, mud tubes, gnaw marks, or other evidence.

Return 3 to 5 ranked candidates (most likely first). Prefer species common in coastal South Carolina. For each candidate, list only evidence actually visible in this photo. Be honest with confidence scores — the technician makes the final call, so a spread of plausible candidates beats false certainty.`;

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

  let image: string;
  let mediaType: MediaType;
  try {
    const body = await request.json();
    image = String(body.image ?? "");
    mediaType = body.media_type;
    if (!image) throw new Error("missing image");
    if (image.length > MAX_BASE64_LENGTH) {
      return NextResponse.json(
        { error: "That photo is too large. Retake it and try again." },
        { status: 413 }
      );
    }
    if (!ALLOWED_MEDIA_TYPES.includes(mediaType)) {
      throw new Error("bad media type");
    }
  } catch {
    return NextResponse.json(
      { error: "No photo received. Retake the photo and try again." },
      { status: 400 }
    );
  }

  try {
    const response = await client.beta.messages.create({
      model: getModel(),
      max_tokens: 4096,
      betas: [FALLBACK_BETA],
      fallbacks: "default",
      output_config: {
        format: { type: "json_schema", schema: IDENTIFY_SCHEMA },
      },
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mediaType, data: image },
            },
            { type: "text", text: INSTRUCTION },
          ],
        },
      ],
    });

    if (response.stop_reason === "refusal") {
      return NextResponse.json(
        {
          error:
            "The AI couldn't analyze this photo. Retake it showing just the pest evidence, or pick the pest manually below.",
        },
        { status: 422 }
      );
    }

    const text = firstText(response.content);
    if (!text) {
      return NextResponse.json(
        { error: "The AI returned an empty answer. Try again." },
        { status: 502 }
      );
    }

    const parsed = JSON.parse(text) as IdentifyResult;
    const candidates: PestCandidate[] = (parsed.candidates ?? [])
      .slice(0, 5)
      .map((c) => ({
        common_name: String(c.common_name ?? "Unknown"),
        scientific_name: String(c.scientific_name ?? ""),
        confidence: Math.min(1, Math.max(0, Number(c.confidence) || 0)),
        evidence: Array.isArray(c.evidence) ? c.evidence.map(String) : [],
      }));

    if (candidates.length === 0) {
      return NextResponse.json(
        {
          error:
            "The AI couldn't find a pest in this photo. Retake it closer to the evidence, or pick the pest manually.",
        },
        { status: 422 }
      );
    }

    const result: IdentifyResult = {
      candidates,
      photo_quality_note: String(parsed.photo_quality_note ?? ""),
    };
    return NextResponse.json(result);
  } catch (err) {
    const { message, status } = friendlyClaudeError(err);
    console.error("identify failed:", err);
    return NextResponse.json({ error: message }, { status });
  }
}
