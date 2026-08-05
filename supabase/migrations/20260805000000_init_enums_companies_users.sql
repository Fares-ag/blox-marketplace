-- DriveMarket Phase 0: enums, companies, users, updated_at helper
-- Source of truth: docs/drivemarket/03_DOMAIN_MODEL.md

create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create type public.user_role as enum (
  'customer',
  'dealer_agent',
  'credit_officer',
  'finance_officer',
  'admin',
  'super_admin'
);

create type public.company_status as enum ('active', 'inactive');
create type public.officer_scope as enum ('all', 'assigned');

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text unique,
  status public.company_status not null default 'active',
  can_pay boolean not null default false,
  logo_url text,
  branding jsonb,
  contact_email text,
  contact_phone text,
  address text,
  allow_direct_activate boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger companies_set_updated_at
before update on public.companies
for each row execute function public.set_updated_at();

create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  role public.user_role not null,
  company_id uuid references public.companies (id),
  credit_scope public.officer_scope not null default 'assigned',
  finance_scope public.officer_scope not null default 'assigned',
  full_name text,
  phone text,
  qid text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dealer_requires_company check (
    role <> 'dealer_agent'::public.user_role or company_id is not null
  )
);

create trigger users_set_updated_at
before update on public.users
for each row execute function public.set_updated_at();

create index users_role_idx on public.users (role);
create index users_company_id_idx on public.users (company_id);

create table public.credit_officer_companies (
  user_id uuid not null references public.users (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, company_id)
);

create table public.finance_officer_companies (
  user_id uuid not null references public.users (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, company_id)
);

-- Helper: current user's role
create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.users where id = auth.uid();
$$;

create or replace function public.is_staff_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.users
    where id = auth.uid()
      and role in ('admin'::public.user_role, 'super_admin'::public.user_role)
  );
$$;
