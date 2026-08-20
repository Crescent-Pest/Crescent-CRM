import { NextResponse } from "next/server";
import {
  appBaseUrl,
  renderEmailHtml,
  renderEmailText,
  sendEmail,
  type EmailItem,
  type RenderEmailInput,
} from "@/lib/email";
import { todayISO } from "@/lib/format";
import { createServiceClient } from "@/lib/supabase/service";
import { customerName, type ActionItem, type Customer } from "@/lib/types";

/**
 * 7am follow-up digest, one email per person with open work (see vercel.json
 * for the schedule). Runs with the service role because cron has no session.
 *
 * Missing config degrades loudly but harmlessly: a 503 with the variable to
 * set, never a thrown error. Missing RESEND_API_KEY is handled inside
 * sendEmail, so the route still reports what it would have sent.
 */

const ITEM_LIMIT = 500;

const DIGEST_SELECT = `id, description, due_date, priority, assigned_to,
  assignee:profiles!assigned_to(full_name, email),
  visit_note:visit_notes(customer:customers(type, first_name, last_name, company_name))`;

type DigestRow = Pick<
  ActionItem,
  "id" | "description" | "due_date" | "priority" | "assigned_to"
> & {
  assignee: { full_name: string; email: string | null } | null;
  visit_note: {
    customer: Pick<
      Customer,
      "type" | "first_name" | "last_name" | "company_name"
    > | null;
  } | null;
};

interface Bucket {
  name: string;
  /** null when the profile has no address yet — counted as skipped, never sent */
  email: string | null;
  overdue: EmailItem[];
  upcoming: EmailItem[];
}

/** Undated items sort last; everything else by due date ascending. */
function byDueDate(a: EmailItem, b: EmailItem) {
  if (a.due_date === b.due_date) return 0;
  if (!a.due_date) return 1;
  if (!b.due_date) return -1;
  return a.due_date.localeCompare(b.due_date);
}

function toEmailItem(row: DigestRow): EmailItem {
  const customer = row.visit_note?.customer;
  return {
    description: row.description,
    due_date: row.due_date,
    urgent: row.priority === "urgent",
    customer: customer ? customerName(customer) || null : null,
  };
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "Digest is not configured — set CRON_SECRET." },
      { status: 503 }
    );
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }

  const supabase = createServiceClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Digest is not configured — set SUPABASE_SERVICE_ROLE_KEY." },
      { status: 503 }
    );
  }

  const { data, error } = await supabase
    .from("action_items")
    .select(DIGEST_SELECT)
    .eq("status", "open")
    .limit(ITEM_LIMIT);

  if (error) {
    console.error("digest: follow-up query failed:", error.message);
    return NextResponse.json(
      { error: "Couldn't read follow-ups. Check migration 009/010 are applied." },
      { status: 502 }
    );
  }

  const today = todayISO();
  const rows = (data ?? []) as unknown as DigestRow[];
  const buckets = new Map<string, Bucket>();
  let unassigned = 0;

  for (const row of rows) {
    // Nobody owns it (pre-009 rows, or a deleted profile) — nobody to email.
    if (!row.assigned_to) {
      unassigned += 1;
      continue;
    }
    let bucket = buckets.get(row.assigned_to);
    if (!bucket) {
      bucket = {
        name: row.assignee?.full_name || "there",
        email: row.assignee?.email ?? null,
        overdue: [],
        upcoming: [],
      };
      buckets.set(row.assigned_to, bucket);
    }
    const item = toEmailItem(row);
    if (item.due_date && item.due_date < today) bucket.overdue.push(item);
    else bucket.upcoming.push(item);
  }

  if (unassigned > 0) {
    console.warn(`digest: ${unassigned} open follow-ups have no assignee`);
  }

  const buttonHref = `${appBaseUrl()}/followups`;
  // sent/skipped count PEOPLE with at least one open item, not items.
  let sent = 0;
  let skipped = 0;

  for (const bucket of buckets.values()) {
    if (!bucket.email) {
      console.warn(`digest: no address on profile for ${bucket.name} — skipped`);
      skipped += 1;
      continue;
    }
    bucket.overdue.sort(byDueDate);
    bucket.upcoming.sort(byDueDate);
    const total = bucket.overdue.length + bucket.upcoming.length;

    const content: RenderEmailInput = {
      heading: `You have ${total} open follow-up${total === 1 ? "" : "s"}${
        bucket.overdue.length > 0 ? ` (${bucket.overdue.length} overdue)` : ""
      }`,
      intro: `Good morning, ${bucket.name.split(" ")[0]} — here's what's on your list.`,
      sections: [
        { title: "Overdue", tone: "danger", items: bucket.overdue },
        { title: "Coming up", tone: "normal", items: bucket.upcoming },
      ],
      buttonLabel: "Open follow-ups",
      buttonHref,
    };

    const ok = await sendEmail({
      to: bucket.email,
      subject: content.heading,
      html: renderEmailHtml(content),
      text: renderEmailText(content),
    });
    if (ok) sent += 1;
    else skipped += 1;
  }

  return NextResponse.json({ sent, skipped });
}
