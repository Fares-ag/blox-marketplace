# Blox / DriveMarket — Production-Readiness Audit

**Product:** DriveMarket (internal brand "Blox") — hybrid vehicle-financing marketplace for Qatar (QAR)
**Audit date:** 19 August 2026
**Auditor role:** Principal Architect / CTO / Security / QA / UX / SRE / Fintech Systems (combined)
**Scope:** Full source tree (`packages/api`, six React apps, `packages/shared`), Prisma schema + migrations, legacy `supabase/` folder, deploy configs (Railway, Vercel, Docker), and all design/spec docs (`blox-production/docs/drivemarket/00–12`).
**Method:** Static inspection of the entire codebase by five parallel specialist reviews (security/authz, database/integrity, fintech/money, frontend/UX, DevOps/QA). Every finding is tagged **VERIFIED** (code path read) or **UNVERIFIED**. Runtime/production database was not reachable, so live data-state and infra claims are marked accordingly.

> **A note on what could and could not be verified.** The production Postgres runs on Railway and was not accessible during the audit, so database *state* (row counts, live RLS, actual backups) is inferred from schema and migrations, not observed. The only live database reachable via connectors on this account is an unrelated property-management project; it is **not** part of Blox and is excluded. Everything else was read directly from source.

---

## 1. Executive Summary

DriveMarket is a **well-architected early-stage product with genuinely good bones and one disqualifying flaw.** The domain modeling is thoughtful, authorization is centralized and mostly correct, pricing is server-authoritative (customers cannot shop for cheaper terms), and the codebase is honest about its own gaps (dead/mocked screens were removed with explanatory comments rather than left to deceive). This is meaningfully better than the typical "looks done, isn't" MVP.

But it is **not production-ready**, and it must not handle real money in its current state. The single most important reason:

> **A public, unauthenticated endpoint marks loan installments as fully paid using a key that the system hands to the customer, with zero verification that any money moved.** A customer can settle an entire financing plan — down payment through final installment — without paying a riyal. (Findings SEC-1 / FIN-1 / DB-1 / OPS-3, all independently VERIFIED.)

Around that headline sit a coherent cluster of issues that share root causes: officer authorization is enforced on *list* views but not on *per-record* operations (cross-tenant IDOR across applications, KYC documents, and payment schedules); every financial state transition is a read-then-write with no row lock or conditional guard (lost-update and double-approve races); there is **no ledger** (mutable `paidAmount` is the only record of truth, and financial rows can cascade-delete); money math runs in JavaScript floats and installments don't sum to the financed total; and operationally there is **no CI, no error tracking, no alerting, fake lint, manual-only deploys, and silent-failure email** — if it broke at 2 a.m., no one would know.

**What's genuinely good:** server-authoritative pricing with anti-spoofing tests; a clean per-edge state-machine with actor gating; strong auth-secret validation that fails closed at boot; correct cookie-session handling (no tokens in localStorage); live suspension enforcement; a real (if not immutable) audit log; a thorough manual QA smoke script; and unusually complete deploy docs. Arabic/RTL is real in the customer app, not vaporware.

**Verdict: Early product (functional prototype of the financing spine).** The happy path works end-to-end and the design is sound, but payment integrity, tenant isolation on write paths, concurrency safety, and operational visibility are not yet at the level required to serve real customers or real money. With a focused Phase-0 emergency pass (roughly 2–4 weeks) the disqualifying issues are fixable — none require rearchitecting; the foundations are correct.

**Overall Production-Readiness Score: 3.6 / 10** (Early product — see §16 for the full 20-category scorecard).

---

## 2. Architecture Overview (plain English)

DriveMarket lets a customer in Qatar browse vehicles, apply to finance one over monthly installments, get underwritten by a credit officer, sign a contract, and pay it off — with dealers listing inventory and issuing negotiated-price quotes, and finance officers servicing payments. Docs describe a future "tokenization / fractional-share" model (owning a growing % of the car as you pay), but today that is a **display-only estimate**, not a real ledger.

**The system is a TypeScript monorepo with three tiers:**

- **Backend:** one NestJS API (`packages/api`) on Railway (Docker), using **Prisma + PostgreSQL** for data and **Better Auth** (email/password, cookie sessions) for identity. S3-compatible storage (MinIO locally, R2/S3 in prod) holds listing images, KYC documents, and contracts. Nodemailer sends email. An optional Zoho CRM integration pushes leads. There is **no message queue, no scheduler, and no background worker.**
- **Frontend:** six separate React 19 + Vite single-page apps — **marketplace** (customer), **dealer**, **credit**, **finance**, **admin**, **super-admin** — deployed on Vercel, sharing a `packages/shared` library (auth store, API client, design tokens, i18n, UI components). State is TanStack Query (server) + Zustand (auth only).
- **Data:** a single Postgres schema (Prisma) with users, companies, products (vehicles), offers (finance terms), applications (the financing case, with a JSON `pricingSnapshot`), payment schedules + transactions, dealer quotes, notifications, and an activity log.

**Roles (6):** `customer`, `dealer_agent`, `credit_officer`, `finance_officer`, `admin`, `super_admin`. Multi-tenancy is by `companyId`; credit/finance officers are additionally scoped ("all" vs "assigned") via join tables (`CreditOfficerCompany`, `FinanceOfficerCompany`).

**The core workflow (confirmed in code):**
`Browse → Apply (server builds pricing) → Upload KYC docs → Submit → Credit review → Approve → Generate contract PDF → Customer signs on paper & uploads → Contract QC → (down payment, offline) → Activate → Payment schedule generated, vehicle marked sold → Pay installments → Completed ("you own your vehicle")`

