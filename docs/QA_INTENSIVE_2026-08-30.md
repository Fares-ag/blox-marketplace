# QA Report — Intensive Full-Platform Audit (DriveMarket)

**Date:** 2026-08-30
**Auditor:** Senior QA Engineer + Staff Engineer
**Repo:** `C:/Users/TS/Downloads/blox-marketplace` @ `b04b25a` (branch `main`)
**Mode:** READ / RUN / REPORT — no application code was modified
**Scope:** API (`packages/api`), 6 portals, `packages/shared`, integrations (SkipCash, Zoho, KYC, S3/MinIO, email outbox)

---

## 1. Executive Summary

### Verdict: **NO-GO**

Three P0 defects block release. Two of them make the core financing lifecycle
either unreachable or unrecoverable in a production configuration, and neither is
covered by the existing test suite.

This is **not** a quality-decline story. The platform is in good shape overall:
authentication, RBAC, tenant/company scoping, IDOR protection, payment
idempotency, contract fingerprinting, webhook signature verification, rate
limiting and CORS all behave correctly under adversarial testing, and 272
automated tests pass. The blockers are concentrated in the **application
lifecycle state machine** and in **an unimplemented compliance dependency that
sits on the critical path**.

### Top 5 risks

| # | Risk | Severity |
|---|------|----------|
| 1 | Compliance provider is a stub that always throws. In production, **no application can ever be approved** — the approval gate hard-depends on a passing check that cannot be produced. | **P0** |
| 2 | `pending_finance_activation` is a **dead-end state**. An application that reaches it while a down payment is still owed can never be activated nor rolled back through any API path — it requires manual DB surgery. | **P0** |
| 3 | The documented dev command `npm run dev:api` **cannot boot the API at all** (tsx does not emit decorator metadata → NestJS DI fails). Every new developer hits a wall on step 8 of setup. | **P0** |
| 4 | 100% of seeded products route to an Al Jazeera (Zoho) offer, which lands applications in `partner_processing` — a **terminal, read-only** state invisible to the credit queue. The entire Blox-financed journey is unreachable from seed data. | **P1** |
| 5 | The one-loan rule was silently narrowed from **one in-flight application per customer** to **one per customer per product** (commit `b04b25a`). A customer can now hold N concurrent financings. Docs and acceptance matrix were not updated. Needs credit-risk sign-off. | **P1** |

### Environment blocker encountered (resolved)

`packages/api/src/integrations/zoho/zoho-crm.service.ts` was **0 bytes** in the
working tree (448 lines deleted, uncommitted, timestamped 2026-08-30 20:48). It
broke `tsc` in 4 files and would have failed NestJS DI at boot. This was
**local working-tree corruption, not a committed defect** — restored with
`git checkout --` on your instruction before the audit proceeded. Worth
investigating what emptied it (interrupted editor/tool write).

---

## 2. Automation Baseline

All commands run from repo root after `docker compose up -d postgres redis minio`,
`npm install`, `db:push`, `db:seed`, `ensure-seed-users.mjs`.

| Command | Result | Detail |
|---|---|---|
| `npm run typecheck` | ✅ **PASS** (exit 0) | 8/8 packages, 0 TS errors *(after restoring the emptied Zoho file — 4 errors before)* |
| `npm run lint` | ❌ **FAIL** (exit 1) | **1 error**, 14 warnings |
| `npm run test -w @drivemarket/api` | ✅ **PASS** | 41 files, **233 tests** |
| `npm run test:integration -w @drivemarket/api` | ✅ **PASS** | 12 files, **39 tests** (was 32 in prior audit — improvement) |
| `npm run test -w @drivemarket/shared` | ✅ **PASS** | 5 files, **257 tests** |
| `npm run build` | ✅ **PASS** (exit 0) | API dist + all 6 portals built |

**Total automated tests passing: 529.**

### The one lint error

```
packages/shared/src/lib/generate-schedule.ts
  251:9  error  'financedTotal' is assigned a value but never used
         @typescript-eslint/no-unused-vars
```

This is a **regression** — the prior audit (2026-08-23) closed ISS-002 at
0 lint errors. See §8.

> **Note on a non-finding:** I checked whether `npm run <script> --workspaces`
> masks per-workspace failures. It does not — root `typecheck` and `lint` both
> correctly exit 1 when a workspace fails. (An earlier "exit 0" I observed came
> from a shell pipe, not npm.)

---

## 3. Backend Findings

### 3.1 P0 — Compliance provider is unimplemented and sits on the approval critical path

**Files:** `packages/api/src/compliance/compliance-provider.stub.ts`,
`compliance-provider.resolve.ts`, `compliance.service.ts:40`, `compliance-gate.ts`

`ApplicationsLifecycleService.approveContract()` calls
`compliance.assertPassedForApproval(id)`, which requires a stored check with
`overallStatus = pass`. The only way to produce one is `runCheck()`, which
delegates to the resolved provider. In production the resolved provider is
always `StubComplianceProvider`, whose every method rejects:

```ts
verifyIdentity(...)  => Promise.reject(new NotImplementedException(
                          'compliance_identity_verification_not_implemented'))
screenSanctions(...) => Promise.reject(new NotImplementedException(
                          'compliance_sanctions_screening_not_implemented'))
```

`resolveComplianceProvider()` returns the working `DevRecordedComplianceProvider`
**only when `COMPLIANCE_DEV_PROVIDER` is truthy AND `NODE_ENV !== 'production'`**.
So production has no path to an approval.

**Reproduced:**
```
POST /api/v1/ops/applications/{id}/compliance-check   → 501 compliance_identity_verification_not_implemented
POST /api/v1/ops/applications/{id}/approve-contract   → 400 compliance_check_required
```

