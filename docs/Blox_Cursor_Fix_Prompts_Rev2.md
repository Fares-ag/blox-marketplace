# Blox / DriveMarket — Cursor Composer 2.5 Fix Prompts (Rev 2)

Fixes for the findings in `Blox_Production_Readiness_Audit_Rev2.md`. The team already applied most of Rev 1 — this round closes the **one residual P0**, the **two P1 correctness bugs**, and the P2/P3 tail.

**How to use:** one prompt at a time, in order. Each names exact files and ends with **Acceptance** — verify before moving on. Make Cursor run `npm -w @drivemarket/api test` (and `npm -w @drivemarket/api run test:integration` where noted) after each backend prompt and paste failures back.

> ⚠️ **CRITICAL CAVEAT — do NOT "activate" the `.wip` files.** There are three files in `packages/api/src/applications/` — `applications-lifecycle.service.ts.wip`, `applications.controller.ts.wip`, `applications.module.ts.wip` — that hold an *earlier draft* of the authorization/upload fixes. **They are STALE: older than the active files, and the active `applications-lifecycle.service.ts` contains newer work they lack** (the real fingerprinted contract PDF via `buildContractAmortizationSchedule`/`verifySignedContractReferencesOriginal`, the `AnalyticsService`, real lender-name resolution). Renaming a `.wip` over the active file would **regress** that code. The prompts below **port only the missing enforcement into the current active files**, then **delete the `.wip` files**. Never overwrite an active file with its `.wip`.

> ⚠️ **Prisma migrations:** any prompt that changes the schema must create the migration with `npx prisma migrate dev --create-only` and show you the SQL first. Never run `migrate deploy`/`db push` against a real database.

---

# PHASE 0 — Close the blocker (P0)

## P0-1 — Add company-scope enforcement to the application lifecycle handlers (residual cross-tenant IDOR)

```
You are closing a cross-tenant authorization hole (IDOR) in a NestJS + Prisma fintech API. Payments and the KYC-document read path are already company-scoped, but the application LIFECYCLE handlers are not — a credit/finance officer scoped to Company A can approve/activate/transition and download the signed contract of Company B's applications.

DO NOT rename or copy the stale `.wip` files (`applications-lifecycle.service.ts.wip`, `applications.controller.ts.wip`, `applications.module.ts.wip`) over the active files — they are an OLDER draft and would regress newer code (fingerprinted contract PDF, analytics). Instead, port only the missing scope checks into the CURRENT active files.

Read: packages/api/src/applications/applications-lifecycle.service.ts, packages/api/src/applications/company-scope.ts (existing `assertCompanyScope` and `assertCompanyScopeForRead`), and how packages/api/src/applications/applications.service.ts already uses `assertCompanyScopeForRead` in `getOne`.

Do exactly this in applications-lifecycle.service.ts:
1. Import `assertCompanyScope` and `assertCompanyScopeForRead` from './company-scope'.
2. In each of these handlers, after loading the application record and before mutating/returning, call `await assertCompanyScope(this.prisma, user, app.companyId)`:
   - approveWithContract (~line 81)
   - submitSignedContractOps (~line 244)
   - opsTransition (~line 283)
   - activate (~line 371)
3. Make `assertCanView` (used by downloadContract, ~line 478) async and, for ops roles, call `await assertCompanyScopeForRead(this.prisma, user, app.companyId)` — mirror exactly what applications.service.ts does for downloadDocument (reads return 404, not 403, so IDs aren't enumerable across tenants). Update `downloadContract` (~line 182) to await it.
4. Do NOT weaken admin/super_admin (assertCompanyScope already lets them through). Do NOT change the contract-PDF, fingerprint, or analytics logic.
5. After this compiles and tests pass, DELETE the three stale `.wip` files.

Acceptance: every ops lifecycle handler asserts company scope; a credit_officer scoped only to Company A gets 403 on approve/activate/transition of a Company B application and 404 on its contract download, while Company A still works. `npm -w @drivemarket/api run typecheck` passes. The `.wip` files are gone.
```

## P0-2 — Integration regression tests for lifecycle company-scope

```
Add integration tests (the repo already has a testcontainers-backed suite at packages/api/test/integration/) that lock the fix from the previous prompt so it can't regress. Read packages/api/test/integration/regression.integration.spec.ts for the existing company-scope pattern (it currently only covers read + payment paths).

Add cases: a finance/credit officer assigned only to Company A receives 403 when calling approve-contract, activate, and transition on a Company B application, and 404 when downloading Company B's contract PDF; and succeeds on a Company A application. Wire into the existing integration spec so CI runs it.

Acceptance: `npm -w @drivemarket/api run test:integration` includes and passes the new lifecycle-scope cases; they fail if P0-1's assertions are removed.
```

---