**Functionality classification:**

| State | Items |
|---|---|
| **Confirmed working** | Auth (login/signup/verify/reset), browse/facets/detail, apply with server-side pricing, KYC upload checklist, submit/resubmit/cancel, credit approve/reject, contract PDF generation, signed-contract upload, activation + schedule generation, manual installment recording, in-app notifications, activity logging, dealer inventory + quotes, ops queues, Zoho lead push |
| **Partially implemented** | Payments (manual marking works; online gateway is **simulated**), notifications (in-app only, gaps in events), admin/dealer/credit UIs (functional but thin — see UX), officer scoping (list-only), Arabic (customer app only) |
| **Planned (schema/docs only)** | Tokenization/fractional shares, email outbox + retry, feature flags, reporting/exports, dunning, refunds/settlements |
| **Missing entirely** | Real payment gateway integration, immutable ledger, KYC identity verification, AML/sanctions screening, background jobs/scheduler, CI/CD, error tracking, backups documentation |
| **Appears implemented but broken/unsafe** | Online payment completion (bypassable — SEC-1), per-record officer authorization (IDOR — SEC-2/3/4), dealer forgot-password (links to non-existent routes), admin "Activate" (swallows errors), `main.ts` port binding (ignores Railway `PORT`), Prisma migration set (drifted — missing `payment_transactions`) |

---

## 3. Critical Findings (all P0 / high-impact P1)

Cross-referenced across the five reviews; IDs unified below.

### P0 — Blockers (must fix before any real money or real customers)

**P0-1 — Payment bypass: public endpoint settles installments with no verification.** `POST /api/payments/skipcash/complete` is `@Public()` and marks a `PaymentTransaction` completed (and records the installment paid, as a synthetic `super_admin`) using an idempotency key the server previously handed the customer in the redirect URL. No gateway signature, no server-to-server verification, no HMAC. The "SkipCash" flow never actually calls SkipCash — the redirect URL is just the marketplace return URL with the key in the query string. *Evidence:* `payments.controller.ts:72-76`, `payments.service.ts:344-349, 364-391`. *Impact:* a customer settles an entire plan without paying. *Fix:* verify against the gateway server-side (or a signed webhook) before marking paid; never trust a client-held key as proof; gate the simulated path behind a `SKIPCASH_SANDBOX` flag that is off in production.

**P0-2 — Cross-tenant IDOR: officer per-record operations ignore company scope.** List endpoints correctly filter by the officer's assigned companies (`opsCompanyFilter`), but per-record handlers (`assertCanView`, `opsTransition`, `approveWithContract`, `activate`, `submitSignedContractOps`, and the payment `recordPayment`/`waiveSchedule`) check only the *role*, never whether `app.companyId` is in the officer's allowed set. *Evidence:* `applications.service.ts:478-489`, `applications-lifecycle.service.ts:215-278, 57/177/280`, `payments.service.ts:110-116, 222-228`. *Impact:* a credit or finance officer scoped to Company A can view, approve, reject, activate, and record/waive payments on Company B's applications by iterating IDs — full cross-tenant control despite the scoping tables existing. *Fix:* a single shared `assertCompanyScope(user, app.companyId)` (reusing `opsCompanyFilter`) applied in every per-record ops handler. This one helper closes the largest cluster of findings.

**P0-3 — Customer PII/KYC documents downloadable by any officer of any company.** `downloadDocument` and `downloadContract` permit every ops role with no scope check; the documents are QID (national ID), salary certificates, bank statements, and signed contracts. *Evidence:* `applications.service.ts:408-421`, lifecycle `downloadContract:132-139`. *Impact:* mass PII exposure across tenants. *Fix:* same scope enforcement as P0-2; audit-log document reads.

**P0-4 — No ledger; financial state is mutable and cascade-deletable.** `paidAmount`/`remainingAmount` are overwritten in place on every payment (prior values lost); the only durable trace of a partial payment is a free-form `ActivityLog` JSON row. There is no immutable double-entry ledger. Worse, `PaymentSchedule` and `PaymentTransaction` FKs to `Application` are `onDelete: Cascade`, so deleting one application row silently destroys its entire repayment history. *Evidence:* `payments.service.ts:146-156`, `schema.prisma:428, 457`. *Impact:* payment history cannot be reliably reconstructed; a single delete (future admin tool, support script, or bug) erases regulated financial records. *Fix:* append-only `payment_events` ledger as source of truth; `onDelete: Restrict` on all financial relations; soft-delete/archival instead of hard delete.

**P0-5 — Concurrency: unguarded read-then-write on every money/status transition.** No transition takes a row lock or uses a conditional update (`update where {id}` only, never `where {id, status}` / `updateMany` with a count check / `SELECT … FOR UPDATE`). Under READ COMMITTED this yields lost updates on `paidAmount` (two concurrent partial payments both read 0, one payment vanishes), double-approve (two officers both generate contracts), two applications reserving the same vehicle, and quote redeem/revoke races. Additionally, SkipCash completion marks the transaction `completed` and *then* records the payment in a **separate** transaction — if recording fails, the txn is permanently "completed" with no schedule update. *Evidence:* `payments.service.ts:117-156, 364-391`, `applications.service.ts:188-208`, `applications-lifecycle.service.ts:104, 238-247`. *Fix:* guarded conditional updates (`updateMany({where:{id, status: expectedFrom}})` + throw on count 0) for every transition; wrap both SkipCash writes in one transaction; do money math in `Prisma.Decimal`.

