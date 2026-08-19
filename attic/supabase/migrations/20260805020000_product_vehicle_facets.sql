-- Product vehicle facets (QatarSale browse parity)
create type public.transmission as enum ('automatic', 'manual');
create type public.drivetrain as enum ('fwd', 'rwd', 'awd', 'four_wd');
create type public.body_type as enum ('sedan', 'suv', 'coupe', 'hatchback', 'pickup', 'van', 'other');

alter table public.products
  add column if not exists transmission public.transmission,
  add column if not exists cylinders int,
  add column if not exists drivetrain public.drivetrain,
  add column if not exists body_type public.body_type,
  add column if not exists warranty_months int,
  add column if not exists warranty_notes text;

create index if not exists products_transmission_idx on public.products (transmission);
create index if not exists products_body_type_idx on public.products (body_type);
create index if not exists products_drivetrain_idx on public.products (drivetrain);
