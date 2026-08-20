# Blox / DriveMarket — Cursor Composer 2.5 Fix Prompts (Rev 3)

Fixes for `Blox_Production_Readiness_Audit_Rev3.md`. There are **no open P0s** — this round is the three **launch dependencies** (they gate real customers), then confidence/hardening, then polish.

**How to use:** one prompt at a time, in order. Each names exact files and ends with **Acceptance**. After each backend prompt run `npm -w @drivemarket/api test` and, where noted, `npm -w @drivemarket/api run test:integration`; paste failures back before accepting.

> ⚠️ **Guardrails (unchanged):** schema changes go through `npx prisma migrate dev --create-only` with the SQL reviewed first — never `migrate deploy`/`db push` against a real DB. Never overwrite an active file with a `.wip`. Keep one concern per prompt.

---

# PHASE 1 — Launch dependencies (block real customers)

## R1 — Wire the SkipCash payment gateway (create → hosted redirect → verified webhook)

```
You are integrating a real payment gateway into a NestJS + Prisma fintech API. Today online self-pay is fail-closed but inert: the returned redirect_url is just the marketplace return URL, `verifyAndComplete` throws NotImplemented, and `completeSkipCashPayment` 403s outside sandbox. Keep the fail-closed posture — never mark a payment complete without server-side verification.

Read fully: packages/api/src/payments/payments.service.ts (createSkipCashPayment ~460-500, verifyAndComplete ~503, completeSkipCashPayment ~512, sandboxCompleteSkipCashPayment, lockScheduleForUpdate, the PaymentEvent ledger writes), payments.controller.ts, and packages/api/prisma/schema.prisma (PaymentTransaction).

Implement against the SkipCash API (I will provide SKIPCASH_KEY / SKIPCASH_SECRET / SKIPCASH_BASE_URL / SKIPCASH_WEBHOOK_SECRET via env — add them to .env.example with comments; do NOT hardcode). Leave the exact SkipCash request/response field mapping in a clearly-marked adapter module (packages/api/src/payments/skipcash/skipcash-client.ts) so the HTTP shape is isolated and swappable.

Do exactly this:
1. createSkipCashPayment: call the SkipCash create-invoice/payment endpoint, persist the gateway payment id on the pending PaymentTransaction, and return the REAL hosted-payment redirect URL from SkipCash (not the local return URL).
2. Add a webhook endpoint `POST /api/payments/skipcash/webhook` (@Public, but verified): read the raw body, verify the SkipCash HMAC signature against SKIPCASH_WEBHOOK_SECRET (constant-time compare), reject on mismatch (401). On a verified "paid" event, call verifyAndComplete.
3. verifyAndComplete(gatewayPaymentId): do a server-to-server status lookup against SkipCash to confirm the payment is actually settled and the amount/currency match the transaction; only then, inside ONE $transaction with the schedule row-locked, mark the PaymentTransaction completed (guarded updateMany on status='pending') and write the installment PaymentEvent — reuse the existing ledger/lock helpers. Idempotent: a duplicate webhook for an already-completed txn is a no-op returning 200.
4. Keep completeSkipCashPayment's client-return path as sandbox-only (unchanged 403 in prod). The client return URL is just for UX ("payment processing…") — settlement happens via the webhook, never the client.
5. Add unit + integration tests: webhook with a bad signature is rejected; a valid webhook for a settled payment records exactly one PaymentEvent and completes the txn; a duplicate webhook is a no-op; verifyAndComplete refuses when the gateway reports unpaid or an amount mismatch.

Acceptance: online payment completes ONLY via a signature-verified webhook backed by a server-side status check; amounts reconcile to the ledger; duplicates are idempotent; bad signatures 401; sandbox behavior unchanged. typecheck + tests pass.
```

## R2 — Real KYC/AML compliance provider interface + prod boot health-check

