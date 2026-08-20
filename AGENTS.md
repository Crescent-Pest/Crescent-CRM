<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

# FieldRoutes data — answering "talk to my data" questions

Local snapshots of Crescent's FieldRoutes data live in `data/fieldroutes/*.json`
(gitignored). When the user asks questions about customers, schedules, balances,
etc., **query those local files first** — reading them is free and fast.
If a file is missing or stale, pull a fresh copy (see below).

Tools (Node, no dependencies, credentials read from `.env.import`):

- `node scripts/pull-fieldroutes.mjs <endpoint> [param=value ...] --budget=N`
  Bulk-pulls an endpoint's full records to `data/fieldroutes/<endpoint>.json`.
- `node scripts/fieldroutes.mjs <endpoint> <action> [param=value ...]`
  One-off live API call (search/get). Use sparingly.

Common endpoints: customer, subscription, appointment, serviceType, ticket,
payment, employee. Search returns IDs; get takes `<endpoint>IDs=[...]` (max
1000 per call). Customer records embed subscriptionIDs/appointmentIDs/
ticketIDs/paymentIDs as comma-separated strings.

HARD RULES:
- The API key allows only **50 read requests per DAY** (20/min), shared with
  anything else using the same key. Always pass `--budget=25` (or lower) so
  pulls stop early. Check remaining budget in script output before pulling more.
- Never commit `data/fieldroutes/` (customer PII) or any `.env*` file with real
  values. Both are gitignored — leave them that way.
- Never call FieldRoutes write actions (create/update/delete). The query tool
  blocks them without `--allow-write`; do not pass that flag unless Logan
  explicitly asks.
- `.env.import` missing? Copy `.env.import.example` and have the user fill it
  in — never ask them to paste keys into chat.
<!-- END:nextjs-agent-rules -->

# Field tools (merged in from the Crescent-Inspect repo, 2026-08-18)

The pest-inspection + voice-notes app now lives in this repo:

- Pages: `/capture` (photo -> AI pest ID -> treatment plan -> estimate),
  `/history`, `/notes/new`, plus the shared `/followups` checklist.
- API routes: `/api/identify`, `/api/plan` (reads `docs/pests/*.md` — traced
  into the Vercel bundle via next.config.ts), `/api/structure-note`,
  `/api/transcribe` (503 without TRANSCRIPTION_API_KEY; dictation works without it).
- Env: `ANTHROPIC_API_KEY` required (Crescent's own Anthropic account).
  `ANTHROPIC_MODEL` optional. `TRANSCRIPTION_API_KEY` optional.
- Pricing is 100% code-computed from `src/data/pricing.json` (`demo: true`
  shows a DEMO badge). Never let the AI invent prices.

# Email notifications

Follow-up email goes out through the Resend HTTP API (`src/lib/email.ts`, plain
`fetch`, no SDK). Two triggers:

- **Instant ping** — saving a visit note that assigns a follow-up to someone
  *other than* the author emails that person. Sent from `after()` in
  `src/lib/actions/notes.ts`, so it runs past the response and can never slow
  or fail a tech's save.
- **7am digest** — `GET /api/cron/digest`, scheduled by `vercel.json` at
  `0 11 * * *` (11:00 UTC ≈ 7am Charleston in summer; it drifts an hour in
  winter). Cron has no session, so the route uses the service-role client in
  `src/lib/supabase/service.ts` — that module is `server-only` and must stay
  cron-only.

Addresses live on `public.profiles.email`, added by
`supabase/migrations/010_profile_emails.sql` (also updates the
`handle_new_user()` signup trigger). Until that migration is applied, both
paths log and send nothing.

Env vars:

| Variable | Required? | Effect when missing |
| --- | --- | --- |
| `RESEND_API_KEY` | for any email | logs `email disabled` once, sends nothing |
| `CRON_SECRET` | for the digest | `/api/cron/digest` returns 503 (401 on a bad `Authorization: Bearer` header) |
| `SUPABASE_SERVICE_ROLE_KEY` | for the digest | `/api/cron/digest` returns 503 |
| `EMAIL_FROM` | optional | falls back to `Crescent CRM <onboarding@resend.dev>` |
| `APP_BASE_URL` | optional | links fall back to `https://crescent-crm.vercel.app` |

Everything degrades silently by design: a missing key or a dead provider is
logged and skipped, never surfaced to staff and never thrown to a caller.
