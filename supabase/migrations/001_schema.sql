-- Crescent CRM v1 schema
-- Staff-only CRM: customers, properties, service plans, jobs & scheduling.

create extension if not exists "pgcrypto";

-- ---------- enums ----------
create type staff_role as enum ('admin', 'office', 'tech');
create type customer_type as enum ('residential', 'commercial');
create type customer_status as enum ('active', 'inactive');
create type plan_frequency as enum ('one_time', 'monthly', 'bimonthly', 'quarterly', 'semiannual', 'annual');
create type job_status as enum ('scheduled', 'in_progress', 'completed', 'canceled');

-- ---------- staff profiles (1:1 with auth.users) ----------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  role staff_role not null default 'office',
  phone text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- auto-create a profile row when a user is created (invite or signup)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', new.email));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- customers ----------
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  type customer_type not null default 'residential',
  status customer_status not null default 'active',
  first_name text not null default '',
  last_name text not null default '',
  company_name text not null default '',
  email text,
  phone text,
  phone_alt text,
  source text,                          -- how they found us (referral, google, etc.)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- residential needs a person name, commercial needs a company name
  constraint customer_has_name check (
    (type = 'residential' and (first_name <> '' or last_name <> ''))
    or (type = 'commercial' and company_name <> '')
  )
);

create index customers_last_name_idx on public.customers (lower(last_name));
create index customers_company_idx on public.customers (lower(company_name));

-- ---------- properties (service addresses) ----------
create table public.properties (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id) on delete cascade,
  label text not null default '',       -- "Home", "Rental on Main St", etc.
  address_line1 text not null,
  address_line2 text,
  city text not null,
  state text not null default 'SC',
  zip text not null,
  access_notes text,                    -- gate codes, dogs, key location
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index properties_customer_idx on public.properties (customer_id);

-- ---------- recurring service plans ----------
create table public.service_plans (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete cascade,
  name text not null,                   -- "Quarterly Pest Control"
  frequency plan_frequency not null default 'quarterly',
  price_cents integer not null default 0 check (price_cents >= 0),
  start_date date not null default current_date,
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index service_plans_property_idx on public.service_plans (property_id);

-- ---------- jobs (scheduled service visits) ----------
create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete cascade,
  service_plan_id uuid references public.service_plans (id) on delete set null,
  assigned_to uuid references public.profiles (id) on delete set null,
  title text not null,                  -- "Quarterly service", "Termite inspection"
  scheduled_date date not null,
  window_start time,                    -- optional arrival window
  window_end time,
  status job_status not null default 'scheduled',
  completion_notes text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index jobs_date_idx on public.jobs (scheduled_date);
create index jobs_assigned_idx on public.jobs (assigned_to);
create index jobs_property_idx on public.jobs (property_id);
create index jobs_status_idx on public.jobs (status);

-- ---------- customer notes (activity log) ----------
create table public.customer_notes (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id) on delete cascade,
  author_id uuid references public.profiles (id) on delete set null,
  body text not null,
  created_at timestamptz not null default now()
);

create index customer_notes_customer_idx on public.customer_notes (customer_id, created_at desc);

-- ---------- updated_at maintenance ----------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger customers_updated_at before update on public.customers
  for each row execute function public.set_updated_at();
create trigger properties_updated_at before update on public.properties
  for each row execute function public.set_updated_at();
create trigger service_plans_updated_at before update on public.service_plans
  for each row execute function public.set_updated_at();
create trigger jobs_updated_at before update on public.jobs
  for each row execute function public.set_updated_at();
