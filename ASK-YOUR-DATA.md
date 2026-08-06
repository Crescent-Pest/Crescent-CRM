# Ask Your Data — Sean's Guide

Talk to your FieldRoutes data in plain English using Claude Code. No spreadsheets, no reports to run — just ask.

## One-time setup (do this with Logan, ~20 minutes)

1. Install [Claude Code](https://claude.com/claude-code) (desktop app) and sign in with a Claude subscription
2. Install [Node.js](https://nodejs.org) (LTS version, default options)
3. Clone this repo (Logan will help): `Crescent-Pest/Crescent-CRM`
4. In the repo folder, copy `.env.import.example`, rename the copy to `.env.import`, and paste in the FieldRoutes API key + token (Logan has these, or generate a fresh pair in FieldRoutes)

## Daily use

1. Open the `Crescent-CRM` folder in Claude Code
2. Ask questions in plain English. Examples:
   - "How many active customers do we have?"
   - "Who owes us money? Rank by amount."
   - "Which customers aren't on autopay?"
   - "List commercial accounts added this year"
   - "What's on the schedule this week?" *(needs appointment data pulled first — just ask Claude to pull it)*
3. Want the latest numbers? Say: **"Pull fresh customer data first, then answer."**

## Things to know

- **Your data stays on your computer.** Customer records are saved locally and are never uploaded to GitHub.
- **The FieldRoutes API allows 50 data pulls per day.** Normal questions don't use any — only refreshing data does. Claude manages this automatically.
- **Keep `.env.import` private.** It holds your API keys. Never email it or paste its contents anywhere.
- Claude can read your data but is blocked from changing anything in FieldRoutes.