**P0-6 — Broken/drifted Prisma migrations + migrations run in the container boot command.** The migrations directory is missing `payment_transactions`/`PaymentTransactionStatus` entirely (they exist only in `schema.prisma`), and `0_init` defaults `applications.status` to `under_review` while the schema says `draft`. The Dockerfile runs `npx prisma migrate deploy && node dist/src/main.js` on **every** boot. *Evidence:* `Dockerfile:26-27`, migrations dir vs `schema.prisma:104-108, 448-466, 351`. *Impact:* a fresh deploy builds a DB with no `payment_transactions` table (runtime crash on any payment); an existing db-push'd DB re-runs `0_init`, fails on existing types, and the `&&` prevents the API from starting → **crash loop**. *Fix:* regenerate a true baseline, add the missing migration, standardize on `migrate deploy`, and run migrations as a discrete release step, not the app CMD.

**P0-7 — Live Vercel OIDC deploy token present in the working tree.** `/tmp/blox/.env.local` (and a second in `packages/marketplace/.env.local`) contains a full `VERCEL_OIDC_TOKEN` JWT (project `blox-ops`, team `team_l3FoAZLKwVioXSX0uBL1Shoa`). `.gitignore` covers `.env*` (so ignored going forward), and these tokens are short-lived (~12h, this one already expired), but a real deploy credential is sitting on disk. *Fix:* rotate/revoke in Vercel, confirm it was never committed (`git log --all -- .env.local`), and stop keeping it in shared trees. Also rotate the committed-pattern `packages/api/.env` secret if it was ever real.

**P0-8 — No CI/CD, no error tracking, no alerting.** There is no pipeline anywhere (no `.github`, etc.); deploys are manual CLI; lint is a fake `echo` in every package; there is no Sentry, no structured logging, no correlation IDs, no uptime monitor, and the health check returns a static `{ok:true}` without touching the DB. *Impact:* nothing gates a broken build or bad migration; a 2 a.m. outage (DB down, payment endpoint erroring, migration hang) produces no alert and no traceable logs; MTTR is "until a customer complains." *Fix:* GitHub Actions (typecheck → real ESLint → vitest → build, block-on-red) + release-gated deploy; Sentry on API and frontends; a request-logging interceptor with request IDs; a deep readiness probe; an uptime monitor with an alert channel.

### P1 — Critical (fix immediately after P0)

- **P1-1 Down payment is never recorded as money and not enforced before activation.** `down_payment_required/_submitted` are pure status flips with no amount; the `contract_under_review → pending_finance_activation` edge bypasses down-payment states entirely. An application can go active with zero down payment received and no record it was expected. (`application-transitions.ts:21,27-31`, `applications-lifecycle.service.ts:299-308`.)
- **P1-2 Client 401/session-expiry is unhandled and the default query retry hammers dead sessions.** No global 401 handler; TanStack Query default `retry:3` (no QueryClient config) fires 3 pointless retries then shows raw errors or silent empty pages — including mid-payment. (`shared/src/lib/api.ts`.)
- **P1-3 Dealer app links to forgot/reset-password routes that don't exist** → dealers can never reset a password (link loops back to login). (`dealer/src/main.tsx` vs `LoginPage.tsx:116`.)
- **P1-4 Admin "Activate" mutation swallows all errors and has no pending state** → a failed activation of a financing plan looks like success; double-click fires twice. (`admin/pages/ApplicationsPage.tsx:96-101`.)
- **P1-5 Credit review screen never renders the underwriting data** (`customerSnapshot` income/employment/QID and `pricingSnapshot` are fetched but not displayed) → officers approve/reject blind, opening raw KYC files to underwrite. (`credit/src/main.tsx:105-286`.)
- **P1-6 Email is fire-and-forget with silent failure; prod can boot with no mail transport.** `send()` catches SMTP errors and returns void; password-reset/verification/invite can silently drop while the API reports success. The boot assertion only guards the verification case. (`mail.service.ts:47-79`.) No `email_outbox`/retry.
- **P1-7 `main.ts` ignores Railway's injected `PORT`** (binds `API_PORT ?? 3000`) despite a tested `resolveApiPort()` helper that does the right thing — fragile healthcheck/restart-loop risk. (`main.ts:54` vs `auth-config.ts:58`.)
- **P1-8 No DB-level integrity: no CHECK constraints, no ActivityLog immutability, VIN/QID not unique.** Nothing prevents `amount<=0`, `paidAmount>amount`, `remainingAmount<0`, `paidAmount+remainingAmount≠amount`; audit rows are freely updatable/deletable; the same physical VIN can be listed (double-financed) and one QID can hold multiple accounts (defeats the one-active-application rule). (`schema.prisma`; migrations have zero CHECK/triggers.)

---

## 4. Security Findings

**Endpoint posture (good baseline):** `SessionAuthGuard` is registered globally as `APP_GUARD`, so every route is authenticated-by-default; `@Public()` is the explicit, auditable opt-out; `@Roles()` adds role gating in the same guard; the guard re-reads the user from the DB every request and checks `isActive`, so suspensions/role changes take effect immediately despite the 5-minute cookie cache. No controller is accidentally unauthenticated. CORS is an explicit allow-list, not a wildcard. This is a solid foundation.

