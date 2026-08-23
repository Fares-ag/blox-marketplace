# Blox / DriveMarket — Cursor Composer Prompts (Offline-First)

Direction change: the **online payment gateway is deferred**. Launch is **offline payments only** — cash, cheque, card-POS, bank transfer, recorded by finance officers. This file covers: the two confirmed new fixes (open redirect + deps, build hygiene), cleanly disabling the gateway, and the offline-payment hardening the new direction requires — the most important being **cheque clearance** (a cheque isn't settled until it clears).

**How to use:** one prompt at a time, in order. Each ends with **Acceptance**. Run `npm -w @drivemarket/api test` + `npm -w @drivemarket/api run test:integration` after each backend prompt. Schema changes: `npx prisma migrate dev --create-only`, review SQL, never `migrate deploy`/`db push` on a real DB.

---

# PHASE A — Confirmed new fixes (do first; small)

## A1 — Fix the open redirect in the auth returnUrl flow + patch dependencies (SECURITY)

```
You are fixing an open-redirect vulnerability in a React (react-router) auth flow and patching the dependency that makes it exploitable.

Problem: LoginPage.tsx (packages/shared/src/auth/LoginPage.tsx lines ~70, ~188, ~503) and MfaPages.tsx (~86, ~176, ~200) take `returnUrl` from the query string and pass `decodeURIComponent(returnUrl)` straight to `navigate()` / `<Navigate to=...>` with NO validation that it's a same-origin relative path. An attacker can send `…/auth/login?returnUrl=https://evil.com` (or `returnUrl=/\evil.com` to dodge naive checks) and redirect the user off-site after login — credential phishing. The installed react-router version also has CVE-2025-68470 (backslash open-redirect bypass).

Do exactly this:
1. Add a `safeReturnPath(raw: string | null, fallback: string): string` helper in packages/shared/src/lib (with a unit test). It returns `fallback` unless the decoded value is a same-origin RELATIVE path: must start with a single `/`, must NOT start with `//` or `/\`, must not contain a scheme or `:` before the first `/`, and must not contain control chars/newlines. Prefer parsing with `new URL(value, window.location.origin)` and confirming the resolved origin equals `window.location.origin`.
2. Replace every raw `returnUrl` consumption in LoginPage.tsx and MfaPages.tsx with `safeReturnPath(returnUrl, homePath)`. Also sanitize the returnUrl that is re-embedded into the two-factor redirect (LoginPage ~65) so a hostile value can't be forwarded.
3. Update react-router + react-router-dom to the patched version (>= the version that fixes GHSA-wrjc-x8rr-h8h6 and GHSA-337j-9hxr-rhxg) across all workspaces, and run `npm audit fix` to clear the nanoid (GHSA-2v37-7h3g-55p8) and prisma/deepmerge-ts (GHSA-ggr8-5vv4-36mx) advisories. Keep versions consistent across packages.
4. Add tests: `safeReturnPath` rejects `https://evil.com`, `//evil.com`, `/\evil.com`, `javascript:...`, and accepts `/app/dashboard`.

Acceptance: post-login/2FA navigation can only go to a same-origin relative path; `npm audit` reports 0 known vulnerabilities (or only unfixable dev-only advisories, documented); typecheck + tests pass.
```

## A2 — Pricing→CJS build hygiene (prevent code≠deployed drift)

```
The shared pricing package is consumed by the frontend as ESM source (`./src/lib/pricing.ts`) and by the API at runtime as compiled CommonJS (`./dist/lib/pricing.cjs`, built via `npm run build:pricing`). Production (Docker) regenerates the .cjs, but CI does not build or exercise it, and there is no prebuild hook — so a dev/API build without `build:pricing` hits a missing artifact, and CI tests the .ts while prod runs the .cjs (a compilation discrepancy could ship untested).

Read: packages/shared/package.json (exports map + build:pricing script), packages/api/Dockerfile, .github/workflows/ci.yml, packages/api/package.json.

Do exactly this:
1. Make the artifact regenerate automatically: add a `prebuild` (and ideally `pretest`) hook on @drivemarket/shared that runs `build:pricing`, OR make the API build depend on it, so `dist/lib/pricing.cjs` always exists and is fresh wherever the API is built or tested.
2. Run `build:pricing` in CI before the API build/test steps.
3. Add one contract test that imports the COMPILED `@drivemarket/shared/pricing` via the `require`/CJS path and asserts it produces identical output to the source for a grid of inputs (guards against a TS→CJS discrepancy). Keep `dist/` gitignored (do not commit the artifact).

Acceptance: a clean checkout can build/test the API without manually running build:pricing; CI exercises the compiled .cjs; the CJS-vs-source contract test passes; dist/ is not committed. typecheck passes.
```

---

# PHASE B — Go offline-first

## B1 — Cleanly disable the online payment gateway (don't show a dead button)

```
The online SkipCash gateway is being deferred; launch is offline-payments only. Right now the customer marketplace still shows a "Pay online" path and the API still exposes SkipCash endpoints (which correctly 403 outside sandbox, but shouldn't be reachable at all in an offline-only launch). Disable it cleanly behind a flag WITHOUT deleting the code (it returns later).

Read: packages/api/src/payments/payments.controller.ts + payments.service.ts (the skipcash create/complete endpoints), and packages/marketplace/src/components/ApplicationDetailPanel.tsx (the pay-online UI).

Do exactly this:
1. Add a config flag `PAYMENTS_ONLINE_ENABLED` (default FALSE). Add to .env.example with a comment.
2. When false: the SkipCash create/complete/(webhook, if present) endpoints return 404 (not reachable), and the marketplace does NOT render any "Pay online" button — instead show a short, localized message telling the customer how to pay offline (e.g. "Payments are made in person by cash, cheque, or card at <dealer/branch>. Your finance officer will record each payment."). Keep the customer's schedule view (amounts, due dates, status) fully visible.
3. Leave all gateway code intact behind the flag so it can be re-enabled later.

Acceptance: with PAYMENTS_ONLINE_ENABLED=false, no online-pay button appears, the SkipCash endpoints 404, and customers see clear offline-payment guidance + their schedule. typecheck + tests pass.
```

## B2 — Structured offline payment methods + cheque clearance lifecycle (FINANCIAL INTEGRITY)

```
You are hardening the offline payment path in a NestJS + Prisma fintech ledger. Today `recordPayment` (packages/api/src/payments/payments.service.ts) takes a free-text `{ method, reference }` and marks the installment PAID IMMEDIATELY. That is correct for cash/card-POS, but WRONG for cheques: a cheque is not settled until it clears and can bounce. Model this properly.

Read: payments.service.ts (recordPayment, applyPaymentInTransaction, the PaymentEvent ledger, computeScheduleAmountsFromEvents, lockScheduleForUpdate), prisma/schema.prisma (ScheduleStatus, PaymentEventType, PaymentSchedule fields paymentMethod/paymentReference, PaymentEvent). Read the existing waive/down-payment patterns to match style.

Do exactly this:
1. Add a `PaymentMethod` enum: cash, cheque, card_pos, bank_transfer. Record it (not free text) on each payment. Capture method-specific fields: cheque → cheque number, bank name, cheque date; card_pos → terminal/auth reference; bank_transfer → transfer reference. Validate the required fields per method in the DTO.
2. Settlement semantics:
   - cash / card_pos / bank_transfer: settle immediately (current behavior) — write the `installment` PaymentEvent and settle the schedule.
   - cheque: record as PENDING CLEARANCE — the schedule is NOT settled yet. Represent this with a new schedule state (e.g. add `pending_clearance` to ScheduleStatus, or a separate `ChequePayment` record with status received|cleared|bounced) — choose the cleaner model and keep the `paid + remaining = amount` invariant intact (a pending cheque does NOT reduce remaining until it clears).
3. Add cheque lifecycle actions (finance role, company-scoped, with separation-of-duties like waive): `clearCheque` → writes the `installment` PaymentEvent and settles the schedule; `bounceCheque` → writes a `reversal`/no-settlement outcome, returns the schedule to pending/overdue, records the bounce reason, and optionally assesses a configurable bounce fee (as its own schedule/charge — leave the fee amount configurable, default 0). A bounced cheque must never leave the installment counted as paid.
4. Ledger correctness: only cleared cheques (and instant methods) count toward paid; reuse computeScheduleAmountsFromEvents. Application `completed` must only fire when all installments are truly settled (no pending-clearance cheques outstanding).
5. Add a scheduled job (reuse the existing @nestjs/schedule jobs service) that flags cheques pending clearance beyond N days for finance follow-up.
6. Tests (unit + integration): cash settles immediately; cheque record → schedule pending_clearance, remaining unchanged; clearCheque → settled, invariant holds; bounceCheque → schedule back to pending/overdue, installment NOT counted as paid, reversal recorded; application does not complete while a cheque is pending clearance.

Acceptance: cheques are only counted as paid after clearance; a bounced cheque cleanly un-settles the installment; instant methods unchanged; the paid+remaining invariant holds in every state; tests cover clear + bounce + instant. typecheck passes.
```

## B3 — Offline payment receipts

```
Customers who pay offline (cash/cheque/card-POS) need a receipt. Add receipt generation for settled offline payments.

Read: packages/api/src/applications/contract-pdf.ts (existing pdf-lib usage as the pattern), payments.service.ts (where a payment settles / a schedule becomes paid), notifications + mail services.

Do exactly this:
1. On a payment SETTLING (instant method, or cheque clearance), generate a receipt (PDF via pdf-lib) containing: receipt number, date, customer, application/vehicle, installment sequence, amount paid, method + reference, running balance (paid-to-date / remaining), and the recording officer. Store it (S3/storage) and link it to the PaymentEvent.
2. Notify the customer (in-app + email via the existing outbox) with a link to the receipt.
3. A cheque generates a receipt only on CLEARANCE (not on receipt-of-cheque) — before that, send an acknowledgement ("cheque received, pending clearance"), not a paid receipt.
4. Make receipts downloadable by the customer (scoped) and by finance/ops (company-scoped).

Acceptance: every settled offline payment produces a downloadable receipt with correct balance + method; cheques get an acknowledgement on receipt and a receipt only on clearance; customer is notified. typecheck + tests pass.
```

## B4 — Offline payment reconciliation report

```
Add an ops reconciliation view so finance can tie recorded offline payments to actual bank deposits — the offline analog of gateway settlement.

Read: the ops controller/report patterns (packages/api/src/ops/*), payments.service.ts, the PaymentEvent ledger.

Do exactly this:
1. Add an ops report (finance/admin, company-scoped) listing settled payments over a date range, grouped by method (cash / cheque / card_pos / bank_transfer), with totals per method and per day, each row showing amount, reference, officer, and (for cheques) clearance date. Include a "cheques pending clearance" section with aging (days outstanding).
2. Add a CSV export.
3. Add an optional `bankDepositReference` / `reconciledAt` you can stamp on a payment (or a batch) to mark it matched to a bank deposit, and surface unreconciled settled payments so nothing is silently unaccounted.

Acceptance: finance can produce a per-method, per-day reconciliation with pending-cheque aging and CSV export, company-scoped; payments can be marked reconciled to a bank deposit. typecheck + tests pass.
```

---

## What this does to the roadmap

Deferring the gateway **removes the single biggest launch dependency**. The remaining launch blockers become:
1. **KYC/AML provider** (still the stub — Rev 3 R2) + the prod stub-guard.
2. **Counsel-certified contract disclosures** (still DRAFT — Rev 3 R3).
3. **Offline-payment hardening** — B1–B4 above (cheque clearance is the financial-integrity must-fix).
Plus the Rev 3 confidence items (Playwright E2E) and the polish tail.

The Playwright suite (Rev 3 R5) should now cover the **offline payment recording + cheque clearance/bounce** flows instead of the online-pay flow.

## Reminders
- A cheque is not money until it clears — never let a recorded (uncleared) cheque count toward paid or complete an application.
- Keep fail-closed: the gateway stays off behind the flag; don't show customers a payment path that doesn't exist.
- Add the test each prompt asks for — the prior rounds shipped bugs exactly where tests were missing.
```