The stub's own comment ("never fakes a pass") shows this is a deliberate
fail-closed placeholder — correct security posture, but it means **a KYC/AML
vendor integration is a hard prerequisite for go-live**, and it is not built.

**Aggravating:** `COMPLIANCE_DEV_PROVIDER` appears in **no** `.env.example` and
**no** documentation. A developer following the setup instructions gets a 501 at
the first approval with no hint that a flag exists. (I had to read
`compliance-provider.resolve.ts` to find it; the rest of this audit ran with it
enabled.)

---

### 3.2 P0 — `pending_finance_activation` is an unrecoverable dead-end

**Files:** `packages/api/src/applications/application-transitions.ts`,
`applications-lifecycle.service.ts:386-397`, `down-payment.ts`

The transition table has **no rule with `from: 'pending_finance_activation'`**.
The only exit is `activate()`. But `activate()` enforces
`assertDownPaymentSatisfied()`, and the only endpoint that records a down payment
requires status `down_payment_required`:

```ts
// applications-lifecycle.service.ts:396
if (app.status !== ApplicationStatus.down_payment_required) {
  throw new BadRequestException('invalid_status_transition');
}
```

The only edges **into** `down_payment_required` are from `contract_under_review`
and `down_payment_submitted`. Once past those, there is no way back.

The code comments acknowledge the direct `contract_under_review →
pending_finance_activation` edge is intended "for offers with no down payment" —
but **nothing enforces that precondition**. A credit officer taking a
matrix-legal transition on an offer that *does* carry a down payment permanently
bricks the application.

**Reproduced end-to-end** (application `cmtg79lq4000lwvbomm2auwm7`, 20% down payment):

```
POST .../transition {toStatus:'contract_under_review'}       → 200  contract_under_review
POST .../transition {toStatus:'pending_finance_activation'}  → 200  pending_finance_activation
POST .../down-payment {amount:13180,...}                     → 400  invalid_status_transition
POST .../activate                                            → 400  down_payment_incomplete
POST .../transition {toStatus:'down_payment_required'}        → 400  invalid_status_transition
```

That application is still stuck in the test DB. Recovery requires a direct
`UPDATE applications SET status=...`.

**Fix direction:** either guard the direct edge (reject it when
`requiredDownPaymentAmount(pricingSnapshot) > 0`), or add a
`pending_finance_activation → down_payment_required` rule as an escape hatch.
Both are cheap; the second also rescues already-stuck rows.

---

### 3.3 P0 — `npm run dev:api` cannot boot the API

**Files:** `packages/api/package.json` (`start:dev`), `packages/api/tsconfig.json`

`start:dev` is `tsx watch src/main.ts`. tsx is esbuild-based, and **esbuild does
not implement `emitDecoratorMetadata`**, which NestJS requires for type-based
constructor injection. `tsconfig.json` sets `emitDecoratorMetadata: true`, but
tsx never honours it.

**Proved directly** with a minimal probe run under the project's own tsx (4.23.7):

```
design:paramtypes = undefined
```

**Boot result** — 16 `undefined dependency` warnings, then a hard crash:

```
UndefinedDependencyException: Nest can't resolve dependencies of the
MobileAuthService (?, +, Symbol(AUTH_INSTANCE)).
The dependency at index [0] appears to be undefined at runtime
```

Note the signature `(?, +, Symbol(AUTH_INSTANCE))`: the explicitly `@Inject()`-ed
token resolved fine; only the **type-inferred** `PrismaService` failed — the exact
fingerprint of missing decorator metadata.

**Production is unaffected**: `npm run build` uses `nest build` (tsc, which does
emit metadata) and `npm start` runs the compiled `dist/`. I confirmed this — the
API boots cleanly from `dist` and mapped **159 routes**. The entire runtime
portion of this audit was performed against the compiled build.

**Fix direction:** switch `start:dev` to `nest start --watch`, or to
`ts-node`/`@swc-node` with decorator-metadata enabled (the repo already depends on
`unplugin-swc` and uses SWC with `decoratorMetadata: true` for Vitest).

---

### 3.4 P1 — All seeded products route to a terminal, read-only partner state

**Files:** `partner-finance.ts`, `application-transitions.ts`,
`applications-lifecycle.service.ts:305`, `prisma/seed.ts`

`submittedStatusForPartner()` sends an application to `partner_processing`
whenever the finance partner's `crmAdapter === 'zoho'`, otherwise `under_review`.
Applications in `partner_processing` are explicitly read-only:

```ts
if (app.status === ApplicationStatus.partner_processing) {
  throw new BadRequestException('partner_application_readonly');
}
```

That is a legitimate design (Al Jazeera underwrites in their own CRM). The
problem is the **seed data**:

```
defaultOfferId          | product count
------------------------+--------------
seed-default-offer      |  27     → financePartner: al-jazeera (zoho)
seed-al-jazeera-offer   |  80     → financePartner: al-jazeera (zoho)
```

**All 107 products** point at a Zoho-routed offer, and `seed-default-offer`
(`isDefault = true`) is Al Jazeera too. Consequences:

- Every marketplace application ends at `partner_processing` and stops.
- `CREDIT_PIPELINE_STATUSES` / `CREDIT_QUEUE_STATUSES` **exclude**
  `partner_processing`, so those applications never appear in the credit queue.
- Acceptance cases P2-01 … P2-08 and P3-* and journeys J1/J8/J9 are **unreachable
  from seed data** — a QA or demo environment cannot exercise the core product.

I confirmed the first marketplace application I submitted landed in
`partner_processing` and could not be transitioned. To test the Blox-financed
lifecycle I had to repoint two products at `seed-blox-finance-offer` (see §10).

