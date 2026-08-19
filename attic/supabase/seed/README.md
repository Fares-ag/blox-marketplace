# Local seed procedure (Phase 0)

`supabase db reset` applies migrations, including the demo company
`Gulf Motors Demo` (`11111111-1111-1111-1111-111111111111`).

Auth users are **not** fully creatable from SQL alone in all setups. After reset:

## 1. Create auth users (Supabase Studio → Authentication → Users)

| Email | Password | Role to set on `public.users` |
|-------|----------|-------------------------------|
| `customer@drivemarket.local` | `Password123!` | `customer` |
| `dealer@drivemarket.local` | `Password123!` | `dealer_agent` + `company_id` = demo company |
| `credit@drivemarket.local` | `Password123!` | `credit_officer` (`credit_scope=all`) |
| `finance@drivemarket.local` | `Password123!` | `finance_officer` (`finance_scope=all`) |
| `admin@drivemarket.local` | `Password123!` | `admin` |
| `super@drivemarket.local` | `Password123!` | `super_admin` |

Or use the Admin API / a one-off script with the **service role** (local only).

## 2. Upsert profiles

For each auth user id:

```sql
insert into public.users (id, email, role, company_id, credit_scope, finance_scope, full_name)
values
  ('<customer-uuid>', 'customer@drivemarket.local', 'customer', null, 'assigned', 'assigned', 'Demo Customer'),
  ('<dealer-uuid>', 'dealer@drivemarket.local', 'dealer_agent', '11111111-1111-1111-1111-111111111111', 'assigned', 'assigned', 'Demo Dealer'),
  ('<credit-uuid>', 'credit@drivemarket.local', 'credit_officer', null, 'all', 'assigned', 'Demo Credit'),
  ('<finance-uuid>', 'finance@drivemarket.local', 'finance_officer', null, 'assigned', 'all', 'Demo Finance'),
  ('<admin-uuid>', 'admin@drivemarket.local', 'admin', null, 'all', 'all', 'Demo Admin'),
  ('<super-uuid>', 'super@drivemarket.local', 'super_admin', null, 'all', 'all', 'Demo Super')
on conflict (id) do update set role = excluded.role, company_id = excluded.company_id;
```

## 3. Copy anon key into app env

From `supabase status`, set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in each
`packages/<app>/.env` (never the service role).

## 4. Smoke login

- Marketplace `:5173` as customer  
- Dealer `:5176` as dealer  
- Wrong role on dealer → redirect `?reason=not_dealer`
