# Blox / DriveMarket — Cursor Composer 2.5 Fix Prompts

How to use this file:

- Run prompts **in order** — later ones assume earlier fixes exist (e.g. the ledger and the `assertCompanyScope` helper).
- Give Composer **one prompt at a time.** Each is scoped to a single concern so the model doesn't sprawl. Batching them together is the main way these fail.
- Every prompt ends with **"Acceptance"** — after Composer finishes, verify against it before moving on. Where a test is specified, make Composer run it (`npm -w @drivemarket/api test`) and paste failures back.
- Prompts assume the repo root is open in Cursor and the API lives at `packages/api`.
- Do the **manual pre-step** below first — Composer can't rotate a cloud token for you.

**Manual pre-step (you, not Composer):** Revoke/rotate the `VERCEL_OIDC_TOKEN` in the Vercel dashboard (project `blox-ops`), delete `.env.local` and `packages/marketplace/.env.local` from disk, and run `git log --all -- .env.local packages/marketplace/.env.local` to confirm neither was ever committed. If either was committed, purge it from history with `git filter-repo`.

---

# PHASE 0 — Emergency (do before any real money or customers)

## P0-A — Kill the payment-completion bypass

```
You are hardening a fintech payments flow in a NestJS + Prisma API. There is a CRITICAL vulnerability: `POST /api/payments/skipcash/complete` is @Public() and marks a PaymentTransaction "completed" (and records the installment as paid via a synthetic super_admin) using an idempotency key that the server previously handed the customer in the redirect URL. There is NO gateway verification. A customer can settle an entire loan without paying.

Read these files fully before changing anything: packages/api/src/payments/payments.controller.ts, packages/api/src/payments/payments.service.ts, packages/api/src/payments/payments.module.ts.

Do exactly this:
1. Add a config flag `SKIPCASH_SANDBOX` (read via ConfigService, default false; treat only the literal strings "true"/"1" as true). Add a matching entry to packages/api/.env.example with a comment that it MUST be false in production.
2. The client-facing completion path (`POST /payments/skipcash/complete`) must NO LONGER trust the client-supplied key as proof of payment. When SKIPCASH_SANDBOX is false, this endpoint must return HTTP 403 with body {error:"gateway_verification_required"} and do nothing else. When SKIPCASH_SANDBOX is true, keep the current simulated behavior but log a clear warning that a sandbox completion occurred.
3. Add a new method `verifyAndComplete(gatewayPaymentId)` in payments.service.ts that is the ONLY path allowed to mark a transaction completed in production. Leave its gateway HTTP call as a clearly-marked TODO stub that throws `NotImplementedException('skipcash_verify_not_implemented')` — do NOT invent a fake gateway response. The point is that production cannot complete a payment until real verification is wired.
4. Remove the `OR: [{ idempotencyKey }, { id: idempotencyKey }]` lookup — match on idempotencyKey only.

Do not change pricing or schedule logic. Do not touch other modules.

Acceptance: with SKIPCASH_SANDBOX unset/false, hitting the public complete endpoint returns 403 and no PaymentTransaction or PaymentSchedule row changes. The simulated path only runs when the flag is explicitly true. `npm -w @drivemarket/api run typecheck` passes.
```

## P0-B — Add company-scope enforcement to every per-record ops/payment handler

```
You are fixing a cross-tenant IDOR cluster in a NestJS + Prisma API. Credit/finance officers are scoped to companies via creditScope/financeScope ("all" vs "assigned") plus the CreditOfficerCompany / FinanceOfficerCompany join tables. LIST endpoints already filter correctly via `opsCompanyFilter`, but PER-RECORD handlers only check the role, never whether the record's companyId is in the officer's allowed set. So an officer for Company A can view/approve/reject/activate/pay Company B's applications by iterating IDs.

Read: packages/api/src/applications/applications.service.ts (find opsCompanyFilter and assertCanView), packages/api/src/applications/applications-lifecycle.service.ts (opsTransition, approveWithContract, activate, submitSignedContractOps), packages/api/src/payments/payments.service.ts (listSchedules, recordPayment, waiveSchedule), and the Prisma schema for the scope models.

Do exactly this:
1. Create one shared helper `assertCompanyScope(user, companyId)` (put it next to opsCompanyFilter, export it). It must: allow admin/super_admin always; for credit_officer/finance_officer with scope "all" allow always; for scope "assigned" load the officer's allowed companyIds (reuse the same query opsCompanyFilter uses) and throw ForbiddenException('out_of_scope') if companyId is not in the set. For any other role throw ForbiddenException.
2. Call it in EVERY per-record ops handler after loading the record and before acting: assertCanView (used by getOne, downloadDocument, downloadContract), opsTransition, approveWithContract, activate, submitSignedContractOps.
3. Call it in payments: recordPayment and waiveSchedule (load the schedule's application.companyId), and make listSchedules filter by the officer's allowed companies exactly like opsCompanyFilter does.
4. Out-of-scope reads (getOne/downloadDocument/downloadContract) should return 404 (NotFoundException), not 403, so IDs are not enumerable. Out-of-scope writes may throw 403.

Do not change what admins/super_admins can do. Do not change the transition rules matrix.

Acceptance: a finance_officer assigned only to Company A receives 404 on Company B's application detail/documents and 403 when trying to recordPayment/transition a Company B record; Company A records still work. `npm -w @drivemarket/api run typecheck` passes. Add unit tests in packages/api/src/applications for assertCompanyScope covering all/assigned/admin/wrong-company.
```

