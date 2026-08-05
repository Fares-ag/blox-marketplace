# 07 — Build Phases

**Product:** DriveMarket  
**Related:** [`08_CURSOR_BOOTSTRAP.md`](08_CURSOR_BOOTSTRAP.md) · [`09_ACCEPTANCE_TEST_MATRIX.md`](09_ACCEPTANCE_TEST_MATRIX.md) · [`11_DESIGN_GUIDELINES.md`](11_DESIGN_GUIDELINES.md) · [`04_TECH_ARCHITECTURE.md`](04_TECH_ARCHITECTURE.md)

Execute phases in order. Do not start Phase 3 until Phase 2 exit criteria pass.

---

## Phase overview

| Phase | Outcome | Exit criteria (summary) |
|-------|---------|-------------------------|
| 0 Scaffold | Monorepo + Supabase + Auth + users/companies RLS | Apps boot; login works; migration applies clean; tokens wired |
| 1 Marketplace MVP | Publish → browse → apply → under_review + docs | Dealer publishes; guest finds listing; customer applies; listing reserved; credit sees queue |
| 2 Contract + activate | Contract loop + schedules + sold | Full happy path to active without money movement |
| 3 Payments | SkipCash installment pay | Sandbox pay marks schedule paid; webhook idempotent |
| 4 Ops scale | Finance portal + scopes + email reliability | Scoped officers only see assigned companies |
| 5 Polish + Flutter | Compare/SEO/featured + Flutter spec/app | Parity checklist signed off |

---

## Phase 0 — Scaffold

### Goals

- Create monorepo structure and six Vite apps + shared.
- Supabase project local: migrations for `companies`, `users`, enums, RLS baselines.
- Auth login on each app with role guards.
- Design tokens + MUI theme from `11_DESIGN_GUIDELINES.md` wired into shared and visible on marketplace home shell.

### Backlog

1. Root workspace `package.json` + TypeScript base config.
2. `packages/shared` with Supabase client, brand tokens, theme, formatters stub.
3. Scaffold apps: marketplace, dealer, credit, finance, admin, super-admin with ports from `04`.
4. Migration `0001_init_roles_companies_users.sql` — enums, tables, RLS, signup profile trigger.
5. Seed script: one admin, one dealer company+user, one credit, one finance, one customer (local only).
6. Auth pages per app (or shared auth components) + guards.
7. Marketplace `/` placeholder that **matches hero composition rules** in `11` (even with stock image).
8. CI: lint + typecheck.
9. README in repo pointing to `docs/drivemarket/`.

### Acceptance criteria

- [ ] `supabase db reset` applies cleanly locally.
- [ ] Each app starts on its port.
- [ ] Login as seeded roles reaches the correct app shell; wrong role redirected.
- [ ] CSS variables `--dm-*` present; marketplace home uses brand fonts (not Inter/Roboto).
- [ ] No service role key in any `VITE_*` file.
- [ ] Phase 0 tests in `09` pass.

---

## Phase 1 — Marketplace MVP

### Goals

Dealer inventory publish; public search/detail/calculator; customer apply with KYC docs; reservation; credit/admin queue visibility; blocking RPC; notifications stub; activity log.

### Backlog

1. Migrations: `offers`, `products`, `product_images`, `applications`, `application_documents`, `notifications`, `activity_logs`, storage buckets.
2. RPCs: `list_published_products`, `get_listing_detail`, `has_blocking_application`, `customer_create_application`, `dealer_publish_product`, `dealer_unpublish_product`, document upload path.
3. Triggers: reservation sync; updated_at; transition guard (subset: create + reject + resubmit + cancel).
4. Dealer inventory CRUD + image upload + publish.
5. Marketplace browse + detail + calculator.
6. Apply wizard + profile fields.
7. Credit + admin application queue/detail (reject, resubmission_required).
8. In-app notifications on submit/reject/resubmit.
9. Admin create company + dealer invite.

### Acceptance criteria

- [ ] Dealer publishes listing with images; appears in `/vehicles`.
- [ ] Guest opens detail and runs calculator.
- [ ] Verified customer applies; status `under_review`; listing `reserved`; hidden from search.
- [ ] Second apply blocked by RPC.
- [ ] Credit sees application; can reject → listing returns to `published` when no other blockers.
- [ ] KYC files only visible to owner + ops; not in public product payload.
- [ ] VIN not in public API.
- [ ] Design: listing cards + detail follow `11`; home still passes brand test.
- [ ] Phase 1 tests in `09` pass.