| ID | Severity | Finding | Evidence | Priority |
|---|---|---|---|---|
| SEC-1 | **Critical** | Public payment completion, no gateway verification (= P0-1) | `payments.controller.ts:72-76` | P0 |
| SEC-2 | **High** | Officer per-record ops ignore `creditScope`/`financeScope` — cross-tenant IDOR (= P0-2) | `applications-lifecycle.service.ts:215-278` | P0/P1 |
| SEC-3 | **High** | KYC/PII + signed contracts downloadable by any officer of any company (= P0-3) | `applications.service.ts:478-489` | P1 |
| SEC-4 | **High** | Payment schedules: no company scoping for officers (view + mutate) | `payments.service.ts:46-79, 110-116` | P1 |
| SEC-5 | **High** | Deploy token(s) / local secrets in working tree (= P0-7) | `.env.local`, `packages/api/.env` | P1 |
| SEC-6 | **Medium** | Dealer can attach an arbitrary active offer to a product (`defaultOfferId` client-supplied) → steer finance partner/rate | `products.controller.ts:53,75`; `applications.service.ts:89-95` | P2 |
| SEC-7 | **Medium** | No rate limiting anywhere — `express-rate-limit` is a declared-but-unused dependency; Better Auth limiter not explicitly configured. Brute force / enumeration on auth, quote tokens, payment keys | grep: no usage in `src` | P2 |
| SEC-8 | **Medium** | No security headers (Helmet absent): no CSP/HSTS/X-Frame-Options; user-uploaded files streamed inline without `nosniff` | `main.ts` sets only CORS | P2 |
| SEC-9 | **Medium** | Unbounded in-memory multer upload (no `limits.fileSize`); size checked only after full buffering | `storage.service.ts:111-122` | P2 |
| SEC-10 | **Medium** | Path traversal / header-injection via raw `file.originalname` in storage key + `Content-Disposition` | `storage.service.ts:65,138`; `applications.controller.ts:110` | P2 |
| SEC-11 | **Low** | No MFA, no logout-all, no account lockout; 5-min cookie-cache staleness window (authz unaffected — guard re-reads DB) | `auth.ts:77-81`; `users.controller.ts:97-100` | P3 |
| SEC-12 | **Low** | No ErrorBoundary in any frontend; no security headers in `vercel.json`; `dist/` build artifacts in tree | all apps | P2/P3 |

**What's secure and done well:** no role escalation via signup/profile (`role`/`companyId` are `input:false`, default `customer`; privileged role changes gated to `super_admin` with self-lockout prevention); server-authoritative pricing (client `pricingSnapshot` amounts ignored, anti-spoof unit test present); auth-secret hardening (rejects placeholders/low-entropy/short at boot); quote access control (token + email match + expiry/used/revoked gating, masked email for non-matching viewers); VIN/chassis stripped from customer-facing payloads; Zoho tokens only from env, API domain validated to `https://…zohoapis.` (SSRF-mitigated), no inbound Zoho webhook exposed; cookie sessions with `credentials:'include'` and **no tokens in localStorage**; enumeration-safe password-reset copy.

**OWASP Top-10 snapshot:** Broken Access Control — **present** (SEC-2/3/4, the dominant risk class). Cryptographic Failures — low (secrets validated; TLS handled by platforms). Injection — low (Prisma parameterizes; Zoho uses encoded params). Insecure Design — **present** (payment trust model, no ledger). Security Misconfiguration — **present** (no headers, no rate limit, secrets in tree). Vulnerable Components — UNVERIFIED (no dependency scan in place — add one). SSRF — mitigated in the one integration. Security Logging & Monitoring Failures — **present** (P0-8).

---

## 5. Product & Feature-Completeness Findings

**Feature completeness matrix** (UI existing ≠ complete; verified against backend + workflow):

| Feature | Current state | Missing | Risk | Priority |
|---|---|---|---|---|
| Browse / search / facets | Complete | — | Low | — |
| Apply + server pricing | Complete (server-authoritative) | Wizard UX; QID/phone validation | Low | P2 |
| KYC document upload | Complete (presence checklist) | **Identity verification, AML/sanctions** | High (compliance) | P1 |
| Credit underwriting | Backend complete; **UI hides the data** | Render income/employment/plan in-app; decision reasons | High | P1 |
| Contract generation | PDF exists | Real template, full disclosures (APR/total cost of credit), schedule table, hash-lock vs signed upload | High (legal) | P1 |
| Down payment | Status flip only | **Recorded amount/receipt + enforcement** | High | P1 |
| Activation + schedule | Complete | Last-installment true-up | Medium | P2 |
| Online payment | **Simulated + bypassable** | Real gateway, verification, webhook, receipts | **Critical** | P0 |
| Manual payment servicing | Works | Idempotency on manual path; partial-amount UI in finance app | Medium | P1 |
| Overdue / dunning | Manual button only | **Scheduled sweep + reminders + late fees** | Medium | P2 |
| Refunds / settlements / payoff | **Missing** | Entire capability | Medium | P2 |
| Reconciliation / reporting / export | **Missing** | Bank↔recorded reconciliation, CSV export | Medium | P2 |
| Dealer inventory + quotes | Complete | Company/branding editing (shows raw JSON), copy-to-clipboard, list-price guard on quote | Medium | P2 |
| Notifications | In-app only, gaps | Email channel, payment-received/overdue/quote events, dedup, preferences | Medium | P2 |
| Tokenization / fractional shares | **Display-only estimate** | Real principal-based equity ledger | Roadmap | P3 |
| Feature flags / config UI | Missing | Ops self-service | Low | P3 |

**Missing financial capabilities (entire features absent):** real gateway integration; immutable ledger/double-entry; down-payment as recorded money; receipts/confirmations; refunds/reversals/early-settlement/prepayment credit; reconciliation/daily settlement; automated overdue/dunning + late fees; KYC identity verification; AML/sanctions/PEP screening; APR / total-cost-of-credit disclosure; Islamic `profitRate` computation (the field exists but is never used — only `annualRentRate`); maker-checker/dual control; interest recomputation on late/partial payment.

---

## 6. UX Findings