## P0-C — Introduce an append-only payment ledger; stop cascade-deleting financial records

```
You are adding financial integrity to a NestJS + Prisma (PostgreSQL) API. Today paidAmount/remainingAmount on PaymentSchedule are overwritten in place (prior values lost) and PaymentSchedule/PaymentTransaction/ApplicationDocument have onDelete: Cascade from Application, so deleting one application silently destroys the entire repayment history. There is no immutable ledger.

Read: packages/api/prisma/schema.prisma and packages/api/src/payments/payments.service.ts.

Do exactly this:
1. In schema.prisma, add an append-only model `PaymentEvent` (@@map "payment_events"): id (cuid), applicationId, scheduleId (nullable), transactionId (nullable), type (enum PaymentEventType: down_payment | installment | waive | adjustment | reversal), amount Decimal @db.Decimal(12,2), currency default "QAR", actorUserId (nullable), reason (nullable), metadata Json?, createdAt @default(now()). Index on (applicationId, createdAt) and (scheduleId, createdAt). NO updatedAt — this table is never updated.
2. Change the onDelete for PaymentSchedule.application and PaymentTransaction.application from Cascade to Restrict. Keep ApplicationDocument as-is for now but note it in a comment.
3. In payments.service.ts, every place that mutates a schedule's paidAmount/waives/records must ALSO insert a PaymentEvent inside the SAME prisma.$transaction. The PaymentEvent is the source of truth; paidAmount/remainingAmount become a derived cache. Add a helper to recompute a schedule's paidAmount = sum(installment+down_payment events) − sum(reversal), remainingAmount = amount − paidAmount, derived from events, and assert it matches before commit.
4. Generate a Prisma migration for this (do NOT use db push): `npx prisma migrate dev --name add_payment_ledger_and_restrict_deletes --create-only`, then show me the SQL so I can review before it's applied.

Do all money math with the Prisma.Decimal type, never JS number/float.

Acceptance: a new migration file exists under packages/api/prisma/migrations adding payment_events and altering the two FKs to Restrict; recordPayment and waiveSchedule write a PaymentEvent atomically; typecheck passes. Do not run migrate deploy against any real database — only create the migration.
```

## P0-D — Make every money/status transition atomic (guarded conditional updates + Decimal)