**Also found:** finance partners are **duplicated** in seed — 4 rows for 2
partners (`seed-al-jazeera` + `cmt1hzcxy0000…` both `al-jazeera`;
`seed-blox-finance` + `cmt1hzcy70001…` both `blox-finance`). Data-hygiene bug.

---

### 3.5 P1 — One-loan rule silently narrowed to per-product

**Files:** `applications.service.ts:73-82`, `application-access.ts:6`,
commit `b04b25a` "Allow customers to submit applications for multiple vehicles"

```ts
async hasBlocking(userId: string, productId?: string) {
  const found = await this.prisma.application.findFirst({
    where: { customerUserId: userId,
             ...(productId ? { productId } : {}),          // ← scoped per product
             status: { in: BLOCKING_APPLICATION_STATUSES } },
```

The specs still describe a **global** rule — `05_API_RPC_CONTRACT.md:111`
defines `has_blocking_application(p_user_id uuid)` with no product argument;
`02_USER_JOURNEYS.md:83` says "explain one-loan rule"; `03_DOMAIN_MODEL.md:458`
states server enforcement per `user_id`. Acceptance case **P1-11** and journey
**J3** both assert a second application by the same customer is rejected.

**Verified behaviour:** second apply on the **same** product → `400
blocking_application_exists` ✅. Second apply on a **different** product →
**allowed** (a customer can hold unlimited concurrent financings).

This looks deliberate (the commit renamed the error copy and added a matching DB
index), but it is a **material credit-risk policy change** shipped without
updating the specification or acceptance matrix. Flagging for product/credit
sign-off rather than as a code bug.

---

### 3.6 P1 — Integration tests never boot `AppModule`

**Files:** `packages/api/test/integration/*`

`grep -rn "AppModule" packages/api/test/integration/` returns **nothing**. The
integration suite builds bespoke testing modules, so no test ever exercises the
real composition root. This is precisely why §3.3 (a total boot failure) is
invisible to CI: 529 tests pass while `npm run dev:api` cannot start.

**Recommendation:** add one smoke test that does
`await Test.createTestingModule({ imports: [AppModule] }).compile()` — it would
have caught the DI failure, and costs ~10 lines.

---

### 3.7 P1 — Zoho credentials are never loaded

**Files:** `packages/api/src/app.module.ts:32`, root `.env.local`

```ts
ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env', '../../.env'] })
```

The Zoho credentials (`ZOHO_CLIENT_ID`, `ZOHO_CLIENT_SECRET`,
`ZOHO_REFRESH_TOKEN`, `ZOHO_API_DOMAIN`, …) live in **root `.env.local`**, which
is not in `envFilePath`. Root `.env` contains only two `VITE_*` variables.

**Observed at runtime:**
```
[ZohoCrmService] ERROR  Zoho sync skipped for cmt4f2038…: no credentials
                        configured, but partner "al-jazeera" is routed to Zoho.
GET /api/v1/ops/zoho/failures → 4 items, error: "zoho_not_configured"
```

So every partner lead silently fails to reach the CRM. Either move the values
into `packages/api/.env` or add `.env.local` to `envFilePath`. Worth deciding
deliberately — `.env.local` currently also holds a live Vercel OIDC token and
sandbox Zoho secrets in a file that is loaded by nothing.

---

### 3.8 P2 — `offer_mismatch` returns HTTP 500 instead of 400

**File:** `packages/api/src/applications/application-pricing.ts:32-40`

```ts
export function assertOfferMatchesProduct(requestedOfferId, resolvedOfferId) {
  if (requestedOfferId && requestedOfferId !== resolvedOfferId) {
    throw new Error('offer_mismatch');       // ← bare Error, not HttpException
  }
}
```

The **security control itself works** — client-side offer shopping is correctly
rejected. But a bare `Error` escapes to `AllExceptionsFilter` as a 500:

```
POST /api/v1/applications → 500 {"error":{"code":"internal_error", …}}
[AllExceptionsFilter] ERROR  POST /api/v1/applications -> internal_error
Error: offer_mismatch
```

Consequences: a routine client-input rejection is logged as a server crash
(pollutes Sentry / error budgets), and the UI receives `internal_error` instead
of an actionable `offer_mismatch` code. Should be
`new BadRequestException('offer_mismatch')`.

---

### 3.9 P2 — Quote gate returns HTTP 200 for missing / revoked quotes

```
GET /api/v1/quotes/definitely-not-a-real-token → 200 {"gate":"notFound"}
GET /api/v1/quotes/<revoked token>             → 200 {"gate":"revoked", …}
```

This is a consistent, deliberate "gate" envelope, and the marketplace consumes it
correctly (`/quotes/nope123` renders a clean "Quote unavailable" page). But
returning 200 for a non-existent resource deviates from REST semantics and from
the error-code contract in `05_API_RPC_CONTRACT.md`. Low impact; flagging for
contract consistency, not correctness.

---

### 3.10 Backend behaviours verified as CORRECT

Recorded because they were adversarially probed and held up.

