-- Crescent CRM — staff email addresses on profiles
--
-- NOT YET APPLIED to the live Supabase project. Run this ONCE in the SQL
-- editor of the shared Crescent project, after 009_assignments.sql.
--
-- auth.users isn't reachable through PostgREST, so the assignment pings and the
-- 7am digest need the address stored alongside the roster they already read.
-- 002_rls.sql's "staff read profiles" policy covers the new column; nothing
-- outside the staff roster can see it.

alter table public.profiles
  add column email text;

update public.profiles p
  set email = u.email
  from auth.users u
  where u.id = p.id;

-- 001_schema.sql created public.handle_new_user() (fired by the
-- on_auth_user_created trigger on auth.users) to seed the profile row with a
-- name. Replacing the function keeps that trigger pointed at this body, so new
-- invites arrive with an address instead of needing a manual backfill.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.email),
    new.email
  );
  return new;
end;
$$;