# PHASE 1 — Correctness bugs (P1)

## P1-1 — Fix the unbounded KYC/contract uploads (memory-DoS)

```
In a NestJS API, the product-image upload has a multer file-size limit but the KYC-document and contract uploads do NOT — the whole body is buffered into memory before the size is checked, enabling a memory-exhaustion DoS.

Read: packages/api/src/applications/applications.controller.ts (the three `FileInterceptor('file')` usages ~lines 121, 158, 169) and how products.controller.ts already applies `multerUploadOptions()`.

Apply `multerUploadOptions()` (10MB, same helper the product upload uses) to all three KYC/contract `FileInterceptor` usages so oversized uploads are rejected before buffering. Do not change the post-upload validation.

Acceptance: all file-upload interceptors in applications.controller.ts pass a fileSize limit; an oversized upload is rejected pre-buffer (the existing LIMIT_FILE_SIZE handler in main.ts fires). typecheck passes.
```

## P1-2 — Fix the waive feature (broken by a DB CHECK constraint)

```
A dual-control waive feature 500s on every use because a DB CHECK constraint conflicts with how the waive writes the row. The migration adds `CHECK ("paidAmount" + "remainingAmount" = amount)`, but the waive path sets remainingAmount=0 while paidAmount stays at the ledger value (waive events aren't counted as paid), so 0+0 ≠ amount and Postgres rejects it.

Read: packages/api/src/payments/payments.service.ts (`applyWaiveInTransaction` ~lines 710-720, `computeScheduleAmountsFromEvents` ~lines 872-881) and the migration packages/api/prisma/migrations/20260822000000_db_integrity_checks_and_audit_immutability/migration.sql (the paid_remaining_sum CHECK ~line 14).

Choose the cleaner fix and implement it consistently:
- Preferred: on waive, treat the forgiven amount as settled — set paidAmount = amount, remainingAmount = 0, so the invariant holds; OR
- Alternative: make the CHECK conditional so it doesn't apply to waived rows (`CHECK (status = 'waived' OR "paidAmount" + "remainingAmount" = amount)`) via a new --create-only migration (show the SQL).
Whichever you choose, keep the ledger (`payment_events`) as source of truth and ensure `computeScheduleAmountsFromEvents` and the cache stay consistent with the invariant.

Add a unit test AND an integration test covering: request waive → confirm waive (dual control) on a pending schedule → schedule ends `waived` with the balance invariant satisfied and a `waive` PaymentEvent recorded.

Acceptance: waiving a pending installment succeeds (no CHECK violation); tests cover the full request→confirm→waived path; typecheck passes.
```

## P1-3 — Make the down-payment collection flow work (currently dead-ends)

```
The down-payment flow is non-functional: `recordDownPayment` throws `down_payment_not_implemented`, and there's no transition out of `down_payment_required`, so any offer with a down payment > 0 can never activate (activate() enforces `assertDownPaymentSatisfied` reading `down_payment` ledger events that nothing creates). Only 0%-down deals work.

DO NOT copy the stale `applications-lifecycle.service.ts.wip` over the active file. Port only the down-payment recorder logic from it into the CURRENT active applications-lifecycle.service.ts.

Read: packages/api/src/applications/applications-lifecycle.service.ts (`recordDownPayment` stub ~line 363, `assertDownPaymentSatisfied` usage in activate ~line 402), packages/api/src/applications/down-payment.ts, packages/api/src/applications/application-transitions.ts (the down_payment_* edges), the PaymentEvent model, and the parked reference implementation in applications-lifecycle.service.ts.wip (~line 305).

Do exactly this:
1. Implement `recordDownPayment(user, id, dto)` in the active file: assert ops role + `assertCompanyScope`; validate amount/method/reference; within a $transaction write a `down_payment` PaymentEvent (amount in the same minor-unit discipline as installments) and advance the application `down_payment_required → down_payment_submitted` via the guarded `transitionApplication` helper.
2. Add the missing transition edge(s) in application-transitions.ts so `down_payment_required → down_payment_submitted` is allowed for the correct roles.
3. Keep activate()'s `assertDownPaymentSatisfied` as the gate (do not weaken it) — now it can be satisfied by recorded events.
4. Add a unit test + an integration test: an offer with down payment > 0 → record down payment → down_payment_submitted → activate succeeds; and activate is rejected when the recorded down payment is insufficient.

Acceptance: a non-zero-down-payment application can be recorded and activated end-to-end; insufficient down payment blocks activation; tests cover both; typecheck passes.
```

## P1-4 — Add an ErrorBoundary to all six frontends

