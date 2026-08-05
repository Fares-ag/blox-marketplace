-- Phase 1: marketplace domain enums, offers, products, applications, docs, notifications, activity

create type public.listing_status as enum (
  'draft', 'published', 'reserved', 'sold', 'archived'
);

create type public.vehicle_condition as enum ('new', 'used');
create type public.offer_status as enum ('active', 'inactive');

create type public.application_status as enum (
  'draft',
  'under_review',
  'resubmission_required',
  'contract_signing_required',
  'contracts_submitted',
  'contract_under_review',
  'down_payment_required',
  'down_payment_submitted',
  'pending_finance_activation',
  'active',
  'completed',
  'rejected',
  'submission_cancelled'
);

create type public.document_category as enum ('qid', 'salary', 'bank', 'other');

create table public.offers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  annual_rent_rate numeric not null default 0,
  profit_rate numeric,
  tenure_options jsonb not null default '[12,24,36,48,60]'::jsonb,
  insurance_rate_id uuid,
  is_default boolean not null default false,
  status public.offer_status not null default 'active',
  min_down_payment_pct numeric not null default 0,
  company_id uuid references public.companies (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger offers_set_updated_at
before update on public.offers
for each row execute function public.set_updated_at();

create table public.products (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  slug text not null unique,
  make text not null,
  model text not null,
  trim text,
  model_year int not null,
  condition public.vehicle_condition not null default 'used',
  engine text,
  color text,
  mileage int,
  vin text,
  chassis_number text,
  description text,
  price numeric(12,2) not null check (price > 0),
  finance_eligible boolean not null default true,
  default_offer_id uuid references public.offers (id),
  listing_status public.listing_status not null default 'draft',
  published_at timestamptz,
  featured_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index products_listing_published_idx
  on public.products (listing_status, published_at desc);
create index products_make_idx on public.products (make);
create index products_year_idx on public.products (model_year);
create index products_price_idx on public.products (price);
create index products_company_status_idx
  on public.products (company_id, listing_status);

create trigger products_set_updated_at
before update on public.products
for each row execute function public.set_updated_at();

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  storage_path text not null,
  sort_order int not null default 0,
  alt_text text,
  created_at timestamptz not null default now()
);

create index product_images_product_idx on public.product_images (product_id, sort_order);

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  customer_user_id uuid not null references public.users (id),
  customer_email text not null,
  customer_snapshot jsonb not null default '{}'::jsonb,
  product_id uuid not null references public.products (id),
  company_id uuid not null references public.companies (id),
  offer_id uuid not null references public.offers (id),
  pricing_snapshot jsonb not null default '{}'::jsonb,
  status public.application_status not null default 'under_review',
  installment_plan jsonb,
  contract_generated boolean not null default false,
  contract_data jsonb,
  contract_pdf_path text,
  signed_contract_path text,
  agent_user_id uuid references public.users (id),
  rejection_reason text,
  resubmission_comment text,
  status_reason text,
  submitted_at timestamptz,
  activated_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index applications_customer_idx on public.applications (customer_user_id, status);
create index applications_company_idx on public.applications (company_id, status);
create index applications_product_idx on public.applications (product_id, status);
create index applications_status_idx on public.applications (status, created_at desc);

create trigger applications_set_updated_at
before update on public.applications
for each row execute function public.set_updated_at();

create table public.application_documents (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications (id) on delete cascade,
  category public.document_category not null,
  storage_path text not null,
  mime_type text,
  uploaded_by uuid not null references public.users (id),
  created_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  title text not null,
  body text,
  link_path text,
  read_at timestamptz,
  channel text not null default 'in_app',
  created_at timestamptz not null default now()
);

create index notifications_user_idx on public.notifications (user_id, created_at desc);

create table public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references public.users (id),
  entity_type text not null,
  entity_id uuid not null,
  action text not null,
  from_value text,
  to_value text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index activity_logs_entity_idx on public.activity_logs (entity_type, entity_id, created_at desc);

-- Platform default offer
insert into public.offers (id, name, annual_rent_rate, tenure_options, is_default, status, min_down_payment_pct)
values (
  '22222222-2222-2222-2222-222222222222',
  'Standard DriveMarket Finance',
  12.5,
  '[12,24,36,48,60]'::jsonb,
  true,
  'active',
  10
)
on conflict (id) do nothing;
