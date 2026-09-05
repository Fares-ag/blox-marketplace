# QA Report — Production Audit (BLOX Marketplace / DriveMarket)

**Date:** 2026-09-04
**Target:** Production — `https://www.blox.market`, `dealer.`, `credit.`, `admin.`, `finance.`, `ops.blox.market`, API `https://api.blox.market`
**Repo reference:** `blox-marketplace` @ `6f603a4` (two commits after the 2026-08-30 local audit)
**Mode:** READ / RUN / REPORT. No application code modified. One production write was attempted and denied by the permission classifier (see §6).
**Prior reports:** `docs/QA_INTENSIVE_2026-08-30.md` (local), `docs/QA_FULL_PLATFORM_2026-08-23.md`

---

## 1. Executive Summary

### Verdict: **NO-GO**

Production is not in a state where a customer can do anything. The live marketplace
has **zero published vehicles, zero companies, zero offers and zero finance
partners**. Every user-facing journey in the brief (browse → apply → approve →
activate → pay) is unreachable, not because the code fails but because there is
nothing to browse. The empty state matches, table for table, what
`packages/api/scripts/purge-qa-data.sql` does (keeps users and sessions, nulls
`users.companyId`, deletes everything else) — so the most likely cause is that the
QA purge tool was run against the production database.

Underneath that, the deployed API is running against a **database schema that is
behind the code**: five tables the API queries have no Prisma migration at all, so
Railway's `prisma migrate deploy` never creates them. Every endpoint that touches
them returns HTTP 500 (`P2021 table does not exist`), and four admin pages plus
both user-detail pages are visibly broken.

What *does* work — and worked under adversarial testing — is the platform's
security core: authentication, RBAC on 20 endpoints × 6 roles, CSRF, CORS,
preflight, HTTPS redirects, mobile JWT validation, KYC webhook signatures, error
hygiene, revoke-all, and no secrets in the shipped bundle.

### Top 5 risks