| Area | Evidence |
|---|---|
| Session auth | All 6 seed logins → 200; all protected routes → 401 unauthenticated |
| RBAC isolation | 13 endpoints × 6 roles matrix — **zero** unexpected allows (§4) |
| Better Auth CSRF | `403 MISSING_OR_NULL_ORIGIN` without a valid `Origin` |
| Rate limiting | `RateLimit-Policy: 30;w=900`, headers present, 429 on breach (I hit it twice) |
| CORS | Allowed origin echoed; `evil.example.com` gets **no** `Access-Control-Allow-Origin` |
| Mobile JWT | valid → 200; none / tampered / forged-signature → **401** on all protected routes |
| Privilege escalation | Customer JWT on `/ops/*` → `403 forbidden_role` |
| IDOR (customer↔customer) | 7/7 blocked — app read, KYC docs, contract file, doc download, submit, cancel, resubmit |
| Reserved-listing leakage | Non-applicant gets only `{available:false, reason}`; applicant gets `pending_financing` (P1-17/18) |
| VIN/PII stripping | Planted `vin`/`chassisNumber` in DB → absent from both public list and detail (P1-16) |
| KYC webhook | Unsigned and bad-signature → `401 invalid_signature` |
| Payment idempotency | Replayed SkipCash completion returns existing txn; `paid_amount` stays 1659.09, not doubled |
| Forged payment key | `404` — fails closed |
| Activation idempotency | Second `activate` → still 48 schedules, not 96 |
| Contract integrity | Signed PDF must carry the generated PDF's SHA-256 in Subject/Keywords → `contract_hash_mismatch` otherwise |
| Separation of duties | Finance officer `activate` → `403 forbidden_role` |
| Reason enforcement | `rejected` without reason → `validation_failed` |
| Secrets in bundles | 0 hits across all 6 `dist/` outputs (P3-09); no `SERVICE_ROLE` in Vite envs (P0-10) |
| Error hygiene | No stack traces or secrets in any response body; every error carries a `requestId` |

---

## 4. RBAC Matrix (live, `/api/v1`)

`200` = allowed, `403` = forbidden. **No unexpected allows.**

| Endpoint | customer | dealer | credit | finance | admin | super |
|---|---|---|---|---|---|---|
| `/me` | 200 | 200 | 200 | 200 | 200 | 200 |
| `/dealer/inventory` | 403 | **200** | 403 | 403 | 403 | 403 |
| `/dealer/applications` | 403 | **200** | 403 | 403 | 403 | 403 |
| `/ops/applications` | 403 | 403 | **200** | **200** | **200** | **200** |
| `/ops/payment-schedules` | 403 | 403 | **200** | **200** | **200** | **200** |
| `/users` | 403 | 403 | 403 | 403 | **200** | **200** |
| `/companies/all` | 403 | 403 | 403 | 403 | **200** | **200** |
| `/ops/activity-logs` | 403 | 403 | 403 | 403 | **200** | **200** |
| `/ops/metrics` | 403 | 403 | 403 | 403 | **200** | **200** |
| `/ops/zoho/failures` | 403 | 403 | **200** | 403 | **200** | **200** |
| `/applications/mine` | **200** | 403 | 403 | 403 | 403 | 403 |
| `/customer/payments/hub` | **200** | 403 | 403 | 403 | 403 | 403 |
| `/ops/settings/settlement-discounts` | 403 | 403 | 403 | 403 | **200** | **200** |

Unauthenticated: `/me`, `/applications/mine`, `/ops/applications`,
`/dealer/inventory`, `/users` → **401**.
Public by design: `/products`, `/products/facet-options`, `/offers`,
`/finance-partners`, `/companies` (returns only `id/name/code/logo_url/published_count` —
inspected, no sensitive fields).

---

## 5. Frontend Findings

All 6 portals boot, authenticate, and render live data (**P0-02, P0-03 PASS**).
Run against the compiled API on `:3011` via `VITE_API_URL` override — port 3010
was occupied by an unrelated Next.js app ("BloX Choice", PID 40444) from another
project on this machine.

### 5.1 Cross-cutting

| ID | Case | Result | Evidence |
|---|---|---|---|
| P0-07 | `--dm-*` tokens present | ✅ **PASS** | 36 tokens (`--dm-amber`, `--dm-steel`, `--dm-graphite-980`, `--dm-ink`, …) |
| P0-09 | Primary font not Inter/Roboto/system | ✅ **PASS** | body `IBM Plex Sans`, h1 `Space Grotesk` |
| P0-05 | Wrong role redirected | ✅ **PASS** | `?reason=not_dealer` / `not_credit` / `not_admin` / `not_super_admin`, **and** the reason is rendered ("This is the dealer portal — sign in with your dealer staff account.") |
| X-01 | Focus rings | ✅ **PASS** | `outline: solid 2px` on first control |
| X-02 | Reduced motion | ✅ **PASS** | `prefers-reduced-motion` in `global.scss:127`, `blox-ops.scss:1415` |
| X-05 | No emoji-as-UI | ✅ **PASS** | no emoji in marketplace `.tsx` |
| — | A11y basics | ✅ **PASS** | 61 buttons / **0** unlabeled; 1 img / **0** missing alt; 16 form controls / **0** unlabeled; exactly 1 `h1`; 3 landmarks |
| — | Responsive 390×844 | ✅ **PASS** | `scrollWidth 390 == clientWidth 390`, no horizontal overflow |
| — | **Console error on every portal** | ⚠️ **P2** | `GET /api/v1/me → 401` fires on the guest/boot path of **all 6** portals. Functionally harmless (session probe) but violates "no console errors on critical paths" and buries real errors. |

### 5.2 Marketplace (5173)

