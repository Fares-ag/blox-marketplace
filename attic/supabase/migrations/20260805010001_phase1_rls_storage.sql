-- Phase 1: RLS for marketplace tables + storage bucket setup notes

alter table public.offers enable row level security;
alter table public.products enable row level security;
alter table public.product_images enable row level security;
alter table public.applications enable row level security;
alter table public.application_documents enable row level security;
alter table public.notifications enable row level security;
alter table public.activity_logs enable row level security;

-- Helper: dealer owns company
create or replace function public.current_user_company_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select company_id from public.users where id = auth.uid();
$$;

create or replace function public.is_credit_or_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.users
    where id = auth.uid()
      and role in (
        'credit_officer'::public.user_role,
        'admin'::public.user_role,
        'super_admin'::public.user_role
      )
  );
$$;

create or replace function public.is_ops_finance_or_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.users
    where id = auth.uid()
      and role in (
        'finance_officer'::public.user_role,
        'credit_officer'::public.user_role,
        'admin'::public.user_role,
        'super_admin'::public.user_role
      )
  );
$$;

-- offers: public read active; admin write
create policy offers_select_active
on public.offers for select
to anon, authenticated
using (status = 'active' or public.is_staff_admin());

create policy offers_admin_write
on public.offers for all
to authenticated
using (public.is_staff_admin())
with check (public.is_staff_admin());

-- products: public published (via policy; VIN still in row — use RPC/view for public)
create policy products_select_published
on public.products for select
to anon, authenticated
using (
  listing_status = 'published'
  or public.is_staff_admin()
  or public.is_credit_or_admin()
  or (
    company_id = public.current_user_company_id()
    and exists (
      select 1 from public.users u
      where u.id = auth.uid() and u.role = 'dealer_agent'
    )
  )
  or exists (
    select 1 from public.applications a
    where a.product_id = products.id
      and a.customer_user_id = auth.uid()
      and a.status not in ('rejected', 'submission_cancelled', 'completed')
  )
);

create policy products_dealer_insert
on public.products for insert
to authenticated
with check (
  public.is_staff_admin()
  or (
    company_id = public.current_user_company_id()
    and exists (
      select 1 from public.users u
      where u.id = auth.uid() and u.role = 'dealer_agent'
    )
  )
);

create policy products_dealer_update
on public.products for update
to authenticated
using (
  public.is_staff_admin()
  or (
    company_id = public.current_user_company_id()
    and exists (
      select 1 from public.users u
      where u.id = auth.uid() and u.role = 'dealer_agent'
    )
  )
)
with check (
  public.is_staff_admin()
  or company_id = public.current_user_company_id()
);

create policy products_dealer_delete
on public.products for delete
to authenticated
using (
  public.is_staff_admin()
  or (
    company_id = public.current_user_company_id()
    and listing_status = 'draft'
  )
);

-- product_images
create policy product_images_select
on public.product_images for select
to anon, authenticated
using (
  exists (
    select 1 from public.products p
    where p.id = product_images.product_id
      and (
        p.listing_status = 'published'
        or public.is_staff_admin()
        or public.is_credit_or_admin()
        or p.company_id = public.current_user_company_id()
        or exists (
          select 1 from public.applications a
          where a.product_id = p.id and a.customer_user_id = auth.uid()
        )
      )
  )
);

create policy product_images_write_dealer
on public.product_images for all
to authenticated
using (
  public.is_staff_admin()
  or exists (
    select 1 from public.products p
    where p.id = product_images.product_id
      and p.company_id = public.current_user_company_id()
  )
)
with check (
  public.is_staff_admin()
  or exists (
    select 1 from public.products p
    where p.id = product_images.product_id
      and p.company_id = public.current_user_company_id()
  )
);

-- applications: no direct insert/update of status from client (RPC only) — allow select
create policy applications_select
on public.applications for select
to authenticated
using (
  customer_user_id = auth.uid()
  or public.is_staff_admin()
  or public.is_ops_finance_or_admin()
  or (
    company_id = public.current_user_company_id()
    and exists (
      select 1 from public.users u
      where u.id = auth.uid() and u.role = 'dealer_agent'
    )
  )
);

-- Block direct client writes; RPCs use security definer
create policy applications_no_direct_insert
on public.applications for insert
to authenticated
with check (false);

create policy applications_no_direct_update
on public.applications for update
to authenticated
using (false);

-- documents
create policy application_documents_select
on public.application_documents for select
to authenticated
using (
  exists (
    select 1 from public.applications a
    where a.id = application_documents.application_id
      and (
        a.customer_user_id = auth.uid()
        or public.is_staff_admin()
        or public.is_ops_finance_or_admin()
      )
  )
);

create policy application_documents_insert_owner
on public.application_documents for insert
to authenticated
with check (
  uploaded_by = auth.uid()
  and exists (
    select 1 from public.applications a
    where a.id = application_id
      and a.customer_user_id = auth.uid()
      and a.status in ('under_review', 'resubmission_required', 'draft')
  )
);

-- notifications
create policy notifications_own
on public.notifications for select
to authenticated
using (user_id = auth.uid());

create policy notifications_own_update
on public.notifications for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy notifications_no_direct_insert
on public.notifications for insert
to authenticated
with check (false);

-- activity logs: admin read only
create policy activity_logs_admin_select
on public.activity_logs for select
to authenticated
using (public.is_staff_admin());

create policy activity_logs_no_direct_insert
on public.activity_logs for insert
to authenticated
with check (false);

-- Storage buckets (idempotent)
insert into storage.buckets (id, name, public)
values
  ('listing-images', 'listing-images', true),
  ('kyc-docs', 'kyc-docs', false),
  ('contracts', 'contracts', false)
on conflict (id) do nothing;

-- Public read listing images
create policy listing_images_public_read
on storage.objects for select
to anon, authenticated
using (bucket_id = 'listing-images');

create policy listing_images_dealer_write
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'listing-images'
  and (
    public.is_staff_admin()
    or exists (select 1 from public.users where id = auth.uid() and role = 'dealer_agent')
  )
);

create policy listing_images_dealer_update
on storage.objects for update
to authenticated
using (
  bucket_id = 'listing-images'
  and (
    public.is_staff_admin()
    or exists (select 1 from public.users where id = auth.uid() and role = 'dealer_agent')
  )
);

create policy listing_images_dealer_delete
on storage.objects for delete
to authenticated
using (
  bucket_id = 'listing-images'
  and (
    public.is_staff_admin()
    or exists (select 1 from public.users where id = auth.uid() and role = 'dealer_agent')
  )
);

-- KYC: authenticated owners / ops via path prefix application id checks in app; broad ops read
create policy kyc_docs_select
on storage.objects for select
to authenticated
using (
  bucket_id = 'kyc-docs'
  and (
    public.is_ops_finance_or_admin()
    or public.is_staff_admin()
    or (storage.foldername(name))[1] in (
      select a.id::text from public.applications a where a.customer_user_id = auth.uid()
    )
  )
);

create policy kyc_docs_insert
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'kyc-docs'
  and (storage.foldername(name))[1] in (
    select a.id::text from public.applications a
    where a.customer_user_id = auth.uid()
      and a.status in ('under_review', 'resubmission_required', 'draft')
  )
);
