-- Phase 1: RPCs, reservation trigger, transition subset

create or replace function public.log_activity(
  p_entity_type text,
  p_entity_id uuid,
  p_action text,
  p_from text default null,
  p_to text default null,
  p_metadata jsonb default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.activity_logs (actor_user_id, entity_type, entity_id, action, from_value, to_value, metadata)
  values (auth.uid(), p_entity_type, p_entity_id, p_action, p_from, p_to, p_metadata);
end;
$$;

create or replace function public.notify_user(
  p_user_id uuid,
  p_title text,
  p_body text default null,
  p_link text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (user_id, title, body, link_path)
  values (p_user_id, p_title, p_body, p_link);
end;
$$;

create or replace function public.has_blocking_application(p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.applications
    where customer_user_id = coalesce(p_user_id, auth.uid())
      and status not in (
        'rejected'::public.application_status,
        'submission_cancelled'::public.application_status,
        'completed'::public.application_status
      )
  );
$$;

create or replace function public.sync_listing_reservation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_blocking boolean;
begin
  if tg_op = 'INSERT' or tg_op = 'UPDATE' then
    select exists (
      select 1 from public.applications
      where product_id = new.product_id
        and status not in (
          'rejected'::public.application_status,
          'submission_cancelled'::public.application_status,
          'completed'::public.application_status
        )
    ) into v_blocking;

    if new.status = 'active' then
      update public.products
      set listing_status = 'sold', updated_at = now()
      where id = new.product_id;
    elsif v_blocking then
      update public.products
      set listing_status = 'reserved', updated_at = now()
      where id = new.product_id
        and listing_status in ('published', 'reserved');
    else
      update public.products
      set listing_status = 'published', updated_at = now()
      where id = new.product_id
        and listing_status = 'reserved';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists applications_sync_listing on public.applications;
create trigger applications_sync_listing
after insert or update of status on public.applications
for each row execute function public.sync_listing_reservation();

-- Slug helper
create or replace function public.slugify_product(p_make text, p_model text, p_year int, p_id uuid)
returns text
language sql
immutable
as $$
  select lower(regexp_replace(trim(p_make || '-' || p_model || '-' || p_year::text || '-' || left(p_id::text, 8)), '[^a-z0-9]+', '-', 'g'));
$$;

create or replace function public.list_published_products(
  p_make text default null,
  p_model text default null,
  p_year_min int default null,
  p_year_max int default null,
  p_price_min numeric default null,
  p_price_max numeric default null,
  p_condition public.vehicle_condition default null,
  p_company_id uuid default null,
  p_q text default null,
  p_limit int default 24,
  p_offset int default 0
)
returns table (
  id uuid,
  slug text,
  make text,
  model text,
  trim text,
  model_year int,
  condition public.vehicle_condition,
  color text,
  mileage int,
  description text,
  price numeric,
  finance_eligible boolean,
  company_id uuid,
  company_name text,
  company_logo text,
  primary_image text,
  published_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    p.slug,
    p.make,
    p.model,
    p.trim,
    p.model_year,
    p.condition,
    p.color,
    p.mileage,
    p.description,
    p.price,
    p.finance_eligible,
    p.company_id,
    c.name as company_name,
    c.logo_url as company_logo,
    (
      select pi.storage_path
      from public.product_images pi
      where pi.product_id = p.id
      order by pi.sort_order, pi.created_at
      limit 1
    ) as primary_image,
    p.published_at
  from public.products p
  join public.companies c on c.id = p.company_id
  where p.listing_status = 'published'
    and c.status = 'active'
    and (p_make is null or p.make ilike p_make)
    and (p_model is null or p.model ilike '%' || p_model || '%')
    and (p_year_min is null or p.model_year >= p_year_min)
    and (p_year_max is null or p.model_year <= p_year_max)
    and (p_price_min is null or p.price >= p_price_min)
    and (p_price_max is null or p.price <= p_price_max)
    and (p_condition is null or p.condition = p_condition)
    and (p_company_id is null or p.company_id = p_company_id)
    and (
      p_q is null
      or p.make ilike '%' || p_q || '%'
      or p.model ilike '%' || p_q || '%'
      or coalesce(p.trim, '') ilike '%' || p_q || '%'
    )
  order by p.published_at desc nulls last, p.created_at desc
  limit greatest(1, least(coalesce(p_limit, 24), 100))
  offset greatest(0, coalesce(p_offset, 0));
$$;

create or replace function public.count_published_products(
  p_make text default null,
  p_model text default null,
  p_year_min int default null,
  p_year_max int default null,
  p_price_min numeric default null,
  p_price_max numeric default null,
  p_condition public.vehicle_condition default null,
  p_company_id uuid default null,
  p_q text default null
)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::bigint
  from public.products p
  join public.companies c on c.id = p.company_id
  where p.listing_status = 'published'
    and c.status = 'active'
    and (p_make is null or p.make ilike p_make)
    and (p_model is null or p.model ilike '%' || p_model || '%')
    and (p_year_min is null or p.model_year >= p_year_min)
    and (p_year_max is null or p.model_year <= p_year_max)
    and (p_price_min is null or p.price >= p_price_min)
    and (p_price_max is null or p.price <= p_price_max)
    and (p_condition is null or p.condition = p_condition)
    and (p_company_id is null or p.company_id = p_company_id)
    and (
      p_q is null
      or p.make ilike '%' || p_q || '%'
      or p.model ilike '%' || p_q || '%'
      or coalesce(p.trim, '') ilike '%' || p_q || '%'
    );
$$;

create or replace function public.get_listing_detail(p_slug text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  p public.products%rowtype;
  v_is_applicant boolean := false;
  v_images jsonb;
  v_company jsonb;
  v_offer jsonb;
begin
  select * into p from public.products where slug = p_slug;
  if not found then
    return null;
  end if;

  if p.listing_status = 'reserved' and auth.uid() is not null then
    select exists (
      select 1 from public.applications a
      where a.product_id = p.id
        and a.customer_user_id = auth.uid()
        and a.status not in ('rejected', 'submission_cancelled', 'completed')
    ) into v_is_applicant;
  end if;

  if p.listing_status = 'published'
     or (p.listing_status = 'reserved' and v_is_applicant)
     or public.is_staff_admin()
     or public.is_credit_or_admin()
     or (p.company_id = public.current_user_company_id()) then
    -- ok
  else
    return jsonb_build_object('available', false, 'reason', 'listing_not_available');
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', pi.id,
    'storage_path', pi.storage_path,
    'sort_order', pi.sort_order,
    'alt_text', pi.alt_text
  ) order by pi.sort_order), '[]'::jsonb)
  into v_images
  from public.product_images pi
  where pi.product_id = p.id;

  select jsonb_build_object('id', c.id, 'name', c.name, 'logo_url', c.logo_url)
  into v_company
  from public.companies c where c.id = p.company_id;

  select jsonb_build_object(
    'id', o.id,
    'name', o.name,
    'annual_rent_rate', o.annual_rent_rate,
    'tenure_options', o.tenure_options,
    'min_down_payment_pct', o.min_down_payment_pct
  )
  into v_offer
  from public.offers o
  where o.id = coalesce(p.default_offer_id, '22222222-2222-2222-2222-222222222222'::uuid)
    and o.status = 'active';

  return jsonb_build_object(
    'available', true,
    'availability', case
      when p.listing_status = 'reserved' then 'pending_financing'
      else 'available'
    end,
    'product', jsonb_build_object(
      'id', p.id,
      'slug', p.slug,
      'make', p.make,
      'model', p.model,
      'trim', p.trim,
      'model_year', p.model_year,
      'condition', p.condition,
      'engine', p.engine,
      'color', p.color,
      'mileage', p.mileage,
      'description', p.description,
      'price', p.price,
      'finance_eligible', p.finance_eligible,
      'listing_status', p.listing_status,
      'default_offer_id', p.default_offer_id
      -- VIN intentionally omitted from public payload
    ),
    'images', v_images,
    'company', v_company,
    'offer', v_offer
  );
end;
$$;

create or replace function public.dealer_publish_product(p_product_id uuid)
returns public.products
language plpgsql
security definer
set search_path = public
as $$
declare
  p public.products;
  img_count int;
begin
  select * into p from public.products where id = p_product_id for update;
  if not found then
    raise exception 'listing_not_available' using errcode = 'P0001';
  end if;

  if not public.is_staff_admin()
     and not (p.company_id = public.current_user_company_id()
              and exists (select 1 from public.users where id = auth.uid() and role = 'dealer_agent')) then
    raise exception 'forbidden_role' using errcode = 'P0001';
  end if;

  if p.price is null or p.price <= 0 or p.make is null or p.model is null or p.model_year is null then
    raise exception 'validation_failed' using errcode = 'P0001';
  end if;

  select count(*) into img_count from public.product_images where product_id = p.id;
  if img_count < 1 then
    raise exception 'validation_failed' using errcode = 'P0001';
  end if;

  if not exists (select 1 from public.companies c where c.id = p.company_id and c.status = 'active') then
    raise exception 'validation_failed' using errcode = 'P0001';
  end if;

  update public.products
  set listing_status = 'published',
      published_at = coalesce(published_at, now()),
      updated_at = now()
  where id = p.id
  returning * into p;

  perform public.log_activity('product', p.id, 'publish', 'draft', 'published');
  return p;
end;
$$;

create or replace function public.dealer_unpublish_product(p_product_id uuid)
returns public.products
language plpgsql
security definer
set search_path = public
as $$
declare
  p public.products;
  blocking boolean;
begin
  select * into p from public.products where id = p_product_id for update;
  if not found then
    raise exception 'listing_not_available' using errcode = 'P0001';
  end if;

  if not public.is_staff_admin()
     and not (p.company_id = public.current_user_company_id()
              and exists (select 1 from public.users where id = auth.uid() and role = 'dealer_agent')) then
    raise exception 'forbidden_role' using errcode = 'P0001';
  end if;

  select exists (
    select 1 from public.applications a
    where a.product_id = p.id
      and a.status not in ('rejected', 'submission_cancelled', 'completed')
  ) into blocking;

  if blocking then
    raise exception 'listing_has_active_financing' using errcode = 'P0001';
  end if;

  update public.products
  set listing_status = 'draft', updated_at = now()
  where id = p.id
  returning * into p;

  perform public.log_activity('product', p.id, 'unpublish', 'published', 'draft');
  return p;
end;
$$;

create or replace function public.customer_create_application(
  p_product_id uuid,
  p_offer_id uuid,
  p_customer_snapshot jsonb,
  p_pricing_snapshot jsonb,
  p_installment_plan jsonb default null
)
returns public.applications
language plpgsql
security definer
set search_path = public
as $$
declare
  u public.users;
  p public.products;
  o public.offers;
  app public.applications;
begin
  select * into u from public.users where id = auth.uid();
  if not found or u.role <> 'customer' then
    raise exception 'forbidden_role' using errcode = 'P0001';
  end if;

  if public.has_blocking_application(auth.uid()) then
    raise exception 'blocking_application_exists' using errcode = 'P0001';
  end if;

  select * into p from public.products where id = p_product_id for update;
  if not found
     or p.listing_status <> 'published'
     or not p.finance_eligible then
    raise exception 'listing_not_available' using errcode = 'P0001';
  end if;

  select * into o from public.offers where id = p_offer_id and status = 'active';
  if not found then
    raise exception 'validation_failed' using errcode = 'P0001';
  end if;

  if coalesce(p_customer_snapshot->>'full_name', '') = ''
     or coalesce(p_customer_snapshot->>'phone', '') = ''
     or coalesce(p_customer_snapshot->>'qid', '') = '' then
    raise exception 'validation_failed' using errcode = 'P0001';
  end if;

  insert into public.applications (
    customer_user_id,
    customer_email,
    customer_snapshot,
    product_id,
    company_id,
    offer_id,
    pricing_snapshot,
    status,
    installment_plan,
    submitted_at
  ) values (
    auth.uid(),
    u.email,
    p_customer_snapshot,
    p.id,
    p.company_id,
    o.id,
    p_pricing_snapshot,
    'under_review',
    p_installment_plan,
    now()
  )
  returning * into app;

  -- Update profile QID/phone if empty
  update public.users
  set
    full_name = coalesce(nullif(full_name, ''), p_customer_snapshot->>'full_name'),
    phone = coalesce(nullif(phone, ''), p_customer_snapshot->>'phone'),
    qid = coalesce(nullif(qid, ''), p_customer_snapshot->>'qid')
  where id = auth.uid();

  perform public.log_activity('application', app.id, 'status_transition', null, 'under_review');

  -- Notify credit officers (all-scope) and dealer agents of company
  perform public.notify_user(usr.id, 'New financing application', 'A customer applied for a vehicle.', '/applications/' || app.id::text)
  from public.users usr
  where usr.role = 'credit_officer' and usr.credit_scope = 'all' and usr.is_active;

  perform public.notify_user(usr.id, 'New lead on your stock', 'A customer applied for one of your listings.', '/applications/' || app.id::text)
  from public.users usr
  where usr.role = 'dealer_agent' and usr.company_id = p.company_id and usr.is_active;

  perform public.notify_user(usr.id, 'New financing application', 'Application entered under review.', '/applications/' || app.id::text)
  from public.users usr
  where usr.role in ('admin', 'super_admin') and usr.is_active;

  return app;
end;
$$;

create or replace function public.ops_transition_application(
  p_application_id uuid,
  p_to_status public.application_status,
  p_reason text default null
)
returns public.applications
language plpgsql
security definer
set search_path = public
as $$
declare
  app public.applications;
  from_status public.application_status;
  allowed boolean := false;
begin
  if not public.is_credit_or_admin() and not public.is_staff_admin() then
    raise exception 'forbidden_role' using errcode = 'P0001';
  end if;

  select * into app from public.applications where id = p_application_id for update;
  if not found then
    raise exception 'listing_not_available' using errcode = 'P0001';
  end if;

  from_status := app.status;

  -- Phase 1 subset of matrix
  if from_status = 'under_review' and p_to_status in ('rejected', 'resubmission_required') then
    allowed := true;
  elsif from_status = 'resubmission_required' and p_to_status = 'rejected' then
    allowed := true;
  end if;

  if not allowed then
    raise exception 'invalid_status_transition' using errcode = 'P0001';
  end if;

  if p_to_status in ('rejected', 'resubmission_required') and coalesce(trim(p_reason), '') = '' then
    raise exception 'validation_failed' using errcode = 'P0001';
  end if;

  update public.applications
  set
    status = p_to_status,
    status_reason = p_reason,
    rejection_reason = case when p_to_status = 'rejected' then p_reason else rejection_reason end,
    resubmission_comment = case when p_to_status = 'resubmission_required' then p_reason else resubmission_comment end,
    updated_at = now()
  where id = app.id
  returning * into app;

  perform public.log_activity('application', app.id, 'status_transition', from_status::text, p_to_status::text, jsonb_build_object('reason', p_reason));

  perform public.notify_user(
    app.customer_user_id,
    case
      when p_to_status = 'rejected' then 'Application rejected'
      else 'Documents required'
    end,
    p_reason,
    '/app/applications/' || app.id::text
  );

  return app;
end;
$$;

create or replace function public.customer_resubmit_application(p_application_id uuid)
returns public.applications
language plpgsql
security definer
set search_path = public
as $$
declare
  app public.applications;
begin
  select * into app from public.applications where id = p_application_id for update;
  if not found or app.customer_user_id <> auth.uid() then
    raise exception 'forbidden_role' using errcode = 'P0001';
  end if;
  if app.status <> 'resubmission_required' then
    raise exception 'invalid_status_transition' using errcode = 'P0001';
  end if;

  update public.applications
  set status = 'under_review', updated_at = now()
  where id = app.id
  returning * into app;

  perform public.log_activity('application', app.id, 'status_transition', 'resubmission_required', 'under_review');
  return app;
end;
$$;

create or replace function public.customer_cancel_application(
  p_application_id uuid,
  p_reason text default null
)
returns public.applications
language plpgsql
security definer
set search_path = public
as $$
declare
  app public.applications;
begin
  select * into app from public.applications where id = p_application_id for update;
  if not found or app.customer_user_id <> auth.uid() then
    raise exception 'forbidden_role' using errcode = 'P0001';
  end if;
  if app.status not in ('draft', 'under_review', 'resubmission_required') then
    raise exception 'invalid_status_transition' using errcode = 'P0001';
  end if;

  update public.applications
  set status = 'submission_cancelled', status_reason = p_reason, updated_at = now()
  where id = app.id
  returning * into app;

  perform public.log_activity('application', app.id, 'status_transition', null, 'submission_cancelled');
  return app;
end;
$$;

create or replace function public.admin_create_company_with_dealer(
  p_company_name text,
  p_company_code text,
  p_dealer_user_id uuid,
  p_contact_email text default null
)
returns public.companies
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.companies;
begin
  if not public.is_staff_admin() then
    raise exception 'forbidden_role' using errcode = 'P0001';
  end if;

  insert into public.companies (name, code, status, contact_email)
  values (p_company_name, p_company_code, 'active', p_contact_email)
  returning * into c;

  update public.users
  set role = 'dealer_agent', company_id = c.id
  where id = p_dealer_user_id;

  return c;
end;
$$;

grant execute on function public.has_blocking_application(uuid) to authenticated;
grant execute on function public.list_published_products(text, text, int, int, numeric, numeric, public.vehicle_condition, uuid, text, int, int) to anon, authenticated;
grant execute on function public.count_published_products(text, text, int, int, numeric, numeric, public.vehicle_condition, uuid, text) to anon, authenticated;
grant execute on function public.get_listing_detail(text) to anon, authenticated;
grant execute on function public.dealer_publish_product(uuid) to authenticated;
grant execute on function public.dealer_unpublish_product(uuid) to authenticated;
grant execute on function public.customer_create_application(uuid, uuid, jsonb, jsonb, jsonb) to authenticated;
grant execute on function public.ops_transition_application(uuid, public.application_status, text) to authenticated;
grant execute on function public.customer_resubmit_application(uuid) to authenticated;
grant execute on function public.customer_cancel_application(uuid, text) to authenticated;
grant execute on function public.admin_create_company_with_dealer(text, text, uuid, text) to authenticated;
