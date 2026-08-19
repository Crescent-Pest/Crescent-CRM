-- Crescent Inspect v2 — voice notes + follow-up action items
--
-- Run this ONCE in the Supabase SQL editor of the SHARED Crescent project
-- (same project as Crescent-CRM), after 001_inspections.sql. It depends on
-- objects created by the CRM migrations, which are already applied there:
--   public.profiles, public.customers          (001_schema.sql)
--   public.is_active_staff()                   (002_rls.sql)
--   public.is_admin()                          (003_roles_and_archive.sql)
-- and on public.inspections from 001_inspections.sql.

-- ---------- visit_notes ----------
create table public.visit_notes (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  tech_id uuid references public.profiles (id),
  customer_id uuid references public.customers (id),
  inspection_id uuid references public.inspections (id),
  audio_path text,                       -- object path in the voice-notes bucket (null for dictated notes)
  transcript text,                       -- raw dictated/transcribed text
  summary text,                          -- AI visit summary (plain text)
  structured jsonb                       -- full AI result: commitments, items, mentioned customer
);

create index visit_notes_created_idx on public.visit_notes (created_at desc);

-- ---------- action_items ----------
create table public.action_items (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  visit_note_id uuid references public.visit_notes (id) on delete cascade,
  tech_id uuid references public.profiles (id),
  description text not null,
  due_date date,                         -- null = no due date mentioned
  priority text not null default 'normal',   -- 'normal' | 'urgent'
  status text not null default 'open',       -- 'open' | 'done'
  done_at timestamptz
);

create index action_items_tech_status_idx on public.action_items (tech_id, status);
create index action_items_due_idx on public.action_items (due_date);

-- ---------- RLS: staff read/insert/update, admin-only delete ----------
-- Same pattern as 001_inspections.sql.
alter table public.visit_notes enable row level security;

create policy "staff read" on public.visit_notes
  for select using (public.is_active_staff());
create policy "staff insert" on public.visit_notes
  for insert with check (public.is_active_staff());
create policy "staff update" on public.visit_notes
  for update using (public.is_active_staff()) with check (public.is_active_staff());
create policy "admin delete" on public.visit_notes
  for delete using (public.is_admin());

alter table public.action_items enable row level security;

create policy "staff read" on public.action_items
  for select using (public.is_active_staff());
create policy "staff insert" on public.action_items
  for insert with check (public.is_active_staff());
create policy "staff update" on public.action_items
  for update using (public.is_active_staff()) with check (public.is_active_staff());
create policy "admin delete" on public.action_items
  for delete using (public.is_admin());

-- ---------- storage: private voice-notes bucket ----------
insert into storage.buckets (id, name, public)
values ('voice-notes', 'voice-notes', false)
on conflict (id) do nothing;

-- Authenticated staff can upload and read recordings; delete is admin-only.
-- Same pattern as the inspection-photos policies in 001_inspections.sql.
create policy "voice notes insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'voice-notes' and public.is_active_staff());

create policy "voice notes read" on storage.objects
  for select to authenticated
  using (bucket_id = 'voice-notes' and public.is_active_staff());

create policy "voice notes delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'voice-notes' and public.is_admin());
