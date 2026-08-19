-- Local seed helpers (profiles). Auth users must be created via Auth Admin / signup.
-- See supabase/seed/README.md for the ordered seed procedure.

-- Demo company for dealer tenancy (safe to re-run in local resets)
insert into public.companies (id, name, code, status, can_pay, contact_email)
values (
  '11111111-1111-1111-1111-111111111111',
  'Gulf Motors Demo',
  'GULF',
  'active',
  false,
  'dealer@drivemarket.local'
)
on conflict (id) do nothing;
