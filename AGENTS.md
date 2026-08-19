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