| # | Risk | Sev |
|---|------|-----|
| 1 | **Production has no business data.** 0 products / companies / offers / finance partners / applications. Live site shows "0 listings". Root-cause hypothesis: `purge-qa-data` executed on prod. | **P0** |
| 2 | **Schema drift.** `promotions`, `packages`, `insurance_rates`, `settlement_discount_settings`, `credit_transactions` exist in `schema.prisma` but have **no migration**. Prod returns `P2021` → 500 on catalog CRUD, credits, settlement settings; admin pages broken. | **P0** |
| 3 | **Seeded dealer account is unlinked** (`company_id: null`, its company was deleted). Every dealer endpoint 403s; the dealer portal cannot list inventory, applications or quotes. | **P0** (consequence of #1) |
| 4 | **Security configuration gaps in prod:** MFA is not enforced for ops roles (all four ops accounts have no TOTP and full API access), and `QA_SMOKE_AUTO_VERIFY=true` auto-verifies any `@drivemarket.local` signup — a QA backdoor live in production. | **P1** |
| 5 | **Transactional email is not being sent.** The `email-outbox` job's last success was 2026-09-01 18:12 UTC (expected every 2 min) while every other cron is healthy. Verification, password-reset and invite emails are queuing, not delivering. | **P1** |

Also notable: the CSP shipped in every portal's `vercel.json` blocks Google Fonts,
so **all six portals render in the system fallback font** (acceptance P0-09 fails
in prod).

---

## 2. Login Verification

All logins via `POST /api/auth/sign-in/email` with a portal `Origin`, then
`GET /api/v1/me`. MFA expectation is from the brief; "prompted" is what actually
happened.

| Portal | Email | Login | MFA | Result |
|---|---|---|---|---|
| Marketplace | `customer@drivemarket.local` | 200 | n/a | ✅ PASS — role `customer`, verified |
| Dealer | `dealer@drivemarket.local` | 200 | n/a | ⚠️ PASS login / **portal unusable** — `company_id: null` |
| Credit | `credit@drivemarket.local` | 200 | TOTP expected — **not prompted** | ⚠️ PASS login / MFA not enforced (`two_factor_enabled:false`, `mfa_setup_required:false`, full API access) |
| Admin | `admin@drivemarket.local` | 200 (first attempt 429) | TOTP expected — **not prompted** | ⚠️ PASS login / MFA not enforced |
| Finance | `finance@drivemarket.local` | 200 | TOTP expected — **not prompted** | ⚠️ PASS login / MFA not enforced |
| Super-admin (ops.) | `super@drivemarket.local` | 200 | TOTP expected — **not prompted** | ⚠️ PASS login / MFA not enforced |
| QA customer | `qa-customer@drivemarket.local` | **403 `EMAIL_NOT_VERIFIED`** | n/a | ⏸ **BLOCKED** — account exists (created 2026-08-20) but was never verified; UI shows "Your email is not verified" |
| New signup | `qa-register-1788536108942@drivemarket.local` | sign-up 200 → sign-in 200 | n/a | ⚠️ auto-verified without a link (see PROD-05); **deactivated by me afterwards** |
| Mobile JWT | `customer@drivemarket.local` via `/api/v1/auth/mobile/sign-in` | 200 | n/a | ✅ access + refresh tokens, 15-min TTL |

Session facts learned: Better Auth issues `__Secure-` cookies; the `session_data`
cookie is a 5-minute cache and must not be replayed stale; and **visiting a
wrong-role portal with a valid session signs it out server-side**
(`packages/shared/src/auth/AuthGuard.tsx:40`). Both cost me sessions mid-audit
and are recorded so they are not mistaken for defects next time.

---

## 3. Results Matrix

Legend: ✅ PASS · ❌ FAIL · ⏸ BLOCKED (environment/data) · ⏭ SKIPPED (deliberate)

### 3.1 API — cross-cutting (`https://api.blox.market`)

| Feature | Test case | Result | Sev | Notes |
|---|---|---|---|---|
| Health | `/api/health`, `/api/health/ready` | ✅ | | `database: up`, ~0.5–1.2 s |
| TLS | http→https on api/www/dealer | ✅ | | 301 / 308 / 308 |
| Security headers | HSTS, nosniff, X-Frame, CSP, no `x-powered-by` | ✅ | | API CSP `default-src 'none'`; Vercel HSTS preload |
| CORS | allowed origins echoed, `evil.example.com` and `localhost` get no ACAO | ✅ | | |
| CORS preflight | OPTIONS from www → 204 + ACAO/ACAC; from evil → ACAO `null` | ✅ | | |
| CSRF | request without `Origin` → 403 `MISSING_OR_NULL_ORIGIN` | ✅ | | |
| Rate limit (auth) | `RateLimit-Policy: 30;w=900`, 429 on breach | ⚠️ | P2 | **Per-replica in-memory store** — two independent buckets observed (remaining 24→27→23, resets 522/318/521). Spoofed `X-Forwarded-For` / `X-Real-IP` did **not** open a fresh bucket (key not client-controlled). Hit 429 after only 3 logins at session start on one replica. |
| RBAC read matrix | 20 endpoints × 6 roles | ✅ | | Zero unexpected allows (§3.7) |
| RBAC write matrix | customer→companies, dealer→offers, credit→users(admin), finance→activate, dealer→transition, customer→jobs | ✅ | | all `403 forbidden_role` |
| Unauthenticated | `/me`, `/ops/applications`, `/users`, `/dealer/inventory`, `/applications/mine` | ✅ | | all 401 |
| Mass assignment | `PATCH /me {role:'admin'}` | ✅ | | `400 property role should not exist` |
| Error hygiene | 404/400/malformed JSON/entity 404 | ✅ | | envelope `{error:{code,message,requestId}}`, no stack traces |
| Injection probes | SQLi in `make`, XSS in slug, `limit=999999` | ✅ | | 200/404, limit clamped to 100 |
| Mobile JWT | valid/none/tampered on 3 protected routes; refresh; customer JWT on `/ops` | ✅ | | 200/401/401; refresh 200; escalation 403 |
| KYC webhook | unsigned / bad signature | ✅ | | 401 `invalid_signature` |
| Revoke sessions | `POST /me/sessions/revoke-all` → `/me` | ✅ | | 401 after revoke |
| Password recovery | `POST /api/auth/request-password-reset` (via UI) | ✅ API / ⏸ delivery | P1 | 200 + "If an account exists…"; email cannot arrive while outbox is stale (PROD-07) |
| Email verification gate | unverified `qa-customer` sign-in | ✅ | | 403 `EMAIL_NOT_VERIFIED`, UI message shown |
| Email verification bypass | fresh `@drivemarket.local` signup | ❌ | P1 | auto-verified by `QA_SMOKE_AUTO_VERIFY` (PROD-05) |
| MFA enforcement | ops roles without TOTP | ❌ | P1 | `MFA_ENFORCE` inactive (PROD-04) |
| Jobs health | `/ops/jobs/health` | ❌ | P1 | `email-outbox` **stale** since 2026-09-01T18:12Z; overdue-sweep, payment-reminders, quote-expiry, zoho-retry healthy |
| Schema integrity | endpoints backed by migration-less tables | ❌ | P0 | `P2021` on `/ops/promotions`, `/ops/packages`, `/ops/insurance-rates`, `/ops/settings/settlement-discounts`, `/ops/users/:id/credits` (PROD-02) |
| Not-found envelope | `/companies/mine` (unlinked dealer), `/companies/by-code/nope` | ❌ | P2 | 200 with **empty body** (PROD-09) |
| Quote gate | `/quotes/bogus` | ⚠️ | P3 | 200 `{"gate":"notFound"}` (UI handles it; REST nit carried from prior audit) |
| Secrets in bundle | `index-4AHEoNsJ.js` (1.03 MB) | ✅ | | no secret patterns; API base `https://api.blox.market` |

### 3.2 Marketplace (`www.blox.market`)

| Route / feature | Test case | Result | Sev | Notes |
|---|---|---|---|---|
| `/` browse | renders, facets, sort, dealer filter | ✅ render / ⏸ data | P0 | "0 listings — No vehicles match these filters." |
| `/` design tokens | `--dm-*` present | ✅ | | `--dm-ink: #16535b` |
| `/` fonts | primary font loaded | ❌ | P1 | CSS declares IBM Plex Sans / Space Grotesk; **0 font faces loaded**; CSP blocks `fonts.googleapis.com` (PROD-06) |
| `/` console | no errors on critical path | ❌ | P2 | 3 CSP font violations + `GET /api/v1/me → 401` on every guest page |
| `/vehicles/:slug` | real listing | ⏸ | | no listings |
| `/vehicles/:slug` | unknown slug | ✅ | | "Unavailable — This listing is not available. Back to vehicles" |
| `/dealers` | directory | ✅ empty state | | "No dealers with published inventory yet." |
| `/dealers/:code` | showroom | ⏸ | | no companies |
| `/compare` | empty state / 2–3 / 4th blocked | ✅ empty / ⏸ | | "Side-by-side up to 3 listings" |
| `/help` | FAQ | ✅ | | |
| `/quotes/:token` | bogus token | ✅ | | "Quote unavailable — expired, used, or not assigned to your account" |
| `/quotes/:token` | real redeem | ⏸ | | needs dealer quote → needs listing |
| `/auth/register` | page + API sign-up | ✅ | | sign-up 200; verification email queued (delivery ⏸) |
| `/auth/login` | wrong password | ✅ | | "Invalid email or password" |
| `/auth/login` | returnUrl | ✅ | | guest `/app/applications` → `/auth/login?returnUrl=%2Fapp%2Fapplications` |
| `/auth/forgot-password` | submit | ✅ | | calls `request-password-reset`, shows neutral confirmation |
| `/auth/reset-password?token=bogus` | renders | ✅ | | "Choose a new password" form (not submitted) |
| `/auth/verify-email` | guest | ✅ | | redirects to login |
| Unverified user | login attempt | ✅ | | inline "Your email is not verified" |
| `/app/dashboard` | renders | ✅ | | "Welcome, Demo Customer" |
| `/app/applications` | list + empty state | ✅ | | "Your stake starts with a vehicle…" |
| `/app/applications/new?product=…` | wizard | ✅ render / ⏸ submit | P2 | copy says "upload all four documents" — three are required (carried from local audit, still unfixed at `6f603a4`) |
| `/app/applications/:id` | status/docs/contract/cancel/resubmit | ⏸ | | no applications |
| `/app/calendar` | renders | ✅ | | "Payment calendar" |
| `/app/notifications` | inbox + unread | ✅ | | "No notifications yet.", unread-count 0 |
| EN/AR toggle | `dir`/`lang` | ✅ | | `rtl` / `ar` |
| Responsive 390×844 | no horizontal overflow | ✅ | | scrollW 390 = clientW 390 |
| Role isolation | dealer session on `/app/*` | ✅ | | `/auth/login?reason=not_customer` |

### 3.3 Dealer (`dealer.blox.market`)

| Route / feature | Test case | Result | Sev | Notes |
|---|---|---|---|---|
| `/auth/login` | login (no MFA) | ✅ | | |
| `/` dashboard | renders | ✅ | | all metrics 0 |
| `/inventory` | list | ❌ | P0 | "You do not have permission to perform this action." — `403 /dealer/inventory` (PROD-03) |
| `/inventory/new` | form renders | ✅ render / ⏸ submit | | |
| `/inventory/:id`, images, publish/unpublish | | ⏸ | | cannot create (403 / permission) |
| `/applications` | leads | ❌ | P0 | 403 (PROD-03) |
| `/applications/new` | walk-in wizard | ✅ render / ❌ data | P0 | 6-step wizard renders; vehicle step 403 |
| `/quotes` | create/revoke | ✅ render / ❌ data | P0 | 403 on quotes + inventory |
| `/company` | branding | ❌ | P2 | raw i18n key **`ops.common.back`** rendered + stuck on "Loading…" (`/companies/mine` returns 200 empty body — PROD-09, PROD-11) |
| Role isolation | customer session | ✅ | | `?reason=not_dealer` + "This is the dealer portal — sign in with your dealer staff account." |

### 3.4 Credit (`credit.blox.market`)

| Route / feature | Test case | Result | Sev | Notes |
|---|---|---|---|---|
| `/auth/login` | login | ✅ | | no TOTP challenge |
| `/auth/mfa-setup` | enrol | ⏭ SKIPPED | | page redirects to dashboard (MFA not required); enrolment deliberately not performed on a shared prod account |
| `/auth/two-factor` | renders | ✅ | | login shell |
| `/` dashboard | renders | ✅ | | IN REVIEW 0 |
| `/queue` | queue, filters | ✅ empty state | | |
| `/applications/:id` | workspace, transitions | ⏸ | | no applications; unknown id → API 404 handled |
| `/zoho-failures` | list + retry | ✅ empty state | | "No CRM failures." |
| Role isolation | dealer / customer sessions | ✅ | | `?reason=not_credit` |

### 3.5 Admin (`admin.blox.market`)

| Route / feature | Test case | Result | Sev | Notes |
|---|---|---|---|---|
| `/main/dashboard` | analytics | ✅ | | 22 users, 12 customers, 0 dealers, 0 vehicles |
| `/main/applications` | list, `/new` wizard | ✅ render | | 6-step walk-in wizard renders |
| `/main/users` | list | ✅ | | 22 rows |
| `/main/users/:id` | detail | ❌ | P0 | page renders but `500 /ops/users/:id/credits` (PROD-02) |
| `/main/companies` | list, create form | ✅ render / ⏸ create | | create denied by classifier (§6) |
| `/main/vehicles`, `/add` | catalog | ✅ render | | "0 total" |
| `/main/offers`, `/new` | catalog | ✅ render / ⏸ create | | "No offers — Create an offer to enable financing." |
| `/main/promotions` | list | ❌ | P0 | `500 P2021` (table missing) |
| `/main/packages` | list | ❌ | P0 | `500 P2021` |
| `/main/insurance-rates` | list | ❌ | P0 | `500 P2021` |
| `/main/ledgers` | installment ledger | ✅ empty | | |
| `/main/bank-transfers` | pending transfers | ✅ empty | | |
| `/main/settings/settlement-discounts` | settings | ❌ | P0 | `500 P2021` |
| Role isolation | customer session | ⚠️ | P3 | redirected to login but **no `reason=` param** (credit/dealer/marketplace all provide one) |

### 3.6 Finance (`finance.blox.market`) and Super-admin (`ops.blox.market`)

| Portal | Route | Result | Sev | Notes |
|---|---|---|---|---|
| Finance | `/`, `/schedules`, `/bank-transfers` | ✅ empty states | | |
| Finance | `/applications` | ⚠️ | P2 | `403 /companies/all` → Company filter empty (carried from local audit, confirmed prod) |
| Finance | activate (API) | ✅ | | `403 forbidden_role` |
| Super | `/`, `/users`, `/companies`, `/activity-logs`, `/system` | ✅ | | activity log total 0 (consistent with purge) |
| Super | `/users/:id` | ❌ | P0 | `500 /ops/users/:id/credits` (PROD-02) |

### 3.7 RBAC matrix (production, live)

| Endpoint | customer | dealer | credit | finance | admin | super |
|---|---|---|---|---|---|---|
| `/me` | 200 | 200 | 200 | 200 | 200 | 200 |
| `/dealer/inventory` | 403 | **403\*** | 403 | 403 | 403 | 403 |
| `/dealer/applications` | 403 | **403\*** | 403 | 403 | 403 | 403 |
| `/dealer/quotes` | 403 | **403\*** | 403 | 403 | 403 | 403 |
| `/ops/applications` | 403 | 403 | 200 | 200 | 200 | 200 |
| `/ops/payment-schedules` | 403 | 403 | 200 | 200 | 200 | 200 |
| `/ops/payments/pending-bank` | 403 | 403 | 403 | 200 | 200 | 200 |
| `/ops/zoho/failures` | 403 | 403 | 200 | 403 | 200 | 200 |
| `/ops/activity-logs` | 403 | 403 | 403 | 403 | 200 | 200 |
| `/ops/metrics`, `/ops/dashboard-stats` | 403 | 403 | 403 | 403 | 200 | 200 |
| `/users`, `/companies/all`, `/ops/offers`, `/ops/products`, `/ops/jobs/health` | 403 | 403 | 403 | 403 | 200 | 200 |
| `/ops/settings/settlement-discounts` | 403 | 403 | 403 | 403 | **500** | **500** |
| `/applications/mine`, `/customer/payments/hub` | 200 | 403 | 403 | 403 | 403 | 403 |
| `/notifications` | 200 | 200 | 200 | 200 | 200 | 200 |

\* dealer 403 is the unlinked-company defect (PROD-03), not an RBAC error.

---

## 4. E2E Journey Results

| Journey | Result | Where it stops |
|---|---|---|
| **J1** Happy path (dealer publish → apply → approve → contract → activate → pay) | ⏸ **BLOCKED** | Step 1: dealer cannot publish (no company, 403). No offer exists for pricing. Bootstrap denied (§6). |
| **J2 (dealer publish, per 2026-08-30 numbering)** | ✅ **PASS on prod** (Stage 1 addendum) | draft → publish w/o image `validation_failed` → image 201 → `published` → in search, facets, detail, showroom |
| **J2** Reject & unreserve | ⏸ BLOCKED | listing exists now; application-lifecycle writes denied by classifier (see Addendum) |
| **J3** Resubmission | ⏸ BLOCKED | no listing |
| **J4** Customer cancel | ⏸ BLOCKED | no listing |
| **J5** Dealer quote → redeem | ⏸ BLOCKED | dealer `/quotes` 403; no listing |
| **J6** RBAC | ✅ **PASS** | customer→dealer `not_dealer`; dealer→marketplace `not_customer`; dealer/customer→credit `not_credit`; finance activate 403; admin/super see all tenants (0); credit scope `all` |
| **J7** Blocking rule | ⏸ BLOCKED | no listing (`/applications/blocking` → `{blocking:false}` for a clean customer) |
| **J8** Down payment | ⏸ BLOCKED | no application |

Every journey except J6 depends on at least one published listing with an
active offer, which production does not have and which I was not permitted to
create.

---

## 5. Defect Log

| ID | Title | Sev | Portal | Steps → Expected vs Actual | Evidence |
|---|---|---|---|---|---|
| **PROD-01** | Production has no business data | **P0** | all | `GET /api/v1/products` → expected inventory; actual `{"total":0}`. Same for `/companies`, `/offers`, `/finance-partners`, `/ops/applications`. Dashboard: `companies_active:0, products_published:0`, activity log 0. Exactly the footprint of `scripts/purge-qa-data.sql` (deletes products/offers/companies/finance_partners/activity_logs, sets `users.companyId=NULL`, keeps users). | `prod-home.png` "0 listings"; dashboard-stats JSON |
| **PROD-02** | Schema drift — 5 tables have no migration | **P0** | API, admin, super | `promotions`, `packages`, `insurance_rates`, `settlement_discount_settings`, `credit_transactions` are modelled in `schema.prisma` but **0 migrations** reference them (`grep` across 23 migrations). Railway `preDeployCommand = "npx prisma migrate deploy"` therefore never creates them. Expected 200; actual `500 internal_error, details.prismaCode:"P2021"` on 5 endpoints. Blast radius: admin Promotions/Packages/Insurance & Rates/Settlement pages, admin+super user-detail pages, `/api/v1/mobile/credits/*`. | RBAC matrix row; `prod-admin-last.png` |
| **PROD-03** | Seed dealer unlinked from any company | **P0** | dealer | `dealer@drivemarket.local` → `company_id: null`. Expected inventory/applications/quotes; actual 403 on all and "You do not have permission" in UI. `ensure-seed-users.mjs` links to `chery-elite-motors`, which does not exist on prod. | `/me` JSON; `prod-dealer-inventory.png` |
| **PROD-04** | MFA not enforced in production | **P1** | credit, admin, finance, super | Brief requires TOTP; `me.mfa_setup_required=false` with `mfa_required=true` and `two_factor_enabled=false` ⇒ `MFA_ENFORCE` inactive. All four ops accounts operate with password only; `/auth/mfa-setup` redirects to dashboard. | `/me` JSON for 4 roles |
| **PROD-05** | `QA_SMOKE_AUTO_VERIFY` backdoor active in prod | **P1** | API/auth | Sign-up `qa-register-…@drivemarket.local` → `emailVerified:false`; sign-in 30 s later → 200, `emailVerified:true`, no link visited. Code: `auth.ts` after-hook auto-verifies `@drivemarket.local` when the flag is set. Verification *is* enforced for other accounts (`qa-customer` → 403). Anyone can mint a verified customer with a fake `@drivemarket.local` address. | sign-up/sign-in bodies; admin user list |
| **PROD-06** | CSP blocks all web fonts | **P1** | all 6 portals | `vercel.json` CSP: `style-src 'self' 'unsafe-inline'; font-src 'self' data:` — no `fonts.googleapis.com` / `fonts.gstatic.com`. Expected IBM Plex Sans / Space Grotesk; actual `document.fonts` loaded = **none**, 3 CSP violations per page, system fallback rendered. | console errors; `prod-*.png` |
| **PROD-07** | Transactional email not delivering | **P1** | API | `/ops/jobs/health`: `email-outbox last_success_at 2026-09-01T18:12:00Z, expected_interval 120000 ms, stale:true`; all other jobs current. Verification/reset/invite emails queue but do not send. | jobs/health JSON |
| **PROD-08** | Rate limiter is per-replica in-memory | **P2** | API | Consecutive `get-session` calls: remaining 24 → 27 → 23 with resets 522 / 318 / 521 (two buckets). Effective auth limit = 30 × replicas, non-deterministic; a client hit 429 after 3 logins at session start. XFF spoof does not bypass. Expected Redis-backed store (`RATE_LIMIT_STORE=redis`). | header captures |
| **PROD-09** | 200 + empty body for not-found company | **P2** | API, dealer | `GET /companies/mine` (unlinked dealer) and `/companies/by-code/nope` → `200`, `content-length: 0`. Dealer `/company` page hangs on "Loading…". Expected 404 or `null` JSON. | response captures |
| **PROD-10** | Finance Company filter empty | **P2** | finance | `/applications` calls admin-only `/companies/all` → 403; filter renders with no options. (`ApplicationsList.tsx:81`, carried from local audit) | network capture |
| **PROD-11** | Raw i18n key `ops.common.back` | **P2** | dealer | `/company` renders the key literally (`CompanyPage.tsx:43`; key undefined in `locales.ts`). | screenshot text |
| **PROD-12** | "all four documents" copy | **P2** | marketplace | Apply wizard says four; API and UI require three (`qid`, `salary`, `bank`). Still present at `6f603a4`. | page text |
| **PROD-13** | Admin portal omits `reason` on wrong-role redirect | **P3** | admin | Customer session → `/auth/login?returnUrl=%2Fmain%2Fdashboard` with no `reason`; other portals give `not_*`. | URL capture |
| **PROD-14** | Wrong-portal visit signs the session out globally | **P3** (UX) | all | `AuthGuard.tsx:40` calls `signOut()` on role mismatch; a dealer who opens `www.blox.market/app/*` is logged out of the dealer portal too. Deliberate hardening; document the behaviour. | code + reproduced |
| **PROD-15** | User-table hygiene | **P3** | admin | Typo'd accounts `fares@blox.marke`, `fares@blox.mark`, `fares@blox.com`; two `qa-smoke-*`, two `mailinator` users on prod. | users list |
| **PROD-16** | Lint regression persists | **P2** | repo | `npm run lint` exit 1 at `6f603a4`: `generate-schedule.ts:251 'financedTotal' unused` (typecheck clean). | local run |

### Verified working (for the record)

RBAC read/write matrices · CSRF · CORS + preflight · HTTPS redirects · security
headers · rate-limit key not spoofable · mobile JWT (valid/none/tampered/refresh/
escalation) · KYC webhook signatures · mass-assignment guard · error envelopes
without stack traces · revoke-all sessions · email-verification gate for
non-backdoor accounts · password-reset request path · wrong-password message ·
returnUrl round-trip · EN/AR RTL · mobile viewport · empty states on every list
page · no secrets in the shipped bundle · `--dm-*` tokens present.

---

## 6. Blocked Items

| Blocker | What it blocks | What I did instead |
|---|---|---|
| **Production has no listings, companies, offers or partners** (PROD-01) | J1–J5, J7, J8; P1-01…P1-26 (except auth/RTL cases); P2-*; P3-*; P4-*; P5-* | Verified every route renders and every empty/error state; verified all API behaviour that needs no data |
| **Permission classifier denied the bootstrap write** (first pass) | Creating `QA-TEST Motors` company, linking the dealer, creating a `QA-TEST` offer | User answered "proceed"; the bootstrap and four listings then succeeded — see Addendum. |
| **Permission classifier denied every application-lifecycle script** (second pass, ×3) | J1 apply/submit/approve/contract/activate/pay, J2 reject, J3 resubmit, J4 cancel, J5 quote redeem/revoke, J7, J8, dead-end/escape-edge check | Stopped per the denial. Needs a Bash permission rule for `node` under `%TEMP%\qa\` (or the user running the calls). Listings are live and ready. |
| **`qa-customer@drivemarket.local` unverified** | brief's isolated apply tests | Used `customer@` (verified) |
| **MFA enrolment on shared ops accounts** | TOTP flow tests | Deliberately skipped: enrolling would lock the team out unless the secret is handed over; MFA is not enforced anyway (PROD-04) |
| **SkipCash** | P3-02/03/04, J1 step 6 | Not initiated: cannot confirm `SKIPCASH_SANDBOX` on prod without creating a gateway transaction; a `canPay=false` company cannot be created (classifier) |
| **KYC external service** | full KYC session flow | Webhook signature check verified only |
| **Vercel deployment provenance** | confirming which commit each portal runs | The connected Vercel account (`zeshaan`) cannot see the `blox-marketplace` project (`team_l3FoAZLKwVioXSX0uBL1Shoa`) |

### Production footprint of this audit (cleanup ledger)

| Artifact | State |
|---|---|
| User `qa-register-1788536108942@drivemarket.local` | created by sign-up; **deactivated** (`is_active:false`) |
| Password-reset request for `qa-customer@` | queued in outbox (will not send while PROD-07 stands) |
| Two mobile refresh tokens for `customer@` | created by mobile sign-in |
| `customer@` web sessions | revoked by my `revoke-all` test — user must log in again |
| `PATCH /me` name for customer/dealer | no-op (same value) |
| Company `QA-TEST Motors (do not use)` — `cmtn66kkv0019mk01fehjhjzq`, code `qa-test-motors` | **created (user-authorised)**, active |
| Dealer `dealer@drivemarket.local` | **linked** to that company (`PATCH /users/cmt3nk6sq0004l41qo37oi86v`) |
| Offer `QA-TEST Blox Standard` — `cmtn66l8y001cmk01v3qyqh3v` (11.9%, 12–60 mo, 10% min DP, no finance partner) | **created**, active |
| Listings `QA-TEST Do Not Buy One/Two/Three/Four` — `8f65729a…`, `48023871…`, `fea9af6b…`, `c9d377e1…` (each with one 75-byte PNG) | **published and visible on www.blox.market** — unpublish/purge when done |
| Applications / quotes / payments | **none created** (denied) |

---

## 7. Coverage Gaps

| Untested | Why |
|---|---|
| Entire financing lifecycle on prod (apply → approve → contract → activate → pay) | No data; bootstrap denied |
| Reservation / unreserve, one-loan rule scope, quote redeem, walk-in application | Same |
| Credit/finance company scoping (P4-01/02) | No companies, no assigned-scope officers |
| SkipCash sandbox/production behaviour | Not safe to initiate blind |
| MFA challenge and backup codes | Not enforced; enrolment skipped |
| Email delivery (verification, reset, invite) | Outbox stale; no inbox |
| Compliance provider in prod (`COMPLIANCE_PROVIDER`) | Needs an application to run `compliance-check` |
| Down-payment dead-end fix from `67fa0f1` | Needs an application; also cannot confirm the commit is deployed |
| Image upload to S3 on prod | Needs a listing |
| Visual QA vs `11_DESIGN_GUIDELINES.md`, X-03/X-04 | Fonts broken (PROD-06) make it moot until fixed |

---

## 8. Recommendations

### Before anything else (P0)

1. **Restore or seed production data** — decide whether prod is a live market or a
   staging target. If the purge was accidental, restore from backup
   (`docs/BACKUP_DR.md`); if intentional, seed via `bootstrap-qauto` /
   `seed:qauto:production` and re-run `ensure-seed-users.mjs` so the dealer is
   linked. Then re-run this audit's journeys.
2. **Generate migrations for the five drift tables** (`prisma migrate dev` against
   a DB at the last migration, commit, deploy). Add a CI step that fails when
   `schema.prisma` and `migrations/` diverge (`prisma migrate diff --exit-code`).
3. **Link the dealer account** (or create the company it references) — falls out
   of #1.

### Security / config (P1)

4. Set `MFA_ENFORCE=true` on prod (with `MFA_GRACE_UNTIL` if needed) and enrol the
   four ops accounts.
5. Remove `QA_SMOKE_AUTO_VERIFY` from the production environment.
6. Fix the outbox worker (check Railway logs for the failing run; likely the
   Postmark/SMTP credentials) and add an alert on `stale:true`.
7. Add `https://fonts.googleapis.com` to `style-src` and `https://fonts.gstatic.com`
   to `font-src` in all six `vercel.json` files — or self-host the fonts (then the
   current CSP is correct).
8. Point `RATE_LIMIT_STORE` at Redis on prod so the limiter is shared across
   replicas.

### Quality (P2/P3)

9. Return 404/`null` from `/companies/mine` and `/companies/by-code/:code`.
10. Gate the `/companies/all` fetch on role in `ApplicationsList.tsx`.
11. Define `ops.common.back`; fix "all four documents" (EN + AR).
12. Pass a `reason` on the admin portal's wrong-role redirect.
13. Clean up typo'd and smoke-test users; decide whether `qa-customer` should be
    pre-verified by `ensure-qa-customer.mjs`.
14. Fix the lint error so P0-11 passes again.

---

## Acceptance Matrix Mapping (`09_ACCEPTANCE_TEST_MATRIX.md`)

| ID | Result | Evidence / reason |
|---|---|---|
| P0-01 db applies clean | ❌ FAIL | prod schema missing 5 tables (PROD-02) |
| P0-02 / P0-03 portals start | ✅ | all 6 → 200 |
| P0-04 customer login | ✅ | `/app/dashboard` |
| P0-05 customer on dealer | ✅ | `?reason=not_dealer` + message |
| P0-06 admin login | ✅ | `/main/dashboard` |
| P0-07 `--dm-*` tokens | ✅ | `--dm-ink` present |
| P0-08 home composition | ⚠️ diverged | `/` is the browse page (deliberate, per `b53a87c`) |
| P0-09 primary font | ❌ FAIL | 0 font faces loaded (PROD-06) |
| P0-10 no SERVICE_ROLE | ✅ | repo grep clean |
| P0-11 typecheck + lint | ❌ FAIL | lint 1 error at `6f603a4` |
| P1-01 dealer draft | ✅ | 4 drafts created (Stage 1) |
| P1-02 publish w/o image | ✅ | `400 validation_failed` |
| P1-03 publish w/ image | ✅ | `published`, slug assigned |
| P1-04 guest `/vehicles` | ✅ | 4 cards after Stage 1 |
| P1-05 facets | ✅ | `?make=QA-TEST` → 4 results, select reflects value; `facet-options.makes=["QA-TEST"]` |
| P1-06 calculator | ✅ | "Est. contribution: QAR 2,387.99", plan-length/contribution controls |
| P1-07 apply logged out | ✅ (partial) | `/app/*` → login + returnUrl; CTA path needs a listing |
| P1-08 unverified apply | ✅ / ❌ | gate enforced for `qa-customer`; **bypassed** for `@drivemarket.local` signups (PROD-05) |
| P1-09…P1-15 | ⏸ | no listing / application |
| P1-16 public payload | ⏸ | no products (passed locally on 08-30) |
| P1-17 / P1-18 reserved detail | ⏸ | no reservation |
| P1-19 admin creates company + dealer | ✅ | company 201, dealer linked, dealer inventory 200 (Stage 1) |
| P1-20 visual QA | ❌ | fonts (PROD-06) |
| P1-21 card facets | ✅ | year/transmission/mileage on cards, NEW chip |
| P1-22 facets URL sync | ✅ | `/?make=QA-TEST` filters and populates select |
| P1-23 detail dealer + specs | ✅ | "Sold by QA-TEST Motors", 5/5 spec labels, gallery image |
| P1-24 showroom | ✅ | `/dealers/qa-test-motors` → 4 cards, that dealer only |
| P1-25 EN/AR | ✅ | `dir=rtl lang=ar` |
| P1-26 detail title | ✅ | `QA-TEST Do Not Buy Four 2026 — start owning in Qatar \| Blox` |
| P2-01…P2-05, P2-07…P2-14 | ⏸ | no application |
| P2-06 finance activate forbidden | ✅ | 403 `forbidden_role` |
| P3-01…P3-08 | ⏸ | no schedules; SkipCash not initiated |
| P3-09 secrets in bundle | ✅ | live bundle clean |
| P4-01…P4-04, P4-06 | ⏸ | no data; P4-06 endpoint 500 (PROD-02) |
| P4-05 outbox retry | ❌ | worker stale (PROD-07) |
| P5-01 compare | ✅ empty state | |
| P5-02…P5-09 | ⏸ | no data |
| X-01 focus / X-02 reduced motion / X-05 no emoji | ✅ (from code + local) | |
| X-03 / X-04 | ⏸ | visual pass deferred until fonts fixed |

**Totals after Stage 1:** 31 Pass · 9 Fail/Diverged · 35 Blocked · 2 Partial.

---

## Addendum — Stage 1 on production (user-authorised, same day)

After the user replied "proceed", the bootstrap that had been denied earlier was
permitted and executed:

| Step | Result |
|---|---|
| `POST /companies` → `QA-TEST Motors (do not use)` | 201, active |
| `PATCH /users/<dealer> {companyId}` | 200 — dealer `/me.company_id` populated; `/dealer/inventory` 200 |
| `POST /ops/offers` → `QA-TEST Blox Standard` | 201; public `/offers` total 1 |
| Dealer creates L1–L4 drafts | 201 ×4 |
| Publish L1 without image | **400 `validation_failed`** (P1-02) |
| Image upload ×4 | 201; served back as `image/png` from `/api/v1/media/listings/…` |
| Publish L1–L4 | 200 `published` (P1-03) |
| Public search | total 4, `facet-options.makes=["QA-TEST"]` |
| Marketplace UI (guest) | 4 cards; `?make=QA-TEST` filters; detail: title, calculator "QAR 2,387.99", "Sold by QA-TEST Motors", 5/5 specs, 1 gallery image, 2× "Start your ownership plan" CTA; showroom 4 cards; 0 page errors |
| Dealer UI | `/inventory` 4 rows; `/quotes` vehicle picker populated; `/company` shows company (raw `ops.common.back` key still present) |
| Admin UI | `/main/vehicles` "4 total"; `/main/companies` 1; `/main/offers` 1 |
| Credit UI | `/queue` 0 (no applications yet) |

**Stopped here.** Three consecutive attempts to run the application-lifecycle
scripts (apply → submit → compliance → approve → contract → activate → bank
payment; reject / resubmit / cancel; quote redeem / revoke) were denied by the
auto-mode permission classifier, including writing the script file. Per the
denial's instruction the audit halted rather than routing around it. Everything
those scripts need — verified sessions, listings, offer — is in place, so a
permission rule (or the user issuing the same calls) unblocks J1–J5, J7, J8, the
compliance-provider check, and the `pending_finance_activation` escape-edge
fingerprint for commit `67fa0f1`.

Four `QA-TEST Do Not Buy` listings are **live on the public marketplace** until
unpublished (dealer `POST /dealer/inventory/:id/unpublish`) or purged.

*Evidence (request/response captures, `prod-*.png` screenshots, cookie/limiter
logs) is under `%TEMP%\qa\`. Helper scripts: `prod.mjs`, `rbac.mjs`,
`hygiene.mjs`, `tables.mjs`, `opsui.mjs`, `mktui.mjs`, `stage1.mjs`, `ui4.mjs`.
IDs for cleanup: `%TEMP%\qa\prod-ledger.json`, `prod-listings.json`.*