```
You are wiring a real KYC/AML provider behind an existing fail-closed compliance gate in a NestJS API, and adding a boot guard so a stub can never silently ship as production-ready.

Read: packages/api/src/compliance/ (compliance.service.ts, compliance-gate.ts, compliance-provider.stub.ts, compliance-provider.resolve.ts, compliance.module.ts) and how approveWithContract + direct-activate call `assertPassedForApproval`.

Do exactly this:
1. Keep the `ComplianceProvider` interface. Implement a real provider (packages/api/src/compliance/providers/<vendor>.provider.ts) that calls the vendor for (a) identity verification of the QID and (b) sanctions/PEP screening of the applicant name, mapping the result to the existing ComplianceCheck pass/fail/pending model. Put vendor creds in env (.env.example, commented); leave the exact HTTP mapping isolated in the provider file. If no vendor is chosen yet, keep the stub but make step 2 mandatory.
2. Add a PROD BOOT HEALTH-CHECK: at startup (onModuleInit or a health indicator), if NODE_ENV=production and the resolved compliance provider is the stub, FAIL FAST (throw) — or, if you prefer degraded-but-loud, refuse approvals and surface a critical `/health/ready` failure with a clear message. Do the same check for the payment gateway (if SKIPCASH creds are unset in prod). The goal: production cannot boot "green" while a money/PII path is a stub.
3. Add a test that prod + stub provider fails the boot/readiness check, and dev + stub still runs.

Acceptance: a real provider can be selected via config; production refuses to run (or refuses approvals with a loud readiness failure) when compliance or gateway is still a stub; dev is unaffected. typecheck + tests pass.
```

## R3 — Replace DRAFT contract disclosures + block generation while uncertified

```
Every generated contract PDF currently embeds uncertified legal text literally beginning "DRAFT — PENDING COUNSEL CERTIFICATION. Do not use in production." This must not reach a real customer contract.

Read: packages/api/src/applications/contract-disclosures.ts and where it's rendered in contract-pdf.ts (~257).

Do exactly this:
1. Replace the disclosure content with the counsel-certified Qatar consumer-credit text I will provide (leave a clearly-marked constant/section for it; if the certified text isn't ready, keep a placeholder but implement step 2). Structure it as versioned disclosure text (a `DISCLOSURE_VERSION` constant) so future legal revisions are traceable, and stamp the version into the contract metadata.
2. Add a guard: if the disclosure text still contains the "DRAFT" / "PENDING COUNSEL" marker AND NODE_ENV=production, refuse to generate a contract (throw a clear error) — so a draft disclosure can never be issued in prod.
3. Add a test: contract generation throws in prod while the DRAFT marker is present, and succeeds once it's removed.

Acceptance: contracts carry versioned, non-DRAFT disclosures; prod generation is blocked while the DRAFT marker remains; the disclosure version is recorded on the contract. typecheck + tests pass.
```

---

# PHASE 2 — Confidence & hardening

## R5 — Playwright E2E suite for the critical journeys

```
The six React apps have zero component/E2E tests, so none of the frontend fixes from the last three rounds are regression-locked. Add a Playwright E2E suite.

Set up Playwright at the repo root (playwright.config.ts) targeting the marketplace + the ops apps against a locally-run stack (API + seeded DB). Use the existing seed/test-database setup the integration tests use where possible.

Write E2E specs for the critical journeys:
1. Register → email-verification prompt → login; password recovery (forgot → reset).
2. Customer: browse → apply → upload KYC docs → submit; and the one-active-application block (409) surfaces correctly.
3. Session expiry: a 401 mid-flow redirects to login with returnUrl and a "session expired" message (locks the 401-latch fix).
4. Pay-online button: disabled while pending, fires exactly one request (locks the double-submit fix).
5. ErrorBoundary: a forced render error shows the fallback, not a white screen.
6. Credit officer: review screen shows underwriting data; reject requires a reason; approve/activate happy path.
7. Cross-app auth: an officer of Company A cannot see Company B's queue items (UI-level check complementing the API integration test).

Wire Playwright into .github/workflows/ci.yml as a job (headless, with the stack started in CI).

Acceptance: `npx playwright test` runs the suite locally and in CI; the pay-double-submit, 401-latch, and ErrorBoundary specs fail if those fixes are reverted. typecheck passes.
```

## R6 — Loading vs empty-state in ops tables

```
Ops list tables flash the empty-state message ("No applications", "No quotes") during the initial fetch because OpsDataTable renders `empty` whenever rows.length===0 with no loading awareness.

Read: packages/shared/src/components/ops-ui.tsx (OpsDataTable ~134-135) and note packages/dealer/src/main.tsx CompanyPage already threads isLoading correctly (use as the pattern).

Add an optional `isLoading` prop to OpsDataTable: when true and rows are empty, render a skeleton/spinner instead of the empty state. Then pass `isLoading`/`isPending` from every caller: admin ApplicationsPage/LedgersPage/EntityListPages/ProductsPage, dealer InventoryList/Applications/QuotesPage, finance and credit queues.

Acceptance: on a slow network the tables show a loading state first, then data or a true empty state — the empty message no longer flashes during fetch. typecheck passes.
```

## R7 — Finish ops i18n + replace raw enum labels