---

## Phase 2 — Contract + activate

### Goals

Full happy path to `active` with schedules and `sold` listing; cancel rules; direct-activate policy flag.

### Backlog

1. Expand transition trigger to full matrix in `03`.
2. RPCs: `credit_approve_with_contract`, `customer_submit_signed_contract`, `ops_transition_application`, `credit_activate_application`, `customer_cancel_application`, `customer_resubmit_application`.
3. Contract PDF generate/print + signed upload to `contracts` bucket.
4. Payment schedule generation on activate (no gateway yet).
5. Customer application detail: contract + schedule read-only.
6. Listing → `sold` on activate.
7. Direct activate gated by `allow_direct_activate`.
8. Down-payment statuses optional UI if time; otherwise statuses exist in DB for Phase 3.

### Acceptance criteria

- [ ] Path: under_review → contract_signing_required → contracts_submitted → contract_under_review → pending_finance_activation → active.
- [ ] Schedules rows created; listing `sold`.
- [ ] Finance role cannot activate.
- [ ] Activate twice is idempotent.
- [ ] Customer cancel from under_review unreserves when appropriate.
- [ ] Dealer cannot unpublish reserved listing.
- [ ] Phase 2 tests in `09` pass.

---

## Phase 3 — Payments

### Goals

SkipCash sandbox pay; verify; webhook; can_pay gate; reminders; bank transfer ops path.

### Backlog

1. Tables already have transactions/schedules — add indexes + RLS finalize.
2. Edge Functions: skipcash-payment, verify, webhook, payment-reminders, payment-monitor.
3. RPC `complete_skipcash_payment_atomic`, `current_user_can_pay_for_application`, `finance_mark_schedule_paid`.
4. Marketplace payment UI + callbacks.
5. Admin toggle `can_pay`.
6. Bank transfer reference capture on finance or admin.

### Acceptance criteria

- [ ] With `can_pay=true`, sandbox payment marks schedule `paid`.
- [ ] Webhook replay does not double-apply.
- [ ] `can_pay=false` blocks pay with `company_cannot_pay`.
- [ ] Reminders enqueue outbox rows for due schedules.
- [ ] Phase 3 tests in `09` pass.

---

## Phase 4 — Ops scale

### Goals

Finance portal parity; M2M scopes; dealer notes; email reliability; optional settlement discounts.

### Backlog

1. Finance app screens parity with mark-paid / schedules.
2. Enforce `credit_scope` / `finance_scope` + M2M tables in all ops queries/RPCs.
3. Dealer notes on applications (append-only).
4. Email outbox worker reliability + indexes + monitoring.
5. Optional settlement discount settings on company/offer.

### Acceptance criteria

- [ ] Assigned credit officer cannot see out-of-scope company apps.
- [ ] Finance can mark paid; still cannot activate.
- [ ] Outbox sends or clearly fails with retry.
- [ ] Phase 4 tests in `09` pass.

---

## Phase 5 — Marketplace polish + Flutter

### Goals

Compare, favorites/saved searches, featured, SEO, soft white-label, Flutter customer parity.

### Backlog

1. Compare 2–3 vehicles.
2. Favorites + saved searches tables/UI.
3. Featured listings (`featured_until`) + admin/dealer controls.
4. SEO: slug discipline, sitemap endpoint or static gen, Open Graph tags on detail.
5. Dealer portal white-label: logo + primary accent with contrast safeguards (`11`).
6. Write Flutter customer spec (mirror structure of a Flutter customer app spec) + implement Flutter app against same Supabase.

### Acceptance criteria

- [ ] Compare works for 2–3 ids; deep-linkable query.
- [ ] OG tags present on listing detail.
- [ ] White-label does not break AA contrast or replace marketplace public chrome incorrectly.
- [ ] Flutter parity checklist signed (auth, browse, apply, detail, pay).
- [ ] Phase 5 tests in `09` pass.

---

## Cross-phase constraints (every phase)

- Migrations for every schema change.
- No blockchain, credits, membership, multi-currency.
- UI follows `11_DESIGN_GUIDELINES.md`.
- Server enforces statuses and blocking rules.
- Update activity logs for key transitions.
- Run mapped section of `09_ACCEPTANCE_TEST_MATRIX.md` before declaring phase done.