Maturity by app: **marketplace 4/5**, **super-admin 3/5**, **finance 3/5**, **credit 2.5/5**, **admin 2.5/5**, **dealer 2/5**.

**Highest-impact UX problems (tied to real screens):**

1. **Credit review hides the underwriting data** it exists to present (P1-5) — the single biggest ops UX gap.
2. **No 401/session-expired experience anywhere** (P1-2) — users hit raw errors or silent empty pages mid-flow, including during payment.
3. **Money/state actions lack confirmation:** finance "Confirm full payment" (no amount field, so partials are impossible in-app), credit "Reject"/"Direct activate", super-admin role change / suspend / company-flag toggles — all one misclick from irreversible. A `window.confirm` pattern already exists in marketplace; reuse it.
4. **"Pay online" has no double-submit guard** → multiple payment sessions per installment.
5. **Stock Unsplash photos shown as real vehicle images** when a listing has none → trust/legal risk on a car the customer is about to finance. Use a branded "no photo" placeholder.
6. **Dealer Company page renders raw `JSON.stringify`** — no editing of logo/phone/address that feed the public showroom CTAs.
7. **Arabic stops exactly at the high-stakes screens.** Ops apps are 100% hardcoded English; even in marketplace the apply form, quote redemption, payments, and notifications are hardcoded English or English-only fallbacks despite existing `apply.*` keys. Arabic customers hit English at apply/pay/auth.
8. **No ErrorBoundary** in any app → a render error is a white screen (including mid-payment).
9. **Ops lists capped at 100 with dead pagination controls** (Prev/Next have no `onClick`) → rows silently vanish past 100 and finance stat cards are wrong ("Paid (loaded)" admits it).
10. **Terminology whiplash:** customer sees "Building your stake"; dealer/ops see raw `active` enum text; the reconciling glossary (`docs/UI_TERMINOLOGY.md`) is a 0-byte file.
11. **Empty state lies during load** (finance "Queue clear" while fetching); **404s silently redirect to home** (stale notification-email deep links lose the user); **gallery arrow-keys hijack** number inputs on the detail page.
12. **No onboarding / email-verification prompt / resend-verification UI** anywhere; the one-active-plan rule is only discovered by hitting a 409.

**Accessibility (sampled):** good — global `:focus-visible`, `prefers-reduced-motion`, ARIA carousel, semantic HTML, RTL logical properties. Gaps — mobile drawer/facet sheet have no focus trap or Escape; status pills differ mainly by color; most error messages lack `role="alert"`/`aria-live`.

**Responsive:** genuinely implemented (grid reflow, mobile sticky apply bar, card layout for ops tables under `md`, breakpoints to 2560px+).

---

## 7. Technical Findings (architecture, DB, API, frontend, performance, code quality)

**Database & integrity** (schema/migrations read; live DB not reachable):
- Migration set drifted and boot-coupled (P0-6). Two parallel, incompatible schema definitions exist: Prisma (camelCase/cuid/no-RLS, authoritative) and the **dead legacy `supabase/` folder** (snake_case/uuid/full RLS, 10 SQL files) — and `04_TECH_ARCHITECTURE.md` still names the Supabase flow as canonical. This is active drift/confusion; delete or `attic/` the legacy tree and fix the doc.
- No CHECK constraints, no audit-log immutability, VIN/QID not unique (P1-8). Cascade deletes on financial rows (P0-4).
- Seed files `seed.ts`/`seed-chery.ts` are **0 bytes** — `db:seed` is a silent no-op; only `seed-finance-partners.ts` has content (idempotent, credential-free — good).
- Transactions are used for the important multi-writes (create/submit/cancel/activate/recordPayment) but **none take locks or use conditional guards** (P0-5). Activity/notify calls run *outside* the transaction, so a crash between commit and log loses audit entries.
- **Backups: no documentation of PITR/backup/restore anywhere** — unacceptable for a financing ledger; document and test.

**API & backend:**
- Server-authoritative pricing and a clean per-edge transition table are the strong points. The generic `/ops/applications/:id/transition` accepts any `toStatus` at the controller but the rules matrix restricts finance to down-payment edges (correct, but relies on the matrix — keep it tested).
- **Unbounded `findMany`** on `listMine`, `opsQueue`, `dealerLeads`, `listForDealer`, `listDealerInventory` (with all images eager-loaded), `users`, `companies`, `offers` — fine at pilot scale, linear degradation later.
- Missing hot-path indexes: `payment_schedules(status, dueDate)` for the overdue sweep; a partial index on `notifications(userId) WHERE readAt IS NULL` for the unread badge.
- Minor N+1s (`notifyOpsOnSubmit` inserts one-by-one; use `createMany`).
- Idempotency key is generated **server-side per click**, so it deduplicates nothing on creation and leaves stale pending transactions forever.

**Frontend / code quality:**
- `statusVariant()` reimplemented 6× with diverging mappings while `shared/config/status-styles.ts` exists and is used by no one; per-app bootstrap copy-pasted 6×; MUI pulled in across all six apps solely for `ThemeProvider`/`CssBaseline` (~100KB gz dead weight ×6) — replace with the existing SCSS reset.
- `VITE_SENTRY_DSN` declared but Sentry never initialized; hardcoded `http://localhost:3010` API fallback that would make a misconfigured prod build silently talk to localhost (fail fast instead).
- Client pricing calculator (`shared/lib/calculator.ts`) is a byte-for-byte duplicate of the server formula with no contract test → silent drift risk between displayed and charged price.

**Performance:** no current bottleneck at pilot scale; the real risks are the unbounded lists + missing indexes (will bite at 10×) and the eager image loads on dealer inventory. No caching/CDN strategy documented beyond Vercel defaults. Bundle bloat from MUI is the easiest win.

