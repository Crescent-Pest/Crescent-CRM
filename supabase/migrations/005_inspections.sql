-- Crescent Inspect v1 — inspections table + photo storage
--
-- Run this ONCE in the Supabase SQL editor of the SHARED Crescent project
-- (same project as Crescent-CRM). It depends on objects created by the CRM
-- migrations, which are already applied there:
--   public.profiles, public.customers, public.properties   (001_schema.sql)
--   public.is_active_staff()                                (002_rls.sql)
--   public.is_admin()                                       (003_roles_and_archive.sql)

-- ---------- inspections ----------
create table public.inspections (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  tech_id uuid references public.profiles (id),
  customer_id uuid references public.customers (id),
  property_id uuid references public.properties (id),
  photo_path text,                       -- object path in the inspection-photos bucket
  pest_confirmed text,                   -- catalog slug confirmed by the tech
  pest_candidates jsonb,                 -- ranked AI candidates (advisory only)
  confidence numeric,                    -- confidence of the confirmed candidate, 0-1
  plan_md text,                          -- AI-generated treatment plan (markdown)
  estimate_cents int,                    -- computed in app code, never by the AI
  estimate_breakdown jsonb,              -- line items + recurring + demo flag
  status text not null default 'draft',
  notes text
);

create index inspections_created_idx on public.inspections (created_at desc);
create index inspections_tech_idx on public.inspections (tech_id);
create index inspections_customer_idx on public.inspections (customer_id);

-- ---------- RLS: staff read/insert/update, admin-only delete ----------
-- Same pattern as Crescent-CRM/supabase/003_roles_and_archive.sql.
alter table public.inspections enable row level security;

create policy "staff read" on public.inspections
  for select using (public.is_active_staff());
create policy "staff insert" on public.inspections
  for insert with check (public.is_active_staff());
create policy "staff update" on public.inspections
  for update using (public.is_active_staff()) with check (public.is_active_staff());
create policy "admin delete" on public.inspections
  for delete using (public.is_admin());

-- ---------- storage: private inspection-photos bucket ----------
insert into storage.buckets (id, name, public)
values ('inspection-photos', 'inspection-photos', false)
on conflict (id) do nothing;

-- Authenticated staff can upload and read photos; delete is admin-only.
create policy "inspection photos insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'inspection-photos' and public.is_active_staff());

create policy "inspection photos read" on storage.objects
  for select to authenticated
  using (bucket_id = 'inspection-photos' and public.is_active_staff());

create policy "inspection photos delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'inspection-photos' and public.is_admin());
