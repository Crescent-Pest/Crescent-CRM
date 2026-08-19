-- Ops manual — procedures, sections, steps, chemicals, and field suggestions.
--
-- NOT APPLIED to the live database. Run this ONCE in the Supabase SQL editor
-- of the shared Crescent project, then run supabase/seed_procedures.sql to
-- load the manual content.
--
-- Depends on objects created by earlier migrations, already applied there:
--   public.profiles            (001_schema.sql)
--   public.is_active_staff()   (002_rls.sql)
--   public.is_admin()          (003_roles_and_archive.sql)
--
-- Ported from the standalone crescent-ops app. Two deliberate departures from
-- that schema:
--   * no anon access — the manual is internal, so every read needs an active
--     staff profile and every content edit needs role = 'admin'
--   * suggestions hang off a single step and carry the replacement text, so
--     accepting one applies the edit instead of just closing a free-text note

-- ---------- manual content ----------
-- Text primary keys (not uuids) so data/procedures-seed.json and Postgres stay
-- in sync and the seed file can be re-run without renumbering anything.

create table public.procedures (
  id text primary key,
  slug text not null unique,
  title text not null,
  summary text not null,
  category text not null,
  frequency text,
  sort int not null default 0,
  updated_at date not null default current_date
);

create table public.procedure_sections (
  id text primary key,
  procedure_id text not null references public.procedures (id) on delete cascade,
  title text not null,
  position int not null,
  unique (procedure_id, position)
);

create table public.procedure_steps (
  id text primary key,
  section_id text not null references public.procedure_sections (id) on delete cascade,
  content text not null,
  kind text not null default 'step' check (kind in ('step', 'warning', 'tip')),
  indent int not null default 0 check (indent in (0, 1)),
  position int not null,
  chemical_ids jsonb not null default '[]'::jsonb,
  unique (section_id, position)
);

create table public.chemicals (
  id text primary key,
  name text not null,
  epa_number text,
  category text not null,
  repellency text not null default 'n/a'
    check (repellency in ('repellent', 'non-repellent', 'n/a')),
  mix_ratios jsonb not null default '[]'::jsonb,
  notes text
);

create index procedure_sections_procedure_idx on public.procedure_sections (procedure_id);
create index procedure_steps_section_idx on public.procedure_steps (section_id);

-- ---------- field suggestions ----------
-- One suggestion = one step's replacement text. Accepting it writes
-- proposed_content onto the step, which is why status changes are admin-only.

create table public.step_suggestions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  step_id text not null references public.procedure_steps (id) on delete cascade,
  author_id uuid not null references public.profiles (id),
  proposed_content text not null check (char_length(proposed_content) between 5 and 4000),
  reason text,
  status text not null default 'open' check (status in ('open', 'accepted', 'rejected')),
  reviewed_by uuid references public.profiles (id),
  reviewed_at timestamptz
);

create index step_suggestions_status_idx on public.step_suggestions (status, created_at desc);
create index step_suggestions_step_idx on public.step_suggestions (step_id);

-- ---------- RLS: staff read the manual, admins edit it ----------
-- Same split-policy pattern as 003_roles_and_archive.sql.
do $$
declare t text;
begin
  foreach t in array array['procedures','procedure_sections','procedure_steps','chemicals'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "staff read" on public.%I for select using (public.is_active_staff())', t);
    execute format('create policy "admin insert" on public.%I for insert with check (public.is_admin())', t);
    execute format('create policy "admin update" on public.%I for update using (public.is_admin()) with check (public.is_admin())', t);
    execute format('create policy "admin delete" on public.%I for delete using (public.is_admin())', t);
  end loop;
end $$;

alter table public.step_suggestions enable row level security;

create policy "staff read" on public.step_suggestions
  for select using (public.is_active_staff());

-- Staff file suggestions under their own name and always as 'open'; only an
-- admin can move one to accepted or rejected.
create policy "staff insert" on public.step_suggestions
  for insert with check (
    public.is_active_staff() and author_id = auth.uid() and status = 'open'
  );
create policy "admin update" on public.step_suggestions
  for update using (public.is_admin()) with check (public.is_admin());
create policy "admin delete" on public.step_suggestions
  for delete using (public.is_admin());

-- ---------- keep procedures.updated_at honest ----------
-- A step edit means the manual changed, so bump the owning procedure's date.
-- Runs as the caller (an admin, per the policies above), not security definer.
create or replace function public.touch_procedure_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  update public.procedures p
  set updated_at = current_date
  from public.procedure_sections s
  where s.id = new.section_id and p.id = s.procedure_id;
  return new;
end;
$$;

-- The when clause keeps re-running seed_procedures.sql from touching dates
-- when the content it upserts is unchanged.
create trigger procedure_steps_touch_procedure
  after update of content, kind on public.procedure_steps
  for each row
  when (old.content is distinct from new.content or old.kind is distinct from new.kind)
  execute function public.touch_procedure_updated_at();
