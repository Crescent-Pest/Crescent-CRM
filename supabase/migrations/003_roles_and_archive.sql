-- Admin-only deletes + recycle bin.
-- Deleting customers is restricted to profiles with role = 'admin' (enforced
-- in RLS, not just the UI). Every customer delete first archives a full JSON
-- snapshot (customer + properties + plans + jobs + notes) to deleted_records.

create or replace function public.is_admin()
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and active and role = 'admin'
  );
$$;

-- Split the catch-all staff policies so DELETE requires admin.
-- (FK cascades from an admin's customer delete bypass RLS by design, so
-- child tables don't block the cascade.)
do $$
declare t text;
begin
  foreach t in array array['customers','properties','service_plans','jobs','customer_notes'] loop
    execute format('drop policy "staff all" on public.%I', t);
    execute format('create policy "staff read" on public.%I for select using (public.is_active_staff())', t);
    execute format('create policy "staff insert" on public.%I for insert with check (public.is_active_staff())', t);
    execute format('create policy "staff update" on public.%I for update using (public.is_active_staff()) with check (public.is_active_staff())', t);
    execute format('create policy "admin delete" on public.%I for delete using (public.is_admin())', t);
  end loop;
end $$;

-- ---------- recycle bin ----------
create table public.deleted_records (
  id uuid primary key default gen_random_uuid(),
  table_name text not null,
  record_id uuid not null,
  payload jsonb not null,
  deleted_by uuid,
  deleted_at timestamptz not null default now()
);

alter table public.deleted_records enable row level security;
create policy "admin read" on public.deleted_records
  for select using (public.is_admin());
-- no insert/update/delete policies: rows are written only by the
-- security definer trigger below and pruned manually if ever needed

create or replace function public.archive_customer()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.deleted_records (table_name, record_id, payload, deleted_by)
  values (
    'customers',
    old.id,
    jsonb_build_object(
      'customer', to_jsonb(old),
      'properties', (
        select coalesce(jsonb_agg(to_jsonb(p)), '[]'::jsonb)
        from public.properties p where p.customer_id = old.id),
      'service_plans', (
        select coalesce(jsonb_agg(to_jsonb(sp)), '[]'::jsonb)
        from public.service_plans sp
        join public.properties p on sp.property_id = p.id
        where p.customer_id = old.id),
      'jobs', (
        select coalesce(jsonb_agg(to_jsonb(j)), '[]'::jsonb)
        from public.jobs j
        join public.properties p on j.property_id = p.id
        where p.customer_id = old.id),
      'notes', (
        select coalesce(jsonb_agg(to_jsonb(n)), '[]'::jsonb)
        from public.customer_notes n where n.customer_id = old.id)
    ),
    auth.uid()
  );
  return old;
end;
$$;

create trigger customers_archive_before_delete
  before delete on public.customers
  for each row execute function public.archive_customer();

-- Logan is the first admin. (Sean's account: after creating it in the
-- dashboard, run the same update with his email.)
update public.profiles set role = 'admin'
where id in (select id from auth.users where email = 'lday@crescent-pest.com');
