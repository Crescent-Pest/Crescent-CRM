-- Crescent CRM v1 row-level security
-- Model: internal staff only. Any authenticated user with an ACTIVE profile row
-- can read/write CRM data. Public signups must stay DISABLED in Supabase Auth
-- settings — staff accounts are created by invite from the dashboard.

-- security definer so policies on other tables can check profiles
-- without recursive RLS evaluation
create or replace function public.is_active_staff()
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and active
  );
$$;

alter table public.profiles enable row level security;
alter table public.customers enable row level security;
alter table public.properties enable row level security;
alter table public.service_plans enable row level security;
alter table public.jobs enable row level security;
alter table public.customer_notes enable row level security;

-- profiles: staff can see the roster; each user may update only their own row.
-- role/active changes are admin work done via the dashboard (service role).
create policy "staff read profiles" on public.profiles
  for select using (public.is_active_staff());
create policy "own profile update" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- CRM tables: full read/write for active staff, nothing for anyone else.
create policy "staff all" on public.customers
  for all using (public.is_active_staff()) with check (public.is_active_staff());
create policy "staff all" on public.properties
  for all using (public.is_active_staff()) with check (public.is_active_staff());
create policy "staff all" on public.service_plans
  for all using (public.is_active_staff()) with check (public.is_active_staff());
create policy "staff all" on public.jobs
  for all using (public.is_active_staff()) with check (public.is_active_staff());
create policy "staff all" on public.customer_notes
  for all using (public.is_active_staff()) with check (public.is_active_staff());
