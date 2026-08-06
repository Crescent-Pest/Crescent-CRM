# Ask Your Data — Sean's Guide

Talk to your FieldRoutes data in plain English using Claude Code. No spreadsheets, no reports to run — just ask.

## One-time setup: paste this into Claude Code

Have your FieldRoutes API key + token ready (Logan will send them privately, or generate your own pair in FieldRoutes settings). Then open Claude Code and paste this entire prompt:

```
Hi — I'm Sean, owner of Crescent Pest Control. I'm not technical, so explain
things simply and do as much as possible for me. My consultant Logan built
tooling so I can ask plain-English questions about my FieldRoutes data
(customers, balances, schedules). Set me up, step by step:

1. Clone the private repo https://github.com/Crescent-Pest/Crescent-CRM.git
   into my Documents folder (skip if already cloned) and work in that folder
   from now on. If a GitHub sign-in window pops up, I'll log in myself.
2. Read ASK-YOUR-DATA.md and AGENTS.md — they explain the data tools and the
   rules, including the 50-reads-per-day API limit.
3. Check whether Node.js is installed. If not, install the LTS version for me
   and confirm it runs.
4. Copy .env.import.example to .env.import and open it in Notepad for me.
   I'll paste in my FieldRoutes API key and token, save, and close — then
   I'll tell you "done". Never ask me to paste the keys into this chat.
5. Run one small test query to confirm the keys work.
6. Pull my customer data to my computer (stay under 25 API reads).
7. Then show me: how many active customers I have, who owes money and how
   much, and how many customers are on autopay — and suggest 5 more
   questions I could ask about my data.
```

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
