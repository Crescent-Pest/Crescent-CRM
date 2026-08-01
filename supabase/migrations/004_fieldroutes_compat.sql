-- FieldRoutes import compatibility.
-- External IDs make imports idempotent (re-running updates instead of
-- duplicating) and enable incremental API sync later. Staging tables let an
-- import be reviewed before touching real data.

alter table public.customers
  add column fieldroutes_id bigint,
  add column billing_address_line1 text,
  add column billing_city text,
  add column billing_state text,
  add column billing_zip text,
  add column balance_cents integer;

alter table public.properties add column fieldroutes_id bigint;
alter table public.service_plans add column fieldroutes_id bigint;   -- FR subscriptionID
alter table public.jobs add column fieldroutes_id bigint;            -- FR appointmentID

create unique index customers_fieldroutes_idx
  on public.customers (fieldroutes_id) where fieldroutes_id is not null;
create unique index properties_fieldroutes_idx
  on public.properties (fieldroutes_id) where fieldroutes_id is not null;
create unique index service_plans_fieldroutes_idx
  on public.service_plans (fieldroutes_id) where fieldroutes_id is not null;
create unique index jobs_fieldroutes_idx
  on public.jobs (fieldroutes_id) where fieldroutes_id is not null;

-- ---------- import staging ----------
create table public.import_batches (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source in ('csv', 'api')),
  label text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  summary jsonb
);

create table public.import_staging (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.import_batches (id) on delete cascade,
  entity text not null check (entity in ('customer', 'property', 'service_plan', 'job')),
  external_id bigint,
  payload jsonb not null,
  status text not null default 'pending'
    check (status in ('pending', 'imported', 'skipped', 'error')),
  error text,
  created_at timestamptz not null default now()
);

create index import_staging_batch_idx on public.import_staging (batch_id, status);

alter table public.import_batches enable row level security;
alter table public.import_staging enable row level security;
create policy "admin all" on public.import_batches
  for all using (public.is_admin()) with check (public.is_admin());
create policy "admin all" on public.import_staging
  for all using (public.is_admin()) with check (public.is_admin());
