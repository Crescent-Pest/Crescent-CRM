import { formatDate } from "@/lib/format";

/**
 * Outbound notification email over the Resend HTTP API, plus the small
 * single-column template both callers share.
 *
 * Every entry point degrades silently: without RESEND_API_KEY nothing is sent
 * and nothing throws, and a rejected send is logged rather than surfaced. A
 * tech's save and the cron route must never fail because email is down.
 */

const RESEND_URL = "https://api.resend.com/emails";
const DEFAULT_FROM = "Crescent CRM <onboarding@resend.dev>";
const DEFAULT_BASE_URL = "https://crescent-crm.vercel.app";

// Brand colors are inlined here on purpose: mail clients strip <style> and have
// no access to globals.css. Keep in sync with the tokens in src/app/globals.css.
const DENIM = "#46618f";
const DENIM_INK = "#1d2a42";
const GOLD = "#f2b02e";
const PAPER = "#f5f3ec";
const CARD = "#fffdf8";
const LINE = "#e2ddd0";
const INK = "#232a38";
const INK_SOFT = "#6b7280";
const DANGER = "#b3402f";

const FONT =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";

/** Public origin used for the links in every email. */
export function appBaseUrl() {
  return (process.env.APP_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
}

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
}

let warnedNoKey = false;

/**
 * Send one email. Resolves true only when Resend accepted it; a missing key or
 * any failure resolves false without throwing.
 */
export async function sendEmail({
  to,
  subject,
  html,
  text,
}: SendEmailInput): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    if (!warnedNoKey) {
      warnedNoKey = true;
      console.warn("email disabled — set RESEND_API_KEY");
    }
    return false;
  }

  try {
    const res = await fetch(RESEND_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM ?? DEFAULT_FROM,
        to: [to],
        subject,
        html,
        text,
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error(`email: resend rejected ${res.status}`, detail.slice(0, 300));
      return false;
    }
    return true;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(`email: send to ${to} failed: ${message}`);
    return false;
  }
}

// ---------- template ----------

/** One follow-up as it appears in a notification body. */
export interface EmailItem {
  description: string;
  due_date: string | null;
  urgent: boolean;
  /** customer the follow-up's visit note was filed against, when known */
  customer?: string | null;
}

/** A titled group of follow-ups; `tone` picks the accent color. */
export interface EmailSection {
  title: string;
  tone: "danger" | "normal";
  items: EmailItem[];
}

export interface RenderEmailInput {
  heading: string;
  intro: string;
  sections: EmailSection[];
  buttonLabel: string;
  buttonHref: string;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** "Sat, Aug 1 · Henderson" — the dim second line under a follow-up. */
function itemMeta(item: EmailItem) {
  const parts: string[] = [];
  if (item.due_date) parts.push(`Due ${formatDate(item.due_date)}`);
  if (item.customer) parts.push(item.customer);
  return parts.join(" · ");
}

function renderItem(item: EmailItem, accent: string) {
  const meta = itemMeta(item);
  const flag = item.urgent
    ? `<span style="color:${DANGER};font-weight:700"> · Urgent</span>`
    : "";
  return `<tr><td style="padding:10px 0;border-bottom:1px solid ${LINE}">
  <div style="font-size:15px;line-height:1.4;color:${INK};border-left:3px solid ${accent};padding-left:10px">
    ${escapeHtml(item.description)}${flag}
    ${meta ? `<div style="margin-top:3px;font-size:13px;color:${INK_SOFT}">${escapeHtml(meta)}</div>` : ""}
  </div>
</td></tr>`;
}

function renderSection(section: EmailSection) {
  const accent = section.tone === "danger" ? DANGER : DENIM;
  return `<tr><td style="padding:18px 0 0">
  <div style="font-size:13px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:${accent}">${escapeHtml(section.title)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:4px">
    ${section.items.map((item) => renderItem(item, accent)).join("")}
  </table>
</td></tr>`;
}

/** Branded single-column HTML. Tables and inline styles only — Outlook. */
export function renderEmailHtml({
  heading,
  intro,
  sections,
  buttonLabel,
  buttonHref,
}: RenderEmailInput) {
  return `<!doctype html><html><body style="margin:0;padding:0;background:${PAPER}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAPER};padding:24px 12px">
<tr><td align="center">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;font-family:${FONT}">
    <tr><td style="background:${DENIM_INK};padding:14px 20px;border-radius:8px 8px 0 0">
      <span style="font-size:18px;font-weight:800;letter-spacing:.16em;color:${GOLD}">CRESCENT</span>
    </td></tr>
    <tr><td style="background:${CARD};border:1px solid ${LINE};border-top:0;border-radius:0 0 8px 8px;padding:22px 20px">
      <h1 style="margin:0;font-size:19px;line-height:1.3;color:${DENIM_INK}">${escapeHtml(heading)}</h1>
      <p style="margin:8px 0 0;font-size:15px;line-height:1.5;color:${INK_SOFT}">${escapeHtml(intro)}</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${sections.filter((s) => s.items.length > 0).map(renderSection).join("")}
      </table>
      <a href="${escapeHtml(buttonHref)}" style="display:inline-block;margin-top:22px;background:${DENIM};color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;padding:11px 20px;border-radius:6px">${escapeHtml(buttonLabel)}</a>
    </td></tr>
    <tr><td style="padding:14px 4px;font-size:12px;color:${INK_SOFT}">Crescent Pest Control · sent by the CRM</td></tr>
  </table>
</td></tr></table>
</body></html>`;
}

/** Plain-text alternative with the same content, for clients that refuse HTML. */
export function renderEmailText({
  heading,
  intro,
  sections,
  buttonLabel,
  buttonHref,
}: RenderEmailInput) {
  const body = sections
    .filter((s) => s.items.length > 0)
    .map((section) => {
      const lines = section.items.map((item) => {
        const meta = itemMeta(item);
        return `- ${item.description}${item.urgent ? " (URGENT)" : ""}${meta ? `\n  ${meta}` : ""}`;
      });
      return `${section.title.toUpperCase()}\n${lines.join("\n")}`;
    })
    .join("\n\n");

  return `CRESCENT\n\n${heading}\n${intro}\n\n${body}\n\n${buttonLabel}: ${buttonHref}\n\nCrescent Pest Control · sent by the CRM\n`;
}