---

## 8. Operations Findings

- **Observability:** none to speak of (P0-8). Health check is shallow (static `{ok:true}`, no DB ping) — the platform can't tell a DB outage from a healthy app. No request IDs, no structured logs, several catch-and-ignore blocks (mail, Zoho).
- **Notifications/email:** in-app only; email channel never used; fire-and-forget with silent failure (P1-6). Missing events: payment-received (only the *final* installment notifies), overdue, quote received/expiring. No dedup (`notifyOpsOnSubmit` loops all matching staff every submit/resubmit) and no preferences.
- **Background jobs:** **none.** The domain clearly needs: overdue sweep, payment reminders, stuck-payment monitor, Zoho retry (currently one-shot fire-and-forget; failures only visible via `GET /ops/zoho/failures` with no auto-retry), quote-expiry sweep, email-outbox worker.
- **Admin/ops tooling:** genuinely usable — metrics, activity-log viewer, product list, a clever Zoho "never_synced" dashboard, user/company management, payment servicing, transitions. Staff can largely run the business without touching the DB. Gaps: no feature flags, no config/settings UI, no reports/CSV export, no readiness dashboard.
- **Audit logging:** written consistently on mutations with actor + metadata, and readable — a real audit trail. But it is **not immutable** (no trigger/least-privilege role), it runs outside transactions (loss window), and it is a free-form log, not a financial ledger. It can answer who/what/when/which-record reasonably; "from where" (IP) and tamper-resistance are weak.
- **Docs:** design docs (00–12) are high quality *as specs*, `DEPLOY.md` is thorough and accurate (spot-checked against code), but doc 12's gap analysis is partly **stale** (much has since been built) and **no incident-response / runbook / security / on-call doc exists.** `UI_TERMINOLOGY.md` and `.env.example` (api) are 0-byte stubs.

---

## 9. QA Findings

- **Tests:** 8 vitest spec files, ~435 LOC, **all pure-function unit tests** (pricing, transition matrix, doc-requirement logic, schedule math, Zoho mapping, auth-config). No integration test touches the DB, HTTP layer, or guards. **Frontends have zero tests.** Lint is a fake `echo`; typecheck is real but unautomated.
- **Critical paths with zero automated protection:** authN/authZ end-to-end (the global guard, role enforcement, suspension revocation), **all payment endpoints** (including the bypassable public one), object-level authorization (the IDOR cluster), and every HTTP endpoint.
- **What exists:** `smoke-docs-before-review.mjs` is a genuinely thorough ~450-line black-box smoke over the running API (draft→docs→submit→queue→resubmit, gate cases, ownership, file validation) — but it's **manual**, not in any pipeline, and the QA doc is a point-in-time PASS report, not a gate.

**Recommended minimum E2E suite (Playwright + supertest), in priority order:** registration → email verification → login; password recovery (all apps, including dealer once P1-3 is fixed); apply → KYC upload → submit (+ ownership: non-owner cannot read/mutate); credit approve/reject with reason enforcement; contract generate → sign-upload → QC; **payment: authorized recording, idempotency, and that the public completion path cannot settle without verification** (regression lock for P0-1); officer company-scope enforcement (regression lock for P0-2/3/4); logout / session-expiry / 401 handling; notifications fire on the right events.

---

## 10. Fintech Findings

**How money actually moves today (confirmed):** pricing is computed server-side in floats, rounded to whole QAR, stored as a JSON snapshot (client amounts ignored — good). Down payment is **entirely offline** and recorded only as a status flip (no amount). Installments are settled either **manually** by a finance officer (mutating `paidAmount` in place, the only real path) or via the **simulated, bypassable** SkipCash flow (P0-1). There is **no ledger, no gateway, no reconciliation, no refunds, no receipts.** Completion fires when no unpaid schedules remain.

| ID | Severity | Finding | Priority |
|---|---|---|---|
| FIN-1 | **Critical** | Public unverified payment completion (= P0-1) | P0 |
| FIN-2 | **High** | Down payment neither recorded as money nor enforced before activation (= P1-1) | P1 |
| FIN-3 | **High** | No ledger; mutable `paidAmount` is sole truth; financial rows cascade-delete (= P0-4) | P1 |
| FIN-4 | **High** | Float money math; installments rounded to whole QAR; Σ installments ≠ financed total; no last-installment true-up (e.g. 36×2,398 = 86,328 vs true 86,334.84 → customer underpays QAR 6.84) | P2 |
| FIN-5 | **High** | Client calculator duplicates server pricing → silent displayed-vs-charged drift risk | P2 |
| FIN-6 | **Medium** | Magic-epsilon float compares (`+0.005`) absorb sub-cent discrepancies into "fully paid"; overpayment forbidden rather than credited | P2 |
| FIN-7 | **Medium** | No overdue/dunning job (human-clicked button only) | P2 |
| FIN-8 | **Medium** | Segregation of duties absent — one admin can approve → file signed contract → activate → record payment → waive, alone; no maker-checker | P2 |
| FIN-9 | **Medium** | `allowDirectActivate` skips contract signing + down payment (default off, but a company-level footgun with no logged justification) | P2 |
| FIN-10 | **Medium** | KYC is presence-only; no identity verification; **no AML/sanctions/PEP screening** (regulatory) | P2 |
| FIN-11 | **Low** | Ownership/fractional-share math is float and equates installment amount with equity (mixes principal + profit) — blocks correct tokenization | P3 |
| FIN-12 | **Low** | Contract PDF names a "(placeholder)" lender, omits amortization schedule and APR/total-cost-of-credit; signed upload not verified against generated original (no hash-lock) | P3 |