| Case | Result | Evidence |
|---|---|---|
| P1-04 browse | ✅ PASS | 24 cards, facets, sort, dealer filter |
| P1-22 facet URL sync | ✅ PASS | `?make=Chery&yearMin=2026` → select reflects `Chery`. *Note: canonical route is now `/`; `/vehicles` redirects (deliberate, commit `b53a87c`) — doc says `/vehicles`* |
| P1-06 calculator | ✅ PASS | "Est. contribution: QAR 1,790.99", plan-length + initial-contribution controls, illustrative disclaimer |
| P1-23 detail | ✅ PASS | "Sold by Chery Elite Motors", spec grid (MAKE/MODEL/YEAR/CONDITION/TRANSMISSION/BODY TYPE), showroom link |
| P1-26 document title | ✅ PASS | `Chery Himava 2026 — start owning in Qatar \| Blox` |
| P1-07 apply logged out | ✅ PASS | → `/auth/login?returnUrl=%2Fapp%2Fapplications%2Fnew%3Fproduct%3D…`; after login returns to the wizard |
| P1-25 EN/AR toggle | ✅ PASS | `dir=rtl`, `lang=ar`, content translated |
| P1-24 showroom | ✅ PASS | `/dealers/chery-elite-motors` → 21 cards, that dealer only |
| P5-01 compare | ✅ PASS | "Side-by-side up to 3 listings" + empty state |
| Quote redeem | ✅ PASS | bogus token → "Quote unavailable — expired, used, or not assigned to your account" |
| My applications | ✅ PASS | customer-friendly statuses (Draft / Sign agreement / Terms in review / Withdrawn) |
| **"all four documents" copy** | ❌ **P2** | `packages/shared/src/i18n/locales.ts` lines 213, 242, 244, 246, 272 say "all four documents". Both the API (`REQUIRED_APPLICATION_DOC_CATEGORIES`) and the UI (`ApplicationDetailPanel.tsx:48 REQUIRED_UPLOAD_CATEGORIES`) require **three** (`qid`, `salary`, `bank`). Misleading instruction. |

### 5.3 Dealer (5176)

| Route | Result | Evidence |
|---|---|---|
| `/applications` | ✅ PASS | 37 rows, read-only (no status controls) — P1-12 |
| `/inventory` | ✅ PASS | 26 rows |
| `/inventory/new` | ✅ PASS | full vehicle form |
| `/quotes` | ✅ PASS | 3 rows, create/revoke |
| `/company` | ❌ **P2** | Renders the **raw i18n key `ops.common.back`** as visible UI text. `packages/dealer/src/pages/CompanyPage.tsx:43` calls `t('ops.common.back')`, but only `ops.common.backToQueue` is defined in `locales.ts`. |

### 5.4 Credit (5177)

| Route | Result | Evidence |
|---|---|---|
| `/queue` | ✅ PASS | 5 rows; IN REVIEW 3 / RESUBMISSION 0 / AVG AGE 4d |
| `/applications` | ✅ PASS | queue view |
| `/zoho-failures` | ✅ PASS | 4 rows with reason + partner + error |

### 5.5 Finance (5179)

| Route | Result | Evidence |
|---|---|---|
| `/schedules` | ✅ PASS | 48 rows, "Run overdue sweep", PENDING 46 |
| `/bank-transfers` | ✅ PASS | 1 pending transfer |
| `/applications` | ⚠️ **P2** | Loads, but fires `403 /api/v1/companies/all?limit=100&offset=0`. The shared `ApplicationsList.tsx:81` unconditionally fetches that admin-only endpoint whenever `!dealer`, to populate the **Company** filter. For finance officers the filter renders with **zero options**. |
| Waive UI vs API | ⚠️ **P2** | `waive/request` and `waive/confirm` are `@Roles(admin, super_admin)` only (`payments.controller.ts:69`). Finance officers get `403`. If the finance portal surfaces waive controls, they cannot work — worth confirming against the intended finance scope, since the brief lists "waive/defer UI" as a finance capability. |

### 5.6 Admin (5174) / Super-admin (5175)

All routes load with live data, no page errors.

| Portal | Routes verified |
|---|---|
| Admin | `/main/applications` (40), `/main/users` (36), `/main/companies` (7), `/main/vehicles` (110 total, card layout), `/main/offers` (3), `/main/promotions` (empty state), `/main/packages` (empty state), `/main/insurance-rates` (empty state), `/main/ledgers` (48), `/main/bank-transfers` (1), `/main/settings/settlement-discounts` |
| Super-admin | `/users` (36), `/companies` (7), `/activity-logs` (50), `/system` (live metrics) |

Empty states render correctly ("No records"). ISS-001 from the prior audit
(super-admin user detail page) is confirmed **closed** — `/users/:id` exists.

---

## 6. Journey Results

| ID | Journey | Result | Evidence |
|---|---|---|---|
| **J1** | Browse → apply → submit → approve → contract → activate → pay | ✅ **PASS** *(conditional)* | Full chain green on app `cmtg7egqj000jwv7o6uzvcx6b`: draft → under_review → contract_signing_required → contracts_submitted → contract_under_review → down_payment_required → down_payment_submitted → pending_finance_activation → **active**. 48 schedules, listing → `sold`, 10 activity-log rows. **Conditional on** `COMPLIANCE_DEV_PROVIDER=true` (§3.1) and repointing the product to a non-Zoho offer (§3.4). Not reachable in a default/production configuration. |
| **J2** | Dealer publish | ✅ **PASS** | draft → publish blocked without image (`validation_failed`) → image upload 201 → publish → `published` → appears in marketplace search |
| **J3** | One-loan block | ⚠️ **PARTIAL** | Same product → `blocking_application_exists` ✅. Different product → **allowed** ❌ vs spec (§3.5) |
| **J4** | Resubmission loop | ✅ **PASS** | credit → `resubmission_required` (reason required) → customer `resubmit` → `under_review` |
| **J5** | Reject → listing republished | ✅ **PASS** | reject without reason → `validation_failed`; with reason → `rejected`; listing back in search |
| **J6** | Customer cancel under review | ✅ **PASS** | submit → reserved (hidden) → cancel → `submission_cancelled` → listing back in search |
| **J8** | Down payment before activation | ✅ **PASS** | `activate` → `down_payment_incomplete` until recorded; then `active`. **But see §3.2** — the same gate creates the P0 dead-end |
| **J9** | SkipCash payment | ✅ **PASS** | initiate → 201 with `redirect_url` + `idempotency_key`; complete → schedule `paid`, method `skipcash`; replay → idempotent; forged key → 404 |
| **J10** | Unpublish blocked on financed listing | ✅ **PASS** | `listing_has_active_financing` |
| **J11** | Quote redeem at negotiated price | ✅ **PASS** | create → token; public lookup → `gate:requiresAuth` with **masked email**; apply with token → `list_price` 49000 (down from 60000); revoke → `gate:revoked` |
| **J7** | *(not defined in brief)* | — | — |

