# Ask Your Data — Sean's Guide

Talk to your FieldRoutes data in plain English using Claude Code. No spreadsheets, no reports to run — just ask.

## One-time setup: paste this into Claude Code

Save the credentials file Logan sent you (just download the attachment — Downloads folder is perfect). Then open Claude Code and paste this entire prompt:

```
Hi Claude — I'm Sean, owner of Crescent Pest Control. I'm not technical. My
consultant Logan set up tools so I can ask plain-English questions about my
FieldRoutes data (customers, balances, schedules). Your job is to do
EVERYTHING for me, and when a step genuinely needs me, tell me exactly what
to do in plain words — one step at a time, no jargon.

Run through this checklist:

1. Look in my Downloads folder for the credentials file Logan sent me. It
   should be named .env.import, but it may have arrived as env-import.txt
   or similar. If you can't find it, tell me exactly how to save it from
   Logan's message (tap the attachment, choose Save or Download) and wait
   for me to say it's done. NEVER ask me to paste the file's contents into
   this chat.
2. Clone https://github.com/Crescent-Pest/Crescent-CRM.git into my
   Documents folder (skip if it's already there) and work in that folder
   from now on. If a GitHub sign-in window pops up, tell me and walk me
   through logging in.
3. Move the credentials file into that folder yourself, renaming it to
   exactly .env.import if needed.
4. Read ASK-YOUR-DATA.md and AGENTS.md in the folder — they explain the
   data tools and the rules, including the 50-API-reads-per-day limit.
5. Check whether Node.js is installed. If it isn't, install the LTS
   version for me and confirm it works.
6. Run one small test query to confirm my keys work, and tell me in plain
   English whether it worked.
7. Pull my customer data to my computer (stay under 25 API reads).
8. Then show me: how many active customers I have, who owes money and how
   much, and how many customers are on autopay — and suggest 5 more
   questions I could ask about my data.

After that, I'll just ask questions in plain English whenever I want.
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