**Money-movement principle for this platform:** every financial transaction must be atomic, idempotent, traceable, auditable, and reconcilable, and financial truth must live in an immutable ledger — never in mutable UI/row state. Today none of those five properties fully holds. **QFC/QFCRA context:** if this platform is to operate under the QFC Digital Assets / financing framework the user is researching, the missing controls (recorded down payment, ledger, AML/sanctions screening, disclosure-complete contracts, segregation of duties, immutable audit) are not optional polish — they are baseline regulatory requirements.

---

## 11. Scorecard (0–10)

| # | Category | Score | Basis |
|---|---|---|---|
| 1 | Product completeness | 4 | Financing spine works end-to-end; payments/ledger/refunds/reconciliation missing |
| 2 | UX | 5 | Marketplace strong; ops apps thin; no 401 UX; confirmations missing |
| 3 | User flows | 5 | Happy paths solid; error/expiry/offline/recovery paths weak |
| 4 | Security | 3 | Great auth baseline undermined by IDOR cluster + payment bypass + no headers/rate-limit |
| 5 | Authentication | 6 | Better Auth done well; no MFA/lockout/logout-all |
| 6 | Authorization | 3 | Role gating good; object-level company scope missing on all write paths |
| 7 | Database | 4 | Good types/indexes/snapshots; drifted migrations, no CHECKs, cascade-deletable finance, no backups doc |
| 8 | API / backend | 5 | Clean structure & state machine; no locks/guards, unbounded lists, shallow health |
| 9 | Frontend / mobile | 5 | Solid React/RTL; no ErrorBoundary, dead pagination, MUI bloat, i18n gaps |
| 10 | Performance | 5 | Fine at pilot; unbounded lists + missing indexes + bundle bloat loom |
| 11 | Testing | 2 | Pure-unit only; zero integration/E2E/frontend tests; fake lint |
| 12 | DevOps | 2 | No CI/CD, manual deploys, migrations in boot CMD, token in tree |
| 13 | Monitoring | 1 | No error tracking, no alerting, shallow health, catch-and-ignore |
| 14 | Reliability | 3 | Silent-failure email, no jobs, race conditions, crash-loop migration risk |
| 15 | Scalability | 4 | Stateless API scales; DB single point, no queue/cache, unbounded queries |
| 16 | Admin / operations | 6 | Genuinely usable ops surface; missing flags/config/exports |
| 17 | Notifications | 3 | In-app only, silent-failure email, missing events, no dedup/prefs |
| 18 | Analytics | 1 | No product analytics/event taxonomy found at all |
| 19 | Documentation | 6 | Excellent design docs & deploy guide; stale gap analysis, no runbook/security doc, empty stubs |
| 20 | Fintech readiness | 2 | No gateway/ledger/reconciliation/AML/disclosures; payment bypass |

**Overall Production-Readiness Score: 3.6 / 10 — Early product.**
The financing spine is real and the architecture is sound, but payment integrity, tenant isolation on writes, concurrency, observability, and testing are below the bar for real customers or real money.

---

## 12. Priority Roadmap

**Phase 0 — Emergency (P0, ~2–4 weeks; do before any real money/customers)**
1. Kill the payment bypass: gate the simulated SkipCash path behind an off-in-prod flag; implement real server-side verification / signed webhook before marking paid (P0-1).
2. Add `assertCompanyScope()` to every per-record ops + payment handler (P0-2/3/4-authz).
3. Introduce an append-only `payment_events` ledger; change financial FKs to `onDelete: Restrict`; stop hard-deleting financial entities (P0-4).
4. Guarded conditional updates on every status/payment transition; single-transaction SkipCash completion; Decimal money math (P0-5).
5. Fix the migration set (add `payment_transactions`, fix status default, real baseline) and move `migrate deploy` out of the container CMD to a release step (P0-6).
6. Rotate the Vercel token(s); purge `.env*` from any history; add a dependency/secret scan (P0-7).
7. Stand up CI (typecheck → real ESLint → vitest → build, block-on-red) + Sentry on API and frontends + a deep readiness probe + an uptime alert (P0-8).

**Phase 1 — Production readiness (P1, ~4–8 weeks)**
Record + enforce down payment (P1-1); global 401/session-expiry handling + QueryClient retry policy (P1-2); dealer forgot/reset routes (P1-3); admin activate error surfacing + pending states across all money/state buttons + confirmations (P1-4, UX-3/4); render underwriting data in credit review (P1-5); `email_outbox` with retry + hard-fail on auth-critical sends (P1-6); use `resolveApiPort` in `main.ts` (P1-7); DB integrity migration — CHECK constraints, ActivityLog immutability trigger, VIN/QID unique, QID format (P1-8); real contract template with full disclosures + hash-lock; the minimum E2E suite (§9), with payment-bypass and officer-scope regression tests first; document & test backups/PITR.

**Phase 2 — Hardening (P2, ~8–12 weeks)**
Rate limiting + Helmet + security headers on API and Vercel; multer size limits + filename sanitization; last-installment true-up + single shared pricing function with a contract test; scheduled jobs (overdue sweep, reminders, Zoho retry, quote expiry); pagination on all list endpoints + hot-path indexes; segregation-of-duties / maker-checker on approve/activate/waive; KYC identity verification + AML/sanctions screening integration; email + missing notification events + dedup + preferences; reconciliation/export tooling; feature flags + config UI; delete legacy `supabase/` tree and fix `04_TECH_ARCHITECTURE.md`; write the terminology glossary and `.env.example`.