---

## 7. Acceptance Matrix

### Phase 0

| ID | Result | Evidence |
|---|---|---|
| P0-01 | ✅ PASS | `db:push` "already in sync"; `db:seed` OK |
| P0-02 | ✅ PASS | :5173 → 200 |
| P0-03 | ✅ PASS | 5174/5175/5176/5177/5179 all → 200 |
| P0-04 | ✅ PASS | customer login → `/app/applications` |
| P0-05 | ✅ PASS | `?reason=not_dealer` + rendered explanation |
| P0-06 | ✅ PASS | admin → `/main/dashboard` |
| P0-07 | ✅ PASS | 36 `--dm-*` tokens |
| P0-08 | ⚠️ **DIVERGED** | `/` is the **vehicles browse page** (h1 "Vehicles"), not the marketing home the spec describes. Deliberate — commit `b53a87c` "land on vehicles browse with classic listing cards". Spec not updated. |
| P0-09 | ✅ PASS | IBM Plex Sans / Space Grotesk |
| P0-10 | ✅ PASS | no `SERVICE_ROLE` in any Vite env |
| P0-11 | ❌ **FAIL** | typecheck exit 0, **lint exit 1** (1 error) |

### Phase 1

| ID | Result | Evidence |
|---|---|---|
| P1-01 | ✅ PASS | draft listing created |
| P1-02 | ✅ PASS | publish w/o image → `validation_failed` |
| P1-03 | ✅ PASS | publish w/ image → `published` |
| P1-04 | ✅ PASS | guest sees listing |
| P1-05 | ✅ PASS | facets filter |
| P1-06 | ✅ PASS | calculator renders estimate |
| P1-07 | ✅ PASS | auth gate + returnUrl |
| P1-08 | ⏸ **BLOCKED** | `REQUIRE_EMAIL_VERIFICATION=false` locally; not exercised |
| P1-09 | ✅ PASS | `under_review` + 3 docs stored |
| P1-10 | ✅ PASS | listing `reserved`, absent from search |
| P1-11 | ⚠️ **DIVERGED** | per-product only (§3.5) |
| P1-12 | ✅ PASS | dealer sees 37 apps, no status controls |
| P1-13 | ✅ PASS | credit queue shows new app |
| P1-14 | ✅ PASS | reject → listing `published` |
| P1-15 | ✅ PASS | resubmission round-trip |
| P1-16 | ✅ PASS | planted VIN/chassis stripped from list + detail |
| P1-17 | ✅ PASS | non-applicant → `{available:false, reason}` only |
| P1-18 | ✅ PASS | applicant → `availability: pending_financing` |
| P1-19 | ✅ PASS | admin `/main/companies` + `/main/users` CRUD present |
| P1-20 | ⚠️ PARTIAL | tokens/fonts/a11y/responsive pass; full visual QA vs `11` not performed |
| P1-21 | ✅ PASS | Year · Transmission · Cylinders · Mileage on cards; NEW chip |
| P1-22 | ✅ PASS | URL sync works (route is `/`, not `/vehicles`) |
| P1-23 | ✅ PASS | dealer + spec grid + gallery |
| P1-24 | ✅ PASS | showroom shows only that dealer's 21 |
| P1-25 | ✅ PASS | dir/lang/copy switch |
| P1-26 | ✅ PASS | title includes make/model/year |

### Phase 2

| ID | Result | Evidence |
|---|---|---|
| P2-01 | ✅ PASS | `contract_signing_required` + PDF generated (5807 bytes) |
| P2-02 | ✅ PASS | signed upload → `contracts_submitted` |
| P2-03 | ✅ PASS | → `contract_under_review` → `pending_finance_activation` |
| P2-04 | ✅ PASS | `active`, 48 schedules, listing `sold` |
| P2-05 | ✅ PASS | second activate idempotent (48 rows, not 96) |
| P2-06 | ✅ PASS | finance activate → `403 forbidden_role` |
| P2-07 | ⏸ **BLOCKED** | direct-activate flag not exercised |
| P2-08 | ⏸ **BLOCKED** | as above |
| P2-09 | ✅ PASS | cancel → `submission_cancelled` + unreserve |
| P2-10 | ✅ PASS | cancel after contract → `invalid_status_transition` |
| P2-11 | ✅ PASS | `listing_has_active_financing` |
| P2-12 | ✅ PASS | `invalid_status_transition` on illegal edge |
| P2-13 | ✅ PASS | 10 activity-log rows across the journey |
| P2-14 | ✅ PASS | `application-transitions.spec.ts` 12 tests + `separation-of-duties.spec.ts` 21 tests |
| — | ❌ **P0** | **`pending_finance_activation` dead-end** (§3.2) — not represented by any matrix case |

### Phase 3

