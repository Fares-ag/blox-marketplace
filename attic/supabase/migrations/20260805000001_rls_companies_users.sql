-- DriveMarket Phase 0: RLS for companies + users

alter table public.companies enable row level security;
alter table public.users enable row level security;
alter table public.credit_officer_companies enable row level security;
alter table public.finance_officer_companies enable row level security;

-- companies
create policy companies_select_authenticated
on public.companies for select
to authenticated
using (
  status = 'active'
  or public.is_staff_admin()
  or exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.company_id = companies.id
  )
);

create policy companies_insert_admin
on public.companies for insert
to authenticated
with check (public.is_staff_admin());

create policy companies_update_admin
on public.companies for update
to authenticated
using (public.is_staff_admin())
with check (public.is_staff_admin());

-- users
create policy users_select_self_or_admin
on public.users for select
to authenticated
using (
  id = auth.uid()
  or public.is_staff_admin()
);

create policy users_update_self_profile
on public.users for update
to authenticated
using (id = auth.uid() or public.is_staff_admin())
with check (
  (
    id = auth.uid()
    and role = (select role from public.users where id = auth.uid())
    and company_id is not distinct from (select company_id from public.users where id = auth.uid())
  )
  or public.is_staff_admin()
);

create policy users_insert_admin
on public.users for insert
to authenticated
with check (public.is_staff_admin());

-- M2M scope tables: admin manage; officers read own rows
create policy credit_m2m_select
on public.credit_officer_companies for select
to authenticated
using (user_id = auth.uid() or public.is_staff_admin());

create policy credit_m2m_admin_write
on public.credit_officer_companies for all
to authenticated
using (public.is_staff_admin())
with check (public.is_staff_admin());

create policy finance_m2m_select
on public.finance_officer_companies for select
to authenticated
using (user_id = auth.uid() or public.is_staff_admin());

create policy finance_m2m_admin_write
on public.finance_officer_companies for all
to authenticated
using (public.is_staff_admin())
with check (public.is_staff_admin());
