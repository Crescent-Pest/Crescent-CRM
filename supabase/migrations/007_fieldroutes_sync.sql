-- FieldRoutes outbox queue — one-way push, CRM is the source of truth.
--
-- NOT YET APPLIED to the live database. Run it once in the Supabase SQL editor
-- of the shared Crescent project when the push sync goes live.
--
-- Rows are enqueued by the CRM's server actions (src/lib/fieldroutesSync.ts),
-- deliberately NOT by a database trigger: the FieldRoutes import scripts write
-- these same tables, and trigger-based enqueueing would echo imported data
-- straight back out to FieldRoutes.
--
-- scripts/sync-fieldroutes.mjs drains the queue with the service role key,
-- which bypasses RLS. A queue row only says "this entity changed" — the worker
-- re-reads the current row at sync time, so changed_fields is audit trail.

create table public.fieldroutes_sync_queue (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  entity text not null check (entity in ('customer')),   -- more entities land here later
  entity_id uuid not null,
  fr_action text not null check (fr_action in ('create', 'update')),
  changed_fields jsonb,                  -- audit only, never the push payload
  status text not null default 'pending'
    check (status in ('pending', 'synced', 'failed', 'skipped')),
  attempts int not null default 0,
  last_error text,
  synced_at timestamptz
);

-- the worker's only query: oldest pending rows first
create index fieldroutes_sync_queue_status_idx
  on public.fieldroutes_sync_queue (status, created_at);

-- ---------- RLS ----------
-- Staff enqueue and read (enqueueing happens in server actions under the
-- user's own session). Editing or clearing rows by hand is admin work; the
-- worker uses the service role and bypasses all of this.
alter table public.fieldroutes_sync_queue enable row level security;

create policy "staff read" on public.fieldroutes_sync_queue
  for select using (public.is_active_staff());
create policy "staff insert" on public.fieldroutes_sync_queue
  for insert with check (public.is_active_staff());
create policy "admin update" on public.fieldroutes_sync_queue
  for update using (public.is_admin()) with check (public.is_admin());
create policy "admin delete" on public.fieldroutes_sync_queue
  for delete using (public.is_admin());
