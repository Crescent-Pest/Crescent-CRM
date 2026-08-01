# Crescent CRM

Internal CRM for Crescent Pest Control (Charleston, SC). Staff-only web app for
customers, service addresses, recurring service plans, and job scheduling.
Long-term goal: replace FieldRoutes.

**Stack:** Next.js 16 (App Router) · Supabase (Postgres + Auth + RLS) · Tailwind v4 · Vercel

## One-time setup

The app expects Supabase project `rfihahqbgakanjqisnbv` (Crescent's own Supabase
account, not Rubicon's).

1. **Apply the database schema.** In the Supabase Dashboard → SQL Editor, run in order:
   - `supabase/migrations/001_schema.sql`
   - `supabase/migrations/002_rls.sql`
   - `supabase/seed.sql` (optional sample data for demos)

2. **Lock down auth.** Dashboard → Authentication → Sign In / Providers:
   - Email provider ON, but **disable "Allow new users to sign up"**.
   - Staff accounts are created from Dashboard → Authentication → Users →
     "Add user" (set email + password directly). Every new auth user
     automatically gets a `profiles` row (active staff).

3. **Env vars.** Copy `.env.example` to `.env.local` and paste the anon key from
   Dashboard → Project Settings → API Keys. No service-role key is needed —
   all access goes through user sessions + RLS.

4. **Run it:**

   ```bash
   npm install
   npm run dev
   ```

## Security model

- Every route except `/login` is gated in `src/proxy.ts` (session check + refresh).
- Postgres RLS (`002_rls.sql`): only authenticated users with an **active**
  `profiles` row can read/write. Deactivating a staff member (set
  `profiles.active = false`) cuts off all data access immediately.
- Public signups stay disabled; there is no self-serve registration.

## Layout

- `supabase/` — schema, RLS policies, seed data (run via SQL Editor)
- `src/proxy.ts` — auth gate (Next 16 replacement for middleware)
- `src/lib/supabase/` — server/browser Supabase clients
- `src/lib/actions/` — server actions (auth, customers, jobs)
- `src/app/(app)/` — authenticated app: dashboard, customers, schedule
- `src/app/login/` — staff sign-in

## Roadmap (deferred from v1)

- Invoicing & payments (Stripe)
- Leads / sales pipeline
- Customer portal
- FieldRoutes data import