| ID | Result | Evidence |
|---|---|---|
| P3-01 | ✅ PASS | `canPay=false` → `payments_not_enabled` |
| P3-02 | ✅ PASS | sandbox initiate + complete → schedule `paid` |
| P3-03 | ✅ PASS | replay idempotent, no double payment |
| P3-04 | ✅ PASS | completion via `idempotency_key` alone (webhook not required) |
| P3-05 | ✅ PASS | forged key → 404, fails closed |
| P3-06 | ✅ PASS | bank-pending → pending-bank list → mark paid |
| P3-07 | ✅ PASS | `jobs/payment-reminders` → `{due_soon:0, overdue:0, skipped:0}` |
| P3-08 | ✅ PASS | QAR tabular amounts in payment hub |
| P3-09 | ✅ PASS | 0 secrets in all 6 bundles |

### Phase 4

| ID | Result | Evidence |
|---|---|---|
| P4-01 | ⏸ BLOCKED | no assigned-scope credit officer seeded (code covered by `company-scope.spec.ts`, 15 tests) |
| P4-02 | ⏸ BLOCKED | as above |
| P4-03 | ✅ PASS | finance marks paid; activate → 403 |
| P4-04 | ⏸ BLOCKED | dealer note flow not exercised |
| P4-05 | ✅ PASS | outbox retried to `attempts=5` then dead-lettered (89 rows, `SMTP not configured` — environmental) |
| P4-06 | ✅ PASS | `/main/settings/settlement-discounts` renders rules |

### Phase 5 / Cross-cutting

P5-01 ✅ · P5-02 ⏸ (needs 4th item) · P5-03…P5-09 ⏸ not exercised.
X-01 ✅ · X-02 ✅ · X-03 ⏸ · X-04 ⏸ · X-05 ✅.

**Totals:** 58 Pass · 4 Fail/Diverged · 12 Blocked · 2 Partial.

---

## 8. Regression vs Prior Audit (2026-08-23)

### Fixed / still holding

| Prior item | Status now |
|---|---|
| ISS-001 super-admin user detail page | ✅ **Closed** — `/users/:id` present and working |
| ISS-003 KYC webhook test | ✅ **Closed** — `kyc-webhook.integration.spec.ts` exists; 401 on bad signature verified live |
| P0-1 SkipCash bypass gated | ✅ Holds — `SKIPCASH_SANDBOX` respected; forged key → 404 |
| P0-2 Officer IDOR | ✅ Holds — company scope enforced; customer↔customer IDOR 7/7 blocked |
| P0-3 PII download | ✅ **Now verified** (was ❓ "not tested") — cross-customer doc download → 403 |
| P0-4 Ledger/cascade | ✅ Holds |
| P1-1 Down payment | ✅ Holds (but see §3.2) |
| P1-2 401 handling | ✅ **Now verified** — all protected routes 401 unauthenticated |
| Integration suite | ✅ **Improved** — 32 → **39** tests |

### Regressions

| # | Item | Detail |
|---|---|---|
| R1 | **Lint back to failing** | Prior audit closed ISS-002 at **0 errors**; now **1 error** (`generate-schedule.ts:251`). P0-11 fails again. |
| R2 | **One-loan rule narrowed** | Post-audit commit `b04b25a` changed global → per-product without updating specs (§3.5) |
| R3 | **Landing page changed** | Commit `b53a87c` replaced the marketing home with the browse page; P0-08 no longer matches spec |

### New issues not present in the prior audit

The three P0s (§3.1, §3.2, §3.3) and §3.4, §3.6, §3.7 were **not identified**
previously — the prior audit was largely static/code-reading plus integration
tests, and none of those defects is visible without booting the real app and
driving a full journey.

---

## 9. Test Coverage Gaps

| Gap | Why it matters | Recommended test |
|---|---|---|
| **`AppModule` never compiled in tests** | Let a total boot failure through with 529 tests green | `Test.createTestingModule({imports:[AppModule]}).compile()` smoke test |
| **No dead-end / reachability analysis of the state machine** | §3.2 is a graph property no per-edge test catches | Property test: from every non-terminal status, assert ≥1 reachable path to a terminal state given the guards |
| **Down-payment precondition on the direct edge** | Root cause of §3.2 | Assert `contract_under_review → pending_finance_activation` is rejected when `down_payment > 0` |
| **Compliance provider resolution** | §3.1 would surface at deploy, not in CI | Assert `resolveComplianceProvider` returns the stub when `NODE_ENV=production`, and that the approval path fails loudly |
| **Partner-routing coverage** | §3.4 — no test asserts a Blox-financed offer exists in seed | Seed invariant test: ≥1 published product with a non-Zoho default offer |
| **No E2E/Playwright suite** | Every frontend defect here (§5.2, §5.3, §5.5) was found manually | Playwright smoke: login → publish → apply → approve → activate, per portal |
| **i18n key completeness** | §5.3 raw key in production UI | Lint rule / test asserting every `t('…')` key resolves in EN **and** AR |
| **Role × endpoint contract test** | RBAC is correct today but only manually verified | Codify the §4 matrix as a test |
| **Email verification gate (P1-08)** | Untested in any environment | Integration test with `REQUIRE_EMAIL_VERIFICATION=true` |
| **Direct-activate flag (P2-07/08)** | Untested | Integration test both flag states |

---

## 10. Environment Notes & Test-Data Changes

**Deviations from the brief's setup, and why:**

1. **API ran on `:3011`, not `:3010`.** Port 3010 was held by an unrelated
   Next.js app ("BloX Choice — Vehicle return", PID 40444) from another project.
   Portals were started with `VITE_API_URL=http://localhost:3011` (verified
   effective — all traffic went to 3011). Your `.env` files were **not** edited.
2. **API ran from `dist/` (`node dist/api/src/main.js`), not `npm run dev:api`** —
   because of §3.3. Env overrides: `API_PORT`, `BETTER_AUTH_URL`,
   `COMPLIANCE_DEV_PROVIDER=true`.
