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
import type {
  ActionItemPriority,
  StructuredActionItem,
  StructuredNote,
} from "@/lib/types";

// Fable 5 turns can run long — give the function room on Vercel.
export const maxDuration = 120;

const MAX_TRANSCRIPT_CHARS = 12_000;
const MAX_ACTION_ITEMS = 20;
const MAX_ROSTER_NAMES = 60;

// Structured-output schema: visit summary + dated follow-up tasks.
// (Date-format constraints aren't supported by structured outputs, so the
// YYYY-MM-DD shape of due_date is validated in code below.)
const NOTE_SCHEMA = {
  type: "object",
  properties: {
    summary: {
      type: "string",
      description:
        "2-4 sentence plain-language summary of the visit for the office record.",
    },
    customer_commitments: {
      type: "array",
      description:
        "Things the CUSTOMER agreed to do (clear clutter, keep pets inside...). Empty if none.",
      items: { type: "string" },
    },
    action_items: {
      type: "array",
      description:
        "Follow-up tasks for the technician or office, one per task. Empty if none.",
      items: {
        type: "object",
        properties: {
          description: { type: "string" },
          due_date: {
            type: ["string", "null"],
            description:
              "Real calendar date in YYYY-MM-DD, resolved from today's date. Null when no timing was mentioned.",
          },
          priority: { type: "string", enum: ["normal", "urgent"] },
          assignee_name: {
            type: ["string", "null"],
            description:
              "Exact name from the staff roster when the note directs this task at that teammate. Null otherwise.",
          },
        },
        required: ["description", "due_date", "priority", "assignee_name"],
        additionalProperties: false,
      },
    },
    mentioned_customer: {
      type: ["string", "null"],
      description:
        "The customer's name if it is spoken in the transcript, otherwise null.",
    },
  },
  required: ["summary", "customer_commitments", "action_items", "mentioned_customer"],
  additionalProperties: false,
} as const;

const INSTRUCTION = `You are organizing a pest-control technician's spoken notes after a customer visit for Crescent Pest Control in Charleston, SC. The transcript comes from dictation, so expect filler words, run-ons, and transcription glitches.

Rules:
- Only include what the transcript actually supports. Never invent tasks, dates, chemicals, promises, or prices.
- action_items are things the TECHNICIAN or the OFFICE must do (call the customer back, schedule a re-treat, order bait stations...). customer_commitments are things the CUSTOMER agreed to do. Keep them separate.
- Resolve relative timing ("Friday", "in two weeks", "next month") to a real YYYY-MM-DD date using today's date given in the message. If no timing is mentioned for a task, use null — do not guess.
- priority is "urgent" only for safety issues, active infestations getting worse, or anything the tech says is urgent/ASAP. Everything else is "normal".
- Write descriptions as short imperatives ("Call Mrs. Harper about the quote"), one task each.
- assignee_name: when the note clearly hands a task to a named teammate ("have Joel check the stations", "Sarah needs to call them back"), set it to that person's EXACT name as written in the staff roster in the message. Otherwise use null — including when the tech is talking about themselves, when the name is only mentioned in passing, or when the name is not on the roster. Never invent a name that is not on the roster, and never guess between two similar roster names.`;

interface StructureRequest {
  transcript: string;
  customer_name?: string;
  notes?: string;
}

/** Today in Charleston, SC as YYYY-MM-DD + a human-readable form, so the
 * model can resolve "call her Friday" to a real date. */
function todayInCharleston(): { iso: string; long: string } {
  const now = new Date();
  const tz = "America/New_York";
  return {
    iso: new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(now),
    long: new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(now),
  };
}

function cleanDueDate(value: unknown): string | null {
  const s = String(value ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  return Number.isNaN(Date.parse(`${s}T00:00:00Z`)) ? null : s;
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

  let body: StructureRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  const transcript = String(body.transcript ?? "")
    .slice(0, MAX_TRANSCRIPT_CHARS)
    .trim();
  if (!transcript) {
    return NextResponse.json(
      { error: "No note text received. Dictate or type the note first." },
      { status: 400 }
    );
  }
  const customerName = String(body.customer_name ?? "").slice(0, 200).trim();
  const extraNotes = String(body.notes ?? "").slice(0, 2000).trim();

  // Roster of active staff, so the model can point a task at a teammate by
  // name. A failed lookup just means no suggestions — never a failed note.
  const { data: rosterData, error: rosterError } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("active", true)
    .order("full_name")
    .limit(MAX_ROSTER_NAMES);
  if (rosterError) {
    console.error("structure-note: roster lookup failed:", rosterError.message);
  }
  const roster = (rosterData ?? [])
    .map((p) => String(p.full_name ?? "").trim())
    .filter(Boolean);
  const rosterByName = new Map(roster.map((name) => [name.toLowerCase(), name]));

  const today = todayInCharleston();
  const details = [
    `Today is ${today.long} (${today.iso}).`,
    roster.length > 0
      ? `Staff roster (active employees — the only valid assignee_name values): ${roster.join(", ")}`
      : "Staff roster: unavailable. Always use null for assignee_name.",
    customerName
      ? `Customer name entered by the tech: ${customerName}`
      : "Customer name entered by the tech: not provided.",
    extraNotes ? `Additional typed notes from the tech: ${extraNotes}` : "",
    `Transcript of the tech's spoken notes:\n${transcript}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  try {
    const response = await client.beta.messages.create({
      model: getModel(),
      max_tokens: 4096,
      betas: [FALLBACK_BETA],
      fallbacks: "default",
      output_config: {
        format: { type: "json_schema", schema: NOTE_SCHEMA },
      },
      system: INSTRUCTION,
      messages: [{ role: "user", content: details }],
    });

    if (response.stop_reason === "refusal") {
      return NextResponse.json(
        {
          error:
            "The AI declined to process this note. Edit the text and try again, or save it as-is.",
        },
        { status: 422 }
      );
    }

    const text = firstText(response.content);
    if (!text) {
      return NextResponse.json(
        { error: "The AI returned an empty result. Try again." },
        { status: 502 }
      );
    }

    const parsed = JSON.parse(text) as StructuredNote;
    const actionItems: StructuredActionItem[] = (parsed.action_items ?? [])
      .slice(0, MAX_ACTION_ITEMS)
      .map((item) => ({
        description: String(item.description ?? "").trim(),
        due_date: cleanDueDate(item.due_date),
        priority: (item.priority === "urgent"
          ? "urgent"
          : "normal") as ActionItemPriority,
        // drop anything that isn't a real roster name, whatever the model spelled
        assignee_name:
          rosterByName.get(
            String(item.assignee_name ?? "")
              .trim()
              .toLowerCase()
          ) ?? null,
      }))
      .filter((item) => item.description.length > 0);

    const result: StructuredNote = {
      summary: String(parsed.summary ?? "").trim(),
      customer_commitments: Array.isArray(parsed.customer_commitments)
        ? parsed.customer_commitments.map(String).filter(Boolean).slice(0, 10)
        : [],
      action_items: actionItems,
      mentioned_customer: parsed.mentioned_customer
        ? String(parsed.mentioned_customer).slice(0, 200)
        : null,
    };
    return NextResponse.json(result);
  } catch (err) {
    const { message, status } = friendlyClaudeError(err);
    console.error("structure-note failed:", err);
    return NextResponse.json({ error: message }, { status });
  }
}