```
None of the six React apps has an ErrorBoundary, so any render throw white-screens the whole SPA (including mid-payment). Sentry is already initialized but there's no boundary to catch/recover.

Read: packages/shared/src/lib/app-bootstrap.tsx (`mountPortalApp`, ~lines 41-50) and packages/shared/src/lib/sentry.ts (@sentry/react is already a dependency).

Wrap the app tree inside `mountPortalApp` with `Sentry.ErrorBoundary` (or a small custom class ErrorBoundary if you prefer not to couple to Sentry) with a friendly fallback UI ("Something went wrong — reload") and a reset action. Because every app mounts through `mountPortalApp`, this one change covers all six.

Acceptance: a thrown error in any page renders the fallback, not a blank screen, and reports to Sentry when a DSN is set; all six apps still build. typecheck passes for shared and the apps.
```

## P1-5 — Guard the "Pay online" button against double-submit

```
In the marketplace, the "Pay online" (SkipCash) button is a raw async onClick with no pending/disabled state, so rapid taps create multiple payment sessions.

Read: packages/marketplace/src/components/ApplicationDetailPanel.tsx (~lines 312-329).

Convert the pay action to a TanStack Query `useMutation`; disable the button while `isPending` with an in-flight label ("Starting payment…"); surface errors via onError; and guard against a missing `redirect_url` in the response before navigating.

Acceptance: the pay button disables during the request; double-tap fires exactly one SkipCash session; errors are shown, not swallowed. typecheck passes.
```

## P1-6 — Seed a `system` user to fix cron FK failures (and reminder spam)

```
A `'system'` actor id is used as `actorUserId` for cron writes (overdue sweep, payment-reminder dedup log, sandbox payment complete), but no `system` user exists in the DB, so those writes hit a foreign-key violation. The payment-reminder run aborts mid-batch and — because the dedup row never writes — re-notifies/re-emails the same customer every run.

Read: packages/api/src/common/system-actor.ts (`SYSTEM_ACTOR_USER_ID`), its uses in packages/api/src/payments/payments.service.ts (~lines 421, 534) and packages/api/src/jobs/jobs.service.ts (~line 195), and the FK on activity_logs.actorUserId / payment_events.actorUserId.

Pick one and apply consistently:
- Preferred: seed a dedicated `system` user (a migration or an idempotent bootstrap in onModuleInit that upserts a user with id = SYSTEM_ACTOR_USER_ID, role super_admin, isActive true, a non-login email) so all system-attributed rows have a valid FK; OR
- Alternative: make these audit/ledger writes use `actorUserId: null` (the columns are nullable) for system actions.

Add a cron/integration test (or a focused unit test) that the payment-reminder job completes a batch and writes its dedup rows without FK errors.

Acceptance: overdue sweep and payment-reminder jobs run without FK violations; the same schedule isn't re-notified on repeat runs; typecheck passes.
```

---

# PHASE 2 — Hardening (P2)

## P2-1 — Real compliance provider interface + run the gate on the direct-activate path

```
The compliance gate is fail-closed (good) but the provider is a throwing stub, so the standard approveWithContract path can't complete; meanwhile the `allowDirectActivate` path skips the compliance gate AND contract signing entirely — an AML gap once a company enables it.

Read: packages/api/src/compliance/ (compliance.service.ts, compliance-gate.ts, compliance-provider.stub.ts, compliance.module.ts) and packages/api/src/applications/applications-lifecycle.service.ts (the `opts.direct` branch in activate, ~lines 390-404, and how approveWithContract calls `compliance.assertPassedForApproval`).

Do two things:
1. Keep the provider behind the existing interface, but leave the vendor HTTP call as an injectable, clearly-marked stub that throws NotImplemented (do NOT fake a pass). Add a config flag / dev-only provider that can return a recorded pass ONLY in non-production, so the standard approval path is testable locally while production stays fail-closed until a real vendor is wired.
2. In the direct-activate branch, also call the compliance gate (and, per policy, require a generated/signed contract) before activating — do not let `allowDirectActivate` bypass AML.

Acceptance: production approval remains fail-closed (stub throws); a dev provider allows the approval path to be tested locally; direct-activate now runs the compliance gate; typecheck + tests pass.
```

## P2-2 — Close the remaining authz gaps (zoho failures scope, MFA enforcement, S3-mandatory, token)