3. **MinIO started but not used** — no `S3_ENDPOINT` in `packages/api/.env`, so
   storage used the local `.uploads/` fallback. Image and document upload both
   verified working through that path.

**Test data I changed in the local DB** (no application code touched):

| Change | Reason |
|---|---|
| `products.defaultOfferId → seed-blox-finance-offer` for `cmt3kha0a002gwvjgmd68hjes` and `cmt3kha06002cwvjggijc4nxy` | Only way to reach the Blox-financed lifecycle (§3.4) |
| `companies.canPay = true` for `chery-elite-motors` | To test P3-02 after confirming P3-01 with `false` |
| Planted then reverted `vin`/`chassisNumber` on one product | P1-16 proof |
| Created 3 `QA *` listings, ~10 QA applications, user `qa.idor@drivemarket.local` | Journey + IDOR testing |

Residual: 32 QA applications, 3 QA products. `npm run db:seed -w @drivemarket/api`
will restore a clean baseline. Application `cmtg79lq4000lwvbomm2auwm7` is left
**deliberately stuck** in `pending_finance_activation` as reproduction evidence
for §3.2.

---

## 11. Fix Backlog

### P0 — must fix before release

| # | Issue | Files |
|---|---|---|
| 1 | Implement a real KYC/AML compliance provider, or make the approval gate explicitly configurable with an auditable bypass. Document `COMPLIANCE_DEV_PROVIDER` in `.env.example`. | `packages/api/src/compliance/compliance-provider.stub.ts`, `compliance-provider.resolve.ts`, `packages/api/.env.example` |
| 2 | Close the `pending_finance_activation` dead-end: guard the direct edge when a down payment is owed **and** add a recovery transition. | `packages/api/src/applications/application-transitions.ts`, `applications-lifecycle.service.ts:386` |
| 3 | Fix `start:dev` so the API boots in dev (`nest start --watch`, or SWC with `decoratorMetadata`). | `packages/api/package.json` |

### P1 — fix before release or accept with sign-off

| # | Issue | Files |
|---|---|---|
| 4 | Seed at least one Blox-financed default offer so the core journey is reachable; de-duplicate the 4 finance-partner rows. | `packages/api/prisma/seed.ts` |
| 5 | Reconcile the one-loan rule with credit policy; update `02_USER_JOURNEYS.md`, `03_DOMAIN_MODEL.md`, `05_API_RPC_CONTRACT.md`, `09_ACCEPTANCE_TEST_MATRIX.md` (P1-11) either way. | docs + `applications.service.ts:73` |
| 6 | Add an `AppModule` compile smoke test. | `packages/api/test/integration/` |
| 7 | Load Zoho credentials (move to `packages/api/.env` or extend `envFilePath`); review secrets sitting unused in root `.env.local`. | `packages/api/src/app.module.ts:32`, `.env.local` |

### P2

| # | Issue | Files |
|---|---|---|
| 8 | `offer_mismatch` → `BadRequestException` (currently 500). | `packages/api/src/applications/application-pricing.ts:37` |
| 9 | Fix the lint error (restores P0-11). | `packages/shared/src/lib/generate-schedule.ts:251` |
| 10 | Define `ops.common.back` (raw key visible in dealer `/company`). | `packages/shared/src/i18n/locales.ts`, `packages/dealer/src/pages/CompanyPage.tsx:43` |
| 11 | "all four documents" → "all three" (5 strings, EN + AR). | `packages/shared/src/i18n/locales.ts:213,242,244,246,272` |
| 12 | Gate the `companies/all` fetch on role so the finance Company filter isn't empty. | `packages/shared/src/ops-applications/ApplicationsList.tsx:81` (also `AddApplicationWizard.tsx:194`, `ApplicationWorkspace.tsx:227`) |
| 13 | Suppress the guest `GET /me` 401 console error across all 6 portals. | shared session bootstrap |
| 14 | Confirm intended waive scope for finance officers (API is admin-only). | `packages/api/src/payments/payments.controller.ts:69` |
| 15 | Return 404 for missing/revoked quotes, or document the `gate` envelope in the API contract. | `packages/api/src/quotes/`, `05_API_RPC_CONTRACT.md` |
| 16 | Update `09_ACCEPTANCE_TEST_MATRIX.md` P0-08 / P1-22 for the `/` landing change. | docs |

---

## 12. Verdict

### **NO-GO**

Per the brief's rule — *"Do not declare GO if any P0 fails or a critical journey
is broken"* — three P0s fail and J1 is only reachable under non-default
configuration.

**What NO-GO does *not* mean here:** the platform's security and data-integrity
posture is genuinely strong. RBAC, IDOR, PII stripping, payment and activation
idempotency, contract fingerprinting, webhook signatures, CSRF, CORS and rate
limiting all survived adversarial probing, and 529 automated tests pass. Most of
the product works.

**Path to CONDITIONAL GO** — all three are days, not weeks:

1. Fix the `pending_finance_activation` dead-end (§3.2) — small, well-understood change.
2. Fix `start:dev` (§3.3) — one line.
3. Make an explicit, documented decision on the compliance provider (§3.1) —
   either integrate a vendor, or ship with a deliberately configured and audited
   gate. This is a **business/compliance decision**, not just an engineering one,
   and it is the true long pole.

Then re-run J1 end-to-end against default seed data with `NODE_ENV=production`
semantics, plus the P1 items, and this becomes a **GO**.

---

*Report generated 2026-08-30. API commit `b04b25a`. Evidence — request/response
samples, SQL output, screenshots (`shot-*.png`, `portal-*.png`) — captured under
`%TEMP%/qa/`.*