**Phase 3 — Scale & optimization (P3)**
MFA/logout-all/lockout for privileged roles; drop MUI, consolidate duplicated `statusVariant`/bootstrap into shared; caching/CDN strategy; product analytics + event taxonomy (§14); refunds/early-settlement/prepayment-credit; correct Decimal principal-based ownership ledger as the tokenization precursor; APR computation and Islamic `profitRate` support; incident-response runbook.

---

## 13. Recommended Target Architecture

Keep the current shape — it's right — and add the missing spine:
- **API:** NestJS as-is, plus a global rate-limiter + Helmet, a request-ID/logging interceptor, `@nestjs/schedule` (or Railway cron) for sweeps, and a queue-backed **email/notification outbox** worker.
- **Payments:** a dedicated payments module fronting the real gateway (SkipCash) with server-side verification and signed webhooks; an **append-only ledger** as the single source of financial truth; `payment_schedules` become a *derived read model* over ledger events, not the source. All money math in Decimal/minor units.
- **Data:** Prisma migrations only (delete legacy Supabase SQL), DB-level CHECK constraints + immutability triggers on audit/ledger, `Restrict` on financial relations, soft-delete elsewhere, documented PITR backups, a least-privilege app DB role.
- **Delivery:** GitHub Actions CI (typecheck/lint/test/build) → release-gated deploy with migrations as a discrete pre-deploy job → automatic rollback on failed health; a **staging environment** (currently only local + prod).
- **Observability:** Sentry (API + web), structured logs with correlation IDs, deep readiness probes, uptime monitor + on-call alert channel, dashboards for payment/queue/email failures.
- **Compliance layer:** KYC identity verification + AML/sanctions screening as an approval gate; disclosure-complete contracts with hash-locking; segregation of duties enforced in the transition matrix.

---

## 14. Recommended User Flows (improved)

- **Customer payment:** Pay → server creates intent → **redirect to real gateway** → gateway → signed webhook verifies → ledger event → schedule read-model updates → receipt email + in-app notification. Button disabled while pending; 401 mid-flow routes to a "session expired, sign back in" screen that preserves intent.
- **Credit review:** queue → detail screen that **shows income/employment/QID/plan terms inline** with the KYC files → decision with mandatory reason → approval by a *different* actor than the one who activates (maker-checker).
- **Onboarding:** register → **verify-email prompt with resend** → guided first-application with a real wizard (validated QID/phone) → clear one-active-plan explanation before, not after, the 409.
- **Officer scoping:** every per-record action silently filtered to assigned companies; out-of-scope IDs return 404, not data.

## 15. Recommended Feature Roadmap (missing capabilities)

Real gateway + verification; immutable ledger; recorded down payment + receipts; refunds/early-settlement/prepayment credit; reconciliation + settlement reports + CSV export; automated dunning + late fees; KYC verification + AML/sanctions; APR/total-cost disclosures + Islamic profit-rate; maker-checker; email + full notification event coverage + preferences; feature flags + config UI; product analytics; and — for the stated vision — a Decimal principal-based fractional-ownership ledger as the honest basis for tokenization.

## 16. Technical Debt (and impact)

Two parallel schema definitions (Prisma vs dead Supabase) → drift and onboarding confusion. Duplicated pricing math (client vs server) → silent price divergence. Duplicated `statusVariant`/bootstrap across six apps → inconsistent status labels, six-fold maintenance. MUI imported for two components → ~600KB gz of avoidable weight. Fake lint + no CI → regressions ship freely. Empty seed/`.env.example`/glossary stubs → broken local setup and terminology chaos. Committed `dist/` → repo bloat and drift. `installmentPlan` accepted as an unvalidated client blob duplicating `pricingSnapshot` → a second uncontrolled source of UI truth.

---

## 17. Top 10 Recommendations (highest impact first)

1. **Close the payment bypass** — no real money until gateway-verified completion replaces the public key-trusting endpoint. (P0-1)
2. **Enforce company scope on every per-record ops and payment handler** — one shared helper eliminates the entire cross-tenant IDOR cluster, including KYC/PII exposure. (P0-2/3/4)
3. **Introduce an append-only ledger and make financial records non-deletable** (`Restrict`, no cascade) — financial truth must be immutable and reconstructable. (P0-4)
4. **Make every money/status transition atomic** with guarded conditional updates and Decimal math — eliminate lost-update and double-approve races. (P0-5)
5. **Fix and de-couple database migrations** (add the missing `payment_transactions` migration, real baseline, run as a release step) — avoid fresh-deploy crashes and boot crash-loops. (P0-6)
6. **Rotate the exposed deploy token and add CI + secret/dependency scanning** — stop shipping unlint, untested, manually-deployed code. (P0-7, P0-8)
7. **Add error tracking, structured logging with request IDs, a deep health probe, and an uptime alert** — so a 2 a.m. failure is known in minutes, not from customer complaints. (P0-8)
8. **Record and enforce the down payment as real money before activation**, and add scheduled overdue/dunning jobs — close the two biggest servicing-integrity gaps. (P1-1, FIN-7)
9. **Fix the highest-stakes UX cuts:** global 401 handling, dealer password reset, admin-activate error surfacing, render underwriting data in credit review, and confirmations on irreversible actions. (P1-2/3/4/5, UX-3)
10. **Build the compliance layer** — KYC identity verification, AML/sanctions screening, and disclosure-complete hash-locked contracts — before onboarding real borrowers under the QFC framework. (FIN-10/12)

---

*Prepared from static source inspection on 19 Aug 2026. Findings tagged VERIFIED were traced in code; production database state, live infrastructure, and third-party configuration were not directly observable and are flagged UNVERIFIED where relevant. This audit intentionally did not modify any source.*