```
Four independent hardening fixes in the NestJS API. Do them as separate commits.

1. Scope `GET /api/ops/zoho/failures` (packages/api/src/ops/ops.controller.ts ~lines 142-194) by company using the existing `opsCompanyFilter`, so a scoped credit_officer can't read customer emails across all companies. Do the same for `GET /api/ops/metrics` (~lines 33-64) or restrict it to admin/super_admin.

2. Enforce MFA on privileged roles: add a guard (or extend SessionAuthGuard, packages/api/src/auth/guards.ts) that rejects requests from an MFA-required role whose `twoFactorEnabled` is false on privileged routes (allow a documented grace period via config if desired). Today MFA is available but only nudged in the UI.

3. Make S3 mandatory in production: in storage.service.ts, if NODE_ENV=production and S3 buckets/endpoint are unset, fail fast at boot instead of silently falling back to local disk (real KYC PDFs must not land on ephemeral container disk).

4. Delete packages? No — the Vercel token in `.env.local` must be rotated by a human in the Vercel dashboard and the file deleted from disk; add a note to docs/DEPLOY.md that `.env.local` must never be committed and the token rotated. (Do not attempt to rotate it in code.)

Acceptance: zoho-failures/metrics are company-scoped; privileged MFA-required users without 2FA are blocked; prod boot fails fast without S3; DEPLOY.md notes token hygiene. typecheck passes.
```

## P2-3 — i18n for ops apps + marketplace residuals; dealer CompanyPage; 401-latch reset

```
Frontend polish across the six apps. Do as separate commits.

1. The five ops apps (admin, dealer, credit, finance, super-admin) are 100% hardcoded English. Adopt the existing shared i18n (packages/shared/src/i18n) in their pages so Arabic/RTL users get a translated back office. Start with the most-used screens (queues, detail, actions). Also fix the marketplace residuals: packages/marketplace/src/AppRoutes.tsx apply-form field labels (~line 711), the hardcoded error (~637), and the fully-English QuoteRedeemPage (~840-867) — wrap in `t()` using existing/added keys.

2. packages/dealer/src/main.tsx CompanyPage (~lines 776-780) renders `<pre>{JSON.stringify(data)}</pre>` — replace with a proper fielded view (logo, phone, address, branding) since these feed the public showroom.

3. Fix the 401 latch: packages/shared/src/lib/api.ts (`handlingUnauthorized` ~line 36) never resets if a 401 occurs while already on an /auth/* route, silently swallowing later 401s. Reset the flag when the handler early-returns.

Acceptance: ops apps render Arabic when locale=ar; quote/apply screens localized; dealer company page is a real view; the 401 handler recovers on /auth pages. typecheck passes.
```

## P2-4 — Missing tests + backup runbook + request IDs

```
Three reliability/ops gaps. Separate commits.

1. Add the test coverage whose absence let the P1 bugs ship: waive (request→confirm→waived, balance invariant), down-payment (record→activate, insufficient blocks), and the cron jobs (overdue sweep marks overdue; payment reminders dedup and don't FK-fail). Put integration tests in packages/api/test/integration/ and wire into CI.

2. Write a backup/DR runbook in docs/ (e.g. docs/BACKUP_DR.md): managed-Postgres backup cadence, PITR window, a restore drill procedure, and retention policy for the financial ledger + KYC documents. Reference it from docs/DEPLOY.md.

3. Add a request-id / correlation-id middleware to the API (generate or accept `x-request-id`, attach to the Nest logger context and Sentry scope) so 2AM incidents are traceable.

Acceptance: the three test suites run in CI and pass; docs/BACKUP_DR.md exists and is linked from DEPLOY.md; every API response/log carries a request id. typecheck passes.
```

---

# PHASE 3 — Optimization (P3)

```
Low-priority cleanups; pick up as time allows.

1. Unify the listing-card monthly estimate: packages/api/src/products/products.service.ts `estimateMonthlyFromOffer` (~line 153) reimplements amortization with whole-QAR rounding, independent of @drivemarket/shared/pricing — so a listing card can show a monthly figure that disagrees with the detail/quote/contract figure. Replace it with the shared `estimateMonthlyPayment`.

2. Fix the residual "stock photo as the vehicle" case: for listings with zero images, show a neutral "no photos" placeholder instead of a generic car stock image (packages/marketplace/src/components/ListingCard.tsx ~line 68, VehicleDetailParts.tsx ~21-24).

3. Validate dealer `defaultOfferId` on product create/update (packages/api/src/products/products.service.ts ~331,360): verify the offer exists, is active, and is permitted for the company before persisting.

4. Cap the few remaining unbounded reference-data list queries.

5. Have counsel supply certified Qatar consumer-credit disclosure text for the contract PDF (packages/api/src/applications/contract-pdf.ts) to replace the generic disclosures.

Acceptance per item: the change is made, the affected app/API builds, typecheck passes.
```

---

## Reminders for Composer on this repo
- After each backend prompt: `npm -w @drivemarket/api test` and, where noted, `npm -w @drivemarket/api run test:integration`; paste failures back before accepting.
- Schema changes: `prisma migrate dev --create-only`, review the SQL, never `migrate deploy`/`db push` against a real DB.
- Never overwrite an active file with its `.wip` — port the specific change and delete the stale `.wip`.
- Keep it one concern per prompt; if Composer sprawls, stop and re-scope.
```