```
Several ops screens are still hardcoded English and some render raw snake_case enum values. Read packages/shared/src/i18n (existing keys + useOpsLabels/useTranslation) and the status-label helpers already used elsewhere (applicationStatus/listingStatus/scheduleStatus label maps).

Do exactly this:
1. Localize the remaining hardcoded screens via `t()` / `useOpsLabels`: dealer InventoryEditor + QuotesPage (packages/dealer/src/main.tsx), admin ProductsPage/EntityListPages(Offers)/LedgersPage, and finance confirm dialogs + payment-method/ledger-status `<option>` labels. Add the missing keys to both en and ar locales.
2. Replace raw enum labels shown to users (e.g. ProductsPage `p.listing_status`, LedgersPage `effective_status`, dealer CompanyPage `data.status`, finance payment-method options) with the existing label helpers.

Acceptance: those screens render Arabic when locale=ar; no raw snake_case enum text is shown to users. typecheck passes.
```

## R4 — Strengthen signed-contract verification beyond PDF metadata

```
Signed-contract verification currently trusts only PDF metadata (Subject/Keywords) for the fingerprint, so a customer could alter visible amounts in the PDF body while keeping metadata intact. The server's source of truth for terms is the pricing snapshot (so financial terms aren't taken from the upload), but the archived "signed" document could mismatch the generated one.

Read: packages/api/src/applications/contract-pdf.ts (verifySignedContractReferencesOriginal ~100-119, and how the generated PDF's canonical terms are produced).

Strengthen verification to bind the visible content, not just metadata. Preferred: re-extract the canonical terms text from the uploaded PDF and hash it against the generated fingerprint; OR overlay/append a server-rendered terms page to the generated PDF and verify that page survives in the upload. Reject on mismatch with a clear error. Keep the existing metadata check as an additional signal.

Acceptance: an upload whose visible terms differ from the generated contract is rejected; a genuine signed copy passes; add a test covering both. typecheck passes.
```

## R8 + R9 — Align down-payment actor table; delete stray schema.wip

```
Two small correctness/hygiene fixes in the NestJS API. Separate commits.

1. `recordDownPayment` (packages/api/src/applications/applications-lifecycle.service.ts ~382) allows finance_officer and calls transitionApplication directly, but the declared edge down_payment_required→down_payment_submitted lists actors ['credit','admin'] (application-transitions.ts ~28). Align them: either add 'finance' to that edge's actors, or route recordDownPayment through assertOpsTransitionAllowed so one authority governs. (Recording a down payment is a legitimate finance action, so adding 'finance' to the edge is the likely intent — confirm against the actor table's conventions.)

2. Delete the stale packages/api/prisma/schema.prisma.wip — it's an older duplicate schema (missing 2FA/lockout/separation-of-duties/pendingWaive fields) that Prisma ignores but that invites drift.

Acceptance: the down-payment edge and the endpoint agree on allowed actors; schema.prisma.wip is gone; typecheck + tests pass.
```

---

# PHASE 3 — Polish

```
Low-priority items; pick up as time allows. Separate commits.

1. Client-side reason validation: disable Reject/resubmission buttons until a non-empty reason is entered (admin ApplicationsPage ~126-136, credit main.tsx ~408-414) — the server already enforces it; this just avoids a wasted round-trip and confusing error.

2. System-user hardening: the seeded `id='system'` user is an active super_admin with no credential (can't authenticate today). Add an explicit guard that id='system' can never hold an account/credential row, or give it a dedicated non-privileged system role. (packages/api/src/common/ensure-system-user.ts + auth.)

3. Reconciliation report: add an ops report that reconciles gateway/bank settlement against the PaymentEvent ledger (flag mismatches) — the next fintech-maturity step once the gateway (R1) is live.

4. Unify the listing-card monthly estimate with @drivemarket/shared/pricing (products.service.ts estimateMonthlyFromOffer) so cards can't disagree with detail/contract figures; and cap any remaining unbounded reference-data list queries.

Acceptance per item: the change is made, the affected app/API builds, typecheck passes.
```

---

## Reminders for Composer
- Fail-closed is a feature: never let R1/R2/R3 introduce a path that fakes a payment, a compliance pass, or issues a DRAFT contract in prod.
- Schema changes: `prisma migrate dev --create-only`, review SQL, never touch a real DB.
- Run unit + integration tests after each backend prompt; add the test each prompt asks for — the last three rounds shipped bugs precisely where tests were missing.
- One concern per prompt; if Composer sprawls, stop and re-scope.
```