```
You are eliminating race conditions in a NestJS + Prisma (PostgreSQL, READ COMMITTED) API. Currently every status/payment transition does an out-of-transaction read of the current state, then `update where {id}` unconditionally. This causes lost updates (two concurrent partial payments both read paidAmount=0), double-approve (two officers both generate a contract), two applications reserving the same vehicle, and quote redeem/revoke races. Also SkipCash completion marks the transaction "completed" and THEN records the payment in a separate transaction — if recording fails the txn is permanently completed with no schedule update.

Read: packages/api/src/applications/applications.service.ts (submit, resubmit, cancel, create/quote redemption), packages/api/src/applications/applications-lifecycle.service.ts (opsTransition, approveWithContract, activate, submitSignedContract*), packages/api/src/payments/payments.service.ts (recordPayment, waiveSchedule, completeSkipCashPayment), packages/api/src/quotes/quotes.service.ts (revoke, redemption).

Do exactly this, WITHOUT changing the business rules:
1. Replace every `update({where:{id}, data:{status: newStatus, ...}})` that represents a state transition with a guarded `updateMany({where:{id, status: expectedFromStatus}, data:{...}})` inside the transaction, and throw a ConflictException('stale_transition') when the returned count is 0. The expectedFromStatus is the status the code already asserted.
2. Product reservation on submit: guard with `product.updateMany({where:{id, listingStatus:'published'}, data:{listingStatus:'reserved'}})` and throw ConflictException('vehicle_unavailable') on count 0.
3. Quote redemption: guard the DealerQuote update with `updateMany({where:{token, usedAt:null, revokedAt:null, expiresAt:{gt: now}}, ...})`, abort the transaction on count 0. Same guard-on-condition idea for revoke.
4. recordPayment/waiveSchedule: read the schedule with a row lock (`SELECT ... FOR UPDATE` via `$queryRaw`) at the start of the transaction, OR use a guarded updateMany keyed on the current paidAmount; retry-free is fine as long as concurrent writers cannot both succeed. Do all arithmetic in Prisma.Decimal, not Number().
5. completeSkipCashPayment: wrap the transaction-mark-completed AND the payment recording in ONE prisma.$transaction, guarding the transaction update with `where:{id, status:'pending'}` and throwing on count 0.

Acceptance: no transition uses a bare `update where {id}` for a status change anymore; grep for `.update(` in these files and confirm each remaining one is not a state transition. typecheck passes and existing specs still pass. Add a unit test proving a second concurrent transition attempt (simulated by calling with the already-advanced status) throws stale_transition.
```

## P0-E — Fix the Prisma migration set and de-couple migrations from the app boot

```
You are fixing a broken migration setup in a NestJS + Prisma project that will crash on deploy. Problems: (1) the migrations directory is missing the payment_transactions table and PaymentTransactionStatus enum entirely — they exist only in schema.prisma, so a fresh `migrate deploy` builds a DB without them and payments crash at runtime; (2) migration 0_init defaults applications.status to 'under_review' while schema.prisma says 'draft'; (3) the Dockerfile runs `npx prisma migrate deploy && node dist/src/main.js` as the container CMD, so migrations run on every boot and a failure crash-loops the app.

Read: packages/api/prisma/schema.prisma, everything under packages/api/prisma/migrations, packages/api/Dockerfile, railway.toml, docs/DEPLOY.md.

Do exactly this:
1. Reconcile the migrations with the current schema. Generate the missing migration(s) so that a fresh database created purely from `prisma migrate deploy` matches schema.prisma exactly — including payment_transactions, PaymentTransactionStatus, and the correct applications.status default of 'draft'. Use `npx prisma migrate diff` against the schema to produce the SQL; create the migration with --create-only and show me the SQL before applying.
2. Remove `npx prisma migrate deploy` from the Dockerfile CMD. The CMD should be just `node dist/src/main.js`.
3. Add migrations as a Railway release/pre-deploy step instead: document the exact command (`npx prisma migrate deploy`) in docs/DEPLOY.md as a release phase that runs once before the new version serves traffic, with a note that a failed migration must block the cutover, and add a `db:deploy` script to packages/api/package.json.
4. Update docs/DEPLOY.md to remove any guidance suggesting `prisma db push` for shared/production environments — db push is local-dev only.

Acceptance: `npx prisma migrate diff --from-migrations packages/api/prisma/migrations --to-schema-datamodel packages/api/prisma/schema.prisma --shadow-database-url <local>` reports NO drift (an empty diff). The Dockerfile CMD no longer runs migrations. Do not apply anything to a production database.
```

## P0-F — Stand up CI, real lint, error tracking, and a deep health probe

```
You are adding baseline CI and observability to a TypeScript monorepo (NestJS API + six Vite React apps, npm workspaces). Currently: there is NO CI pipeline, every package's `lint` script is a fake `echo`, there is no ESLint config anywhere, there is no error tracking, and the health endpoint returns a static {ok:true} without touching the database.

Do exactly this, in four independent commits:

1. Real ESLint: add eslint + @typescript-eslint + eslint-plugin-import at the root, with a shared flat config (eslint.config.js). Enable @typescript-eslint/no-floating-promises and no-misused-promises (this codebase relies on fire-and-forget async), no-explicit-any as warn, and unused-vars as error. Replace every package's `lint` echo script with a real `eslint .` invocation. Fix or explicitly disable-with-comment any errors this surfaces in packages/api/src (do not mass-disable).

2. GitHub Actions CI: add .github/workflows/ci.yml that runs on pull_request and pushes to main: npm ci, then `npm run typecheck`, `npm run lint`, `npm -w @drivemarket/api test`, `npm run build` — all workspaces, fail the job on any red.

3. Sentry: add @sentry/node to the API (init in main.ts, DSN from SENTRY_DSN env, no-op when unset) and @sentry/react to packages/shared (init helper the apps call, DSN from VITE_SENTRY_DSN which already exists). Do not send PII; scrub request bodies.

4. Deep health probe: change packages/api/src/health.controller.ts to expose GET /api/health (cheap liveness, static ok) AND GET /api/health/ready that pings the database via Prisma ($queryRaw`SELECT 1`) and returns 503 if it fails. Update railway.toml healthcheckPath to /api/health/ready.

Acceptance: `npm run lint` actually runs ESLint and reports real results; the CI workflow file exists and references typecheck+lint+test+build; /api/health/ready returns 503 when the DB is unreachable. typecheck passes.
```

---

# PHASE 1 — Production readiness

## P1-A — Record and enforce the down payment as real money before activation

```
You are closing a financial-integrity gap in a NestJS + Prisma vehicle-financing API. Today the down payment is only a status flip (down_payment_required → down_payment_submitted) with no amount recorded, and the contract_under_review → pending_finance_activation edge bypasses down-payment states entirely, so an application can go active with zero down payment received and no record it was expected.

This depends on the PaymentEvent ledger added earlier. Read: packages/api/src/applications/application-transitions.ts, packages/api/src/applications/applications-lifecycle.service.ts (activate and the direct-activate path), packages/api/src/applications/application-pricing.ts (where minDownPaymentPct and the required down payment amount live), and the PaymentEvent model.

Do exactly this:
1. Add an ops endpoint to record a down-payment receipt: amount, method, reference, paidAt. It writes a PaymentEvent of type down_payment (atomically) and moves the application to down_payment_submitted. Enforce assertCompanyScope.
2. In activate() (both the normal pending_finance_activation path and the allowDirectActivate direct path), assert that the sum of recorded down_payment PaymentEvents for the application is >= required down payment (minDownPaymentPct * financed price, from the pricing snapshot). Throw a clear error (e.g. 'down_payment_incomplete') if not. The allowDirectActivate flag may skip the contract-signing states but must NOT skip this down-payment check.
3. Compute the required amount from the server-side pricingSnapshot, never from client input.

Acceptance: activation is rejected until down_payment events covering the required amount exist; a unit test proves activate() throws down_payment_incomplete when no/insufficient down-payment events exist and succeeds when they cover it. typecheck + existing specs pass.
```

## P1-B — Global 401/session-expiry handling and sane query retry across all six apps

```
You are fixing session-expiry UX in a monorepo of six React 19 + Vite apps sharing packages/shared. Problem: there is no global 401 handler; apiFetch throws but nothing signs the user out or redirects, and TanStack Query's default retry:3 (no QueryClient is configured anywhere) fires three pointless retries on an expired session, then shows raw errors or silent empty pages — including mid-payment. AuthGuard.requireVerifiedEmail is also a no-op comment.

Read: packages/shared/src/lib/api.ts (apiFetch, ApiError), packages/shared/src/auth/auth-store.ts, packages/shared/src/auth/AuthGuard.tsx, and each app's main.tsx where QueryClient should be configured.

Do exactly this:
1. In packages/shared, export a factory `createQueryClient()` with defaultOptions: queries retry only when the error is NOT an ApiError with status 401/403 and status < 500 (i.e. don't retry auth/client errors; allow limited retry for 5xx). Use it in all six apps' main.tsx instead of a bare `new QueryClient()`.
2. Add a global 401 handler: when apiFetch receives 401, clear the auth store and redirect to /auth/login?returnUrl=<current path>&reason=session_expired. Centralize this so every app benefits — do it in apiFetch (via an injected onUnauthorized callback the auth store registers) rather than per-call.
3. Implement AuthGuard's requireVerifiedEmail properly: if the user is authenticated but emailVerified is false and the guard requires it, redirect to a verify-email screen (or show a resend-verification prompt) instead of silently passing.
4. Add a minimal "session expired — please sign in again" banner keyed off ?reason=session_expired on the login page (localize the string).

Do not change the cookie/auth mechanism (it correctly uses credentials:'include', no localStorage tokens). Keep it.

Acceptance: an expired session triggers exactly one redirect to login (no retry storm) with returnUrl preserved; requireVerifiedEmail actually gates. typecheck passes for shared and all apps.
```

## P1-C — Fix the dealer app's missing password-reset routes

```
In a Vite React monorepo, the dealer app's LoginPage (from packages/shared) links to /auth/forgot-password and /auth/reset-password, but the dealer app (packages/dealer/src/main.tsx) never registers those routes, so dealers clicking "Forgot password?" hit the catch-all and get bounced back to login — they can never reset a password. The other five apps register these routes correctly.

Read how one working app registers them (e.g. packages/marketplace/src/AppRoutes.tsx) and the shared ForgotPasswordPage/ResetPasswordPage components. Then add the same /auth/forgot-password and /auth/reset-password routes to packages/dealer/src/main.tsx, wired to the shared components, matching the pattern of the other apps exactly.

Acceptance: dealer app has working forgot/reset routes; the "Forgot password?" link resolves instead of looping. typecheck passes.
```

## P1-D — Surface errors and add pending/confirmation states on all money/state actions

```
You are fixing dangerous UX in ops React apps where irreversible actions swallow errors and have no guards. Specific problems:
- admin/src/pages/ApplicationsPage.tsx (~line 96): the "Activate" action is a bare apiFetch(...).then(...) with NO .catch and no pending state — a failed activation looks like success and double-click fires twice.
- finance "Confirm full payment", credit "Reject"/"Direct activate", super-admin role-change/suspend/company-flag toggles are one-click with no confirmation.
- Several transition/CRUD buttons across credit and dealer are not disabled while pending.

Do exactly this, app by app (do not refactor unrelated code):
1. Convert every mutating action in admin ApplicationsPage, finance (main.tsx payment/activation actions), credit (transition actions), dealer (save/publish/unpublish), and super-admin (role/suspend/company toggles) to TanStack Query useMutation with an onError that surfaces the error to the user (a visible message, not a swallow) and `disabled={isPending}` on the triggering button.
2. Add a confirmation step (reuse the existing window.confirm pattern already used in marketplace cancel) before any irreversible or money action: full-payment confirmation, reject, direct-activate, role change, suspend, and company-flag toggles. The confirm text must name the specific record/user and action.
3. The finance "Confirm full payment" must also accept a payment amount and method so partial payments are possible (the API recordPayment already supports partials); default the amount to the remaining balance.

Acceptance: no mutating button in these apps ignores errors or lacks a pending-disable; irreversible actions prompt for confirmation naming the target; finance can record a partial payment. typecheck passes for the affected apps.
```

## P1-E — Render underwriting data in the credit review screen

```
In the credit app (packages/credit/src/main.tsx), the application review detail (AppDetail, ~lines 105-286) fetches customerSnapshot (income, employment, QID) and pricingSnapshot but never renders them — so credit officers approve/reject without seeing the applicant's income or the plan terms in-app, and must open raw KYC files to underwrite. This is the biggest ops UX gap.

Read the AppDetail component and confirm the shape of customerSnapshot and pricingSnapshot (see packages/api/src/applications for what's stored). Then add a clearly laid-out "Applicant & plan" section to the review detail that displays: full name, phone, QID, employment, and stated income from customerSnapshot; and vehicle price, offer/rate, tenure, down payment, and monthly installment from pricingSnapshot — before the decision buttons. Use the app's existing styling; do not add new dependencies. Handle missing fields gracefully.

Acceptance: a credit officer sees income/employment/QID and full plan terms on the review screen without opening files. typecheck passes.
```

## P1-F — Reliable email: outbox with retry and hard-fail on auth-critical sends

```
You are fixing silent email failure in a NestJS API. mail.service.ts send() catches SMTP errors and returns void, so password-reset, email-verification, and walk-in-invite emails can silently drop while the API reports success. assertProductionReady only guards the verification case, so with REQUIRE_EMAIL_VERIFICATION=false prod can boot with no SMTP transport and every reset/invite silently vanishes.

Read: packages/api/src/mail/mail.service.ts, packages/api/src/mail/mail.module.ts, and how auth.ts calls sendResetPassword/sendVerificationEmail.

Do exactly this:
1. Add an EmailOutbox Prisma model (id, to, subject, template/type, payload Json, status: pending|sent|failed, attempts Int default 0, lastError String?, nextAttemptAt DateTime?, createdAt, sentAt DateTime?). Create a migration (--create-only, show me the SQL).
2. Change send() so that instead of fire-and-forget, it enqueues an EmailOutbox row (pending) and attempts immediate delivery; on success mark sent, on failure mark the row failed/pending-with-backoff and — for AUTH-CRITICAL sends (password reset, email verification) — THROW so the caller and the user learn it failed, rather than silently returning.
3. Broaden the boot assertion: in production, if ANY email path could run (not just verification) and no SMTP transport is configured, fail closed at boot with a clear message.
4. Add a scheduled worker (see the scheduler prompt P2-C — if @nestjs/schedule isn't installed yet, add a method markForRetry/processOutbox and a TODO to wire the cron) that retries failed/pending rows with exponential backoff, capping attempts.

Acceptance: a failed password-reset send throws (caller sees it) and leaves a failed EmailOutbox row; prod boot fails closed when email is possible but unconfigured; migration created but not applied to any real DB. typecheck passes.
```

## P1-G — Use Railway's PORT and add DB-level integrity constraints

```
Two backend correctness fixes in a NestJS + Prisma (PostgreSQL) API. Do them as two separate commits.

Commit 1 — port binding: packages/api/src/main.ts binds `Number(config.get('API_PORT') ?? 3000)`, ignoring Railway's injected PORT, despite a tested helper resolveApiPort(config) in packages/api/src/auth/auth-config.ts that correctly prefers process.env.PORT ?? API_PORT ?? 3010. Change main.ts to use resolveApiPort(config).

Commit 2 — DB integrity: the schema has no CHECK constraints, the ActivityLog (audit) table is freely mutable, and VIN/chassis/QID are not unique. Create ONE raw-SQL Prisma migration (--create-only, show me the SQL before applying) that adds:
- CHECK constraints: payment_schedules (amount > 0, "paidAmount" >= 0, "remainingAmount" >= 0, "paidAmount" + "remainingAmount" = amount); payment_transactions (amount > 0); products (price > 0); dealer_quotes ("negotiatedPrice" > 0 AND "negotiatedPrice" <= "listPriceSnapshot").
- Partial unique indexes: products(vin) WHERE vin IS NOT NULL; products("chassisNumber") WHERE "chassisNumber" IS NOT NULL; users(qid) WHERE qid IS NOT NULL.
- An immutability guard on activity_logs: a BEFORE UPDATE OR DELETE trigger that RAISEs an exception (audit rows are append-only).
Also add QID format validation (11 digits) to the DTO/validation where qid is accepted.

Match the exact snake_case/camelCase column names Prisma generated (check the schema @map/quoting). Do not apply the migration to any real database.

Acceptance: main.ts uses resolveApiPort; a new migration adds the CHECKs, partial uniques, and the activity_logs immutability trigger; QID is format-validated. typecheck + existing specs pass.
```

## P1-H — Minimum integration/E2E test suite with regression locks for the P0s

```
You are adding the first integration tests to a NestJS + Prisma API that currently has only pure-function unit tests (no test touches the DB, HTTP layer, or guards). Use @nestjs/testing + supertest against a test database (Testcontainers Postgres if available, otherwise a dedicated TEST_DATABASE_URL). Add a vitest project/config for integration tests separate from the unit specs.

Write integration tests covering, in priority order:
1. REGRESSION LOCK for the payment bypass: assert that with SKIPCASH_SANDBOX false, POST /api/payments/skipcash/complete returns 403 and changes no rows.
2. REGRESSION LOCK for officer company scope: a finance_officer assigned only to Company A gets 404 on Company B's application detail/documents and 403 on recordPayment/transition; Company A works.
3. Auth/authz: unauthenticated requests to protected routes get 401; wrong-role gets 403; suspended user's session is rejected immediately.
4. Apply → upload KYC → submit happy path, plus ownership: customer B cannot read or mutate customer A's application/documents.
5. Credit approve/reject requires a reason where the transition matrix says so.
6. Payment: authorized recordPayment updates the schedule and writes a PaymentEvent; a stale/duplicate transition throws conflict.

Wire these into the CI workflow so they run on every PR. Keep fixtures small and seed per-test.

Acceptance: `npm -w @drivemarket/api run test:integration` runs and passes locally; CI runs it; the two regression-lock tests fail if someone reverts P0-A or P0-B. 
```

---

# PHASE 2 — Hardening

## P2-A — Rate limiting, Helmet security headers, and hardened uploads

```
You are adding standard web-security middleware to a NestJS API and its Vercel-hosted frontends. Currently: express-rate-limit is a declared-but-UNUSED dependency, Helmet is absent (no CSP/HSTS/X-Frame-Options/nosniff), multer uploads have no size limit and buffer fully in memory, and storage keys interpolate the raw client filename (path-traversal / Content-Disposition header-injection risk).

Read: packages/api/src/main.ts, packages/api/src/storage/storage.service.ts, the upload interceptors in applications.controller.ts and products.controller.ts, and the six packages/*/vercel.json files.

Do exactly this:
1. Apply Helmet in main.ts with a sensible CSP; ensure user-uploaded files are served with `X-Content-Type-Options: nosniff` and `Content-Disposition: attachment`.
2. Apply express-rate-limit (or @nestjs/throttler) globally with a stricter limit on /api/auth/*, the public payment/quote endpoints, and product listing. Make limits configurable via env.
3. Configure multer limits.fileSize (e.g. 10MB) at the interceptor/module level so oversized uploads are rejected before buffering, not after.
4. In storage.service.ts, stop using client file.originalname in the storage key — use only randomUUID() + a validated extension derived from a mime allow-list. Sanitize/encode the filename used in Content-Disposition on download.
5. Add a `headers` block to each vercel.json setting HSTS, X-Frame-Options DENY, X-Content-Type-Options nosniff, and a CSP appropriate for a Vite SPA.

Acceptance: oversized multipart uploads are rejected pre-buffer; storage keys never contain client filenames; security headers present on API responses and Vercel apps; auth endpoints are rate-limited. typecheck passes.
```

## P2-B — Correct installment rounding and a single shared pricing function

```
You are fixing monetary-rounding drift in a vehicle-financing app. Problems: the monthly payment is computed in JS floats and rounded to whole QAR, every installment is that same rounded figure with no last-installment true-up, so the sum of installments does not equal the financed total (e.g. 36×2,398 = 86,328 vs true 86,334.84). Separately, packages/shared/src/lib/calculator.ts is a byte-for-byte duplicate of the server's estimateMonthlyPayment (packages/api/src/quotes/quote-pricing.ts) with no test guaranteeing they agree — displayed vs charged price can silently diverge.

Do exactly this:
1. Create ONE pricing module in packages/shared (e.g. shared/src/lib/pricing.ts) that both the API and the web apps import. It must compute in integer minor units (or Decimal), round each installment to 2 decimals, and put the residual on the LAST installment so the sum of the schedule equals the financed total exactly. Preserve the existing rate/tenure/down-payment semantics.
2. Replace the server's quote-pricing.ts monthly computation and packages/api/src/applications/payment-schedules.ts schedule generation to use the shared function (last-installment true-up in the schedule).
3. Replace the marketplace's use of calculator.ts with the shared function and delete the duplicate calculator.ts.
4. Add a contract test (runs in CI) asserting the API and the shared function produce identical output across a grid of principals/rates/tenures, and that sum(schedule) === financed total for each.

Do NOT change what the customer is charged in aggregate — only fix the rounding distribution and unify the source. Keep amounts server-authoritative.

Acceptance: for any input, the generated schedule sums exactly to the financed total; one shared pricing function is imported by both API and web; the duplicate calculator.ts is gone; the contract test passes in CI. typecheck passes.
```

## P2-C — Scheduled jobs: overdue sweep, reminders, Zoho retry, quote expiry, email outbox

```
You are adding background scheduling to a NestJS API that currently has NONE — overdue installments are only flagged when a human clicks a button, failed Zoho lead syncs never auto-retry, expired quotes are never swept, and the email outbox (added earlier) has no worker.

Install @nestjs/schedule and register ScheduleModule. Read: packages/api/src/payments/payments.service.ts (markOverdue), packages/api/src/integrations/zoho/* (failed-sync handling), packages/api/src/quotes/quotes.service.ts, and the EmailOutbox model.

Add cron jobs (make each also invokable via an internal admin endpoint for manual runs, and log start/finish + counts):
1. Overdue sweep — daily: run markOverdue across all pending schedules with dueDate in the past.
2. Payment reminders — daily: notify customers of installments due soon and overdue (in-app + email once the email channel exists). Dedup so a reminder isn't sent twice for the same schedule/day.
3. Zoho retry — every N minutes: re-attempt applications with zohoSyncError set or never synced, with capped attempts and backoff.
4. Quote expiry — hourly: mark quotes past expiresAt appropriately so they're not redeemable (belt-and-suspenders with the redemption guard).
5. Email outbox worker — every few minutes: process pending/failed EmailOutbox rows with exponential backoff, capping attempts.
Add an alert/log if a sweep hasn't succeeded within its expected window.

Acceptance: ScheduleModule is registered; each job exists with a cron decorator and an internal manual-trigger endpoint (scoped to admin/super_admin); overdue/quote-expiry no longer depend on a human. typecheck passes.
```

## P2-D — Segregation of duties (maker-checker) on approve / activate / waive

```
You are adding segregation-of-duties controls to a NestJS financing API. Today admin and super_admin are in BOTH the credit-ops role set and the payment role set, so one admin can approve credit, file the signed contract, activate, record every payment, AND waive — the entire lifecycle alone, with no second approver. Waive requires only admin/super_admin.

Read: packages/api/src/applications/applications-lifecycle.service.ts (approveWithContract, activate, submitSignedContractOps), packages/api/src/payments/payments.service.ts (recordPayment, waiveSchedule), and the ActivityLog usage.

Do exactly this:
1. Enforce that the actor who APPROVES credit on an application cannot be the same actor who ACTIVATES it, and cannot be the same actor who records/waives its payments. Determine the prior actor from the activity log / stored actor fields; throw ForbiddenException('separation_of_duties') on violation.
2. Require dual control for waive/write-off: a waive must be requested by one authorized actor and confirmed by a different one before it takes effect (add a pending-waive state or a second-approver field). Record both actor IDs.
3. Make these rules configurable per company/threshold if trivial; otherwise apply globally with a clear constant.

Do not weaken existing role checks — this is additive.

Acceptance: the same user cannot approve-then-activate the same application or approve-then-pay it; a waive requires two distinct authorized actors. Unit tests cover each violation. typecheck + existing specs pass.
```

## P2-E — KYC verification + AML/sanctions screening gate; delete the dead Supabase tree; write missing docs

```
Three hardening tasks in the Blox monorepo. Do them as separate commits.

Commit 1 — compliance gate: KYC is currently presence-only (four document categories uploaded) with no identity verification and NO AML/sanctions/PEP screening. Add an approval gate: a `ComplianceCheck` step that must pass before an application can be approved. Integrate a provider behind an interface (leave the provider HTTP call as a clearly-marked, injectable stub that throws NotImplemented — do not fake a pass) for (a) identity verification of the QID and (b) sanctions/PEP screening of the applicant name. Store the result and the verifier identity; block approveWithContract until a passing ComplianceCheck exists. Read packages/api/src/applications/application-documents.ts and applications-lifecycle.service.ts first.

Commit 2 — delete drift: the packages/** source no longer references the legacy /supabase folder (grep to confirm), but it contains a full parallel schema + RLS that contradicts the Prisma schema, and 04_TECH_ARCHITECTURE.md still names the Supabase flow as canonical. Move /supabase to /attic/supabase with a README tombstone explaining it's dead, and update blox-production/docs/drivemarket/04_TECH_ARCHITECTURE.md to describe the actual Prisma migration flow.

Commit 3 — fill the empty docs: docs/UI_TERMINOLOGY.md and packages/api/.env.example are 0-byte stubs. Write UI_TERMINOLOGY.md as a real glossary reconciling the customer vocabulary ("ownership plan / stake / contribution") with the ops vocabulary ("financing / application / installment / down payment"). Populate .env.example with every env var the API reads (derive the list from config.get/process.env usage across packages/api/src) with safe placeholder values and comments on which are required.

Acceptance: approval is blocked without a passing ComplianceCheck (stub throws until a provider is wired); /supabase is gone from the active tree; 04_TECH_ARCHITECTURE.md matches reality; the two stub files have real content. typecheck passes.
```

## P2-F — Pagination on all list endpoints, hot-path indexes, and real ops pagination UI

```
You are fixing scalability issues in a NestJS + Prisma API and its React ops apps. Several API list endpoints return entire tables (unbounded findMany): applications listMine/opsQueue/dealerLeads, quotes listForDealer, products listDealerInventory (with ALL images eager-loaded), users, companies, offers. And the shared ops table (packages/shared/src/components/ops-ui.tsx OpsDataTable) has Prev/Next buttons with NO onClick — dead pagination — so ops lists silently cap at 100 rows and finance stat cards are wrong.

Do exactly this:
1. Add take/skip (or cursor) pagination with a capped page size and a total count to every unbounded list endpoint named above, matching the pattern already used correctly by products.listPublished and payments.listSchedules.
2. Add the missing hot-path indexes via a Prisma migration (--create-only, show SQL): payment_schedules(status, dueDate) for the overdue sweep; a partial index on notifications(userId) WHERE readAt IS NULL for the unread badge. Do not remove existing indexes.
3. Wire real pagination into OpsDataTable (Prev/Next onClick driving the query's page state) and pass the pagination prop from the finance/admin/credit/dealer callers; make finance stat cards compute over the full dataset (server-provided totals), not just the loaded page. Remove the dead pagination block if you replace it.

Acceptance: no list endpoint returns an unbounded result; ops tables paginate for real past 100 rows; finance totals are correct; migration adds the two indexes. typecheck + specs pass.
```

---

# PHASE 3 — Scale & optimization (lower priority)

```
Do these as small independent commits in the Blox monorepo; each is low-risk cleanup or enhancement. Pick them up one at a time.

1. Drop MUI: all six apps import @mui/material + two emotion packages solely for ThemeProvider/CssBaseline. Replace with the existing SCSS reset and remove the dependencies from every package.json. Verify each app still renders.

2. Consolidate duplication: statusVariant() is reimplemented ~6 times with diverging mappings while packages/shared/src/config/status-styles.ts already exists and is used by nobody. Make all apps import the shared one; align status labels. Extract the copy-pasted per-app main.tsx bootstrap into a shared helper.

3. Fail-fast config: packages/shared/src/lib/api.ts falls back to http://localhost:3010 when VITE_API_URL is unset — in a prod build this silently talks to localhost. Make prod builds throw at startup when VITE_API_URL is missing.

4. Privileged-account hardening: add MFA (TOTP), logout-all-devices, and account lockout after N failed attempts for admin/super_admin/credit/finance roles, using Better Auth's capabilities. Reduce or document the 5-minute cookieCache staleness window.

5. Product analytics: add a lightweight event taxonomy (signup_started/completed, application_started/submitted, document_uploaded, approval, rejection, payment_started/completed) emitted from the frontends and/or API to an analytics sink behind an interface. Keep it privacy-safe (no raw PII in event payloads).

6. Correct ownership/tokenization basis: packages/shared/src/lib/ownership.ts computes fractional ownership in floats and equates installment amount with equity (mixing principal + profit). Rework it to derive ownership strictly from a Decimal principal ledger (the PaymentEvent ledger), so displayed ownership reconciles to cash collected — the honest basis for future tokenization.

7. Real contract: contract-pdf.ts names a "(placeholder)" lender and omits the amortization schedule and APR/total-cost-of-credit. Replace with a real template including full disclosures and the schedule, and hash-lock the generated PDF so the signed upload can be verified against the original.

Acceptance per item: the specific change is made, typecheck passes, and the affected apps/API still build and run.
```

---

## Working tips for Composer on this repo

- After each prompt, run `npm run typecheck` and (for API changes) `npm -w @drivemarket/api test`, and paste any failures back to Composer in the same thread before accepting.
- For any prompt that creates a Prisma migration: insist on `--create-only` and review the SQL. **Never** let Composer run `migrate deploy`, `db push`, or point Prisma at a production `DATABASE_URL`.
- If Composer tries to fix several concerns at once, stop it and re-scope to the single prompt.
- Keep the P0 order: the ledger (P0-C) and the `assertCompanyScope` helper (P0-B) are dependencies for later prompts (P1-A, P2-D, P3-6).
```

