# Blox / DriveMarket — Production-Readiness Audit (Rev 2, Re-Audit)

**Product:** DriveMarket (brand "Blox") — vehicle-financing marketplace, Qatar (QAR)
**Audit date:** 20 August 2026 (re-audit of the 19 Aug baseline)
**Method:** Fresh static inspection of the current source by three parallel specialist reviews (security/authz, DB+fintech+ops, frontend/UX). Every prior finding was re-checked against current code and classified **FIXED / PARTIAL / NOT-FIXED / REGRESSED**; new issues were then hunted fresh. Findings tagged **VERIFIED** (code read) or **UNVERIFIED**. Dependencies weren't installed, so `tsc`/build/tests weren't executed — but the repo's own integration tests run against real Postgres (testcontainers) in CI, which validates the migration chain.

> **Read this first.** Between the two audits the team applied most of the Phase-0/1 fix-prompts, and did so at high quality — real ledger, concurrency locks, migration reconciliation, CI, integration tests, MFA, dual control, compliance gate, email outbox, background jobs. This is a large, real jump. **But there is one critical catch:** the fixes for the cross-tenant IDOR (SEC-2/3) and unbounded uploads (SEC-9) were written into `.wip` files that were **never wired into the app** — so the *active* code still has a live P0 authorization hole. Plus two new correctness bugs (waive is DB-broken; the down-payment flow dead-ends). Details below.

---

## 1. Executive Summary

The 19 Aug audit scored **3.6/10 — Early product**, with a disqualifying payment-bypass flaw and a cross-tenant IDOR cluster. The team has since done **excellent remediation**: the payment bypass is genuinely closed, there's now a real append-only **payment ledger** with row-locks and guarded transitions, **migrations are reconciled** and moved out of the boot path, there's **real CI + ESLint + integration tests** (with regression locks for the two worst prior findings), **MFA + login lockout + logout-all**, **separation of duties + dual-control waive**, a **fail-closed compliance gate**, an **email outbox**, a **background-job scheduler**, **Sentry + a real health/readiness probe**, **an analytics event taxonomy**, and a broad sweep of frontend fixes (401 handling, confirmations, pending states, security headers, the credit-review data that was hidden, MUI removed). The revised score is **~6.0/10 — Functional production product.**

It is, however, **still not cleared for go-live**, for three concrete reasons:

1. **A residual P0: cross-tenant authorization hole is still live.** The intended fix exists but sits in un-activated `.wip` files. In the *running* code, a credit/finance officer scoped to Company A can still `approve`, `activate`, `transition`, and download the **signed contract PDF** of Company B's applications (`applications-lifecycle.service.ts` gates on role only, never company scope). Payments and the KYC-document read path *were* correctly scoped — but the lifecycle handlers weren't. This is the same IDOR class as before, half-closed.
2. **Two P1 correctness bugs make core flows non-functional.** (a) The **waive** feature is broken at the database layer — a new CHECK constraint (`paidAmount + remainingAmount = amount`) is violated by every reachable waive, so it 500s. (b) The **down-payment collection flow dead-ends** — the recording endpoint is a `NotImplemented` stub (real code parked in `.wip`), and there's no transition out of `down_payment_required`, so any offer with a non-zero down payment can never reach `active`. Only 0%-down deals work end-to-end.
3. **The standard approval path is inert by design** (correctly, but must be tracked): the compliance provider is a throwing stub, so `approveWithContract` can't succeed until a real KYC/AML vendor is wired. Combined with #2, `allowDirectActivate` is currently the only working activation path — and it **bypasses the compliance gate and contract signing** (a P2 AML gap once enabled).

The through-line: **the architecture and the fixes are now genuinely strong; what remains is a small number of "written-but-not-wired" and "constraint-vs-code" defects, not systemic immaturity.** Activating the three `.wip` files plus fixing the waive constraint and the down-payment recorder closes the entire critical set. This is a few days of focused work, not a rebuild.

**Overall Production-Readiness Score: 6.0 / 10 — Functional production product**, blocked from go-live by one residual P0 and two P1 correctness bugs (all narrowly scoped).

---

## 2. Remediation scorecard — what the team fixed

| Prior finding | Status | Evidence |
|---|---|---|
| **P0-1 Payment bypass** (public skipcash/complete) | ✅ **FIXED** | `payments.service.ts:512` throws 403 `gateway_verification_required` unless `SKIPCASH_SANDBOX`; `verifyAndComplete` is a real NotImplemented stub; regression test asserts zero rows change when not sandbox |
| **P0-2/3 Officer per-record IDOR** (lifecycle) | ⚠️ **PARTIAL — residual P0** | Payments + KYC-doc read scoped ✅; **lifecycle handlers (approve/activate/transition/downloadContract) still role-only** ❌ — fix parked in `applications-lifecycle.service.ts.wip`, not wired |
| **P0-4 No ledger / cascade-deletable finance** | ✅ **FIXED** | `PaymentEvent` append-only ledger; all financial FKs `onDelete: Restrict`; balances derived from events + cache reconciliation |
| **P0-5 Concurrency (lost-update / double-approve)** | ✅ **FIXED** | `SELECT … FOR UPDATE` (`lockScheduleForUpdate`), guarded `updateMany` + `assertRowsUpdated` on transitions, product reserve, quote redeem |
| **P0-6 Migration drift + boot-CMD migrate** | ✅ **FIXED** | Reconcile migration adds `payment_transactions` + fixes status default; Dockerfile CMD is just `node`; `railway.toml` runs `migrate deploy` as pre-deploy |
| **P0-7 Vercel token in tree** | ⚠️ **PARTIAL** | `.gitignore` now covers env files; QA-password script gone; **`.env.local` with a real OIDC token still physically present** — rotate + delete |
| **P0-8 No CI / fake lint / no observability** | ✅ **FIXED** | Real CI (typecheck, type-checked ESLint, unit + integration, build); Sentry (PII-scrubbed); health `/ready` pings DB; job-health tracking |
| **P1-1 Down payment recorded + enforced** | ⚠️ **PARTIAL — new P1** | Enforcement present (`assertDownPaymentSatisfied`); **recording endpoint is a NotImplemented stub → flow dead-ends** (NEW-2) |
| **P1-2 Client 401 / retry** | ✅ **FIXED** | `createQueryClient` (no retry on 401/403/<500); `apiFetch` 401 → clear session + redirect w/ returnUrl |
| **P1-3 Dealer reset-password routes** | ✅ **FIXED** | routes added to dealer (and other ops apps) |
| **P1-4 Admin activate swallows errors** | ✅ **FIXED** | `useMutation` + onError surfaced + pending disable + confirm |
| **P1-5 Credit review hides underwriting data** | ✅ **FIXED** | `ApplicantPlanSection` renders income/employment/QID + plan terms |
| **P1-6 Email fire-and-forget** | ✅ **FIXED** | durable `email_outbox` + backoff + auth-critical throws + cron worker |
| **P1-7 main.ts ignores Railway PORT** | ✅ **FIXED** | uses `resolveApiPort` |
| **P1-8 DB integrity (CHECKs, audit immutability, uniques)** | ✅ **FIXED** (one bug) | append-only `activity_logs` trigger; positive-amount CHECKs; partial-unique VIN/chassis/QID — **but the paid+remaining CHECK breaks waive** (NEW-1) |
| **SEC-6 dealer offer steering** | ❌ **NOT-FIXED** | `defaultOfferId` still written unvalidated (low sev) |
| **SEC-7 rate limiting** | ✅ **FIXED** | tiered `express-rate-limit` (auth/public/global) |
| **SEC-8 Helmet / headers / nosniff** | ✅ **FIXED** | Helmet CSP + per-portal vercel headers |
| **SEC-9 unbounded uploads** | ⚠️ **PARTIAL** | product-image upload limited; **KYC + contract uploads still unlimited** (fix in `.wip`) (NEW/F3) |
| **SEC-10 path traversal / filename** | ✅ **FIXED** | storage keys server-generated (UUID+mime), no client filename |
| **SEC-11 MFA / lockout / logout-all** | ✅ **FIXED** (advisory) | present; MFA available but not server-*enforced* on privileged routes (F7) |
| **FIN-4 float rounding / true-up** | ✅ **FIXED** | shared minor-unit pricing; last-installment true-up; parity test |
| **FIN-5 duplicate pricing calc** | ⚠️ **PARTIAL** | unified for contracts/quotes; a whole-QAR listing-card estimator remains (NEW-3, cosmetic) |
| **FIN-7 overdue/dunning job** | ✅ **FIXED** | scheduler: overdue sweep, reminders (deduped), quote expiry, zoho retry, outbox |
| **FIN-8 segregation of duties** | ✅ **FIXED** | approver≠payer/waiver; dual-control waive |
| **FIN-10 KYC/AML gate** | ✅ **FIXED** (provider stub) | fail-closed compliance gate blocks approval; vendor is an intentional stub |
| **FIN-12 contract disclosures** | ✅ **FIXED** | real multi-section PDF (APR, total cost of credit, amortization) + SHA-256 fingerprint verified against signed upload |
| **X-13 MUI bloat** | ✅ **FIXED** | removed entirely |
| **X-15 terminology / docs stubs** | ✅ **FIXED** | glossary + env example filled; supabase moved to `attic/` |
| **Backups / PITR docs** | ❌ **NOT-FIXED** | still no DR/backup runbook |

That's a large amount of correct, high-quality remediation. The gaps below are what remains.

---

## 3. Critical Findings (open P0 / P1)

### P0 — Blocker (must close before go-live)

**P0-R1 — Cross-tenant authorization hole is still live in the application lifecycle.** The fixes for this are written but parked in `.wip` files and never activated; `ApplicationsModule` still imports the unscoped service. In the running code, `approveWithContract`, `opsTransition`, `activate`, and `submitSignedContractOps` gate on **role only** (`assertOps`), and `downloadContract` uses an unscoped `assertCanView`. *Evidence:* `applications-lifecycle.service.ts:81, 244, 283, 371, 478`; controller allows `credit_officer` on all four (`applications.controller.ts:167,192,208,214`). *Scenario:* a credit/finance officer scoped to Company A calls `POST /api/ops/applications/{B}/approve-contract` (or `/activate`, `/transition`) and drives another company's financing to approval/activation, or `GET /api/applications/{B}/contract/file` to pull Company B's signed contract PDF (full name, QID, phone, financials, signature). *Fix:* wire the `.wip` service/controller/module (they add `assertCompanyScope(...)` after each record load) and delete the stale originals — this closes P0-R1, F2, and the KYC-upload issue (F3) in one change. **Add a regression test per handler** (the existing company-scope integration test only covers the read path).

### P1 — Critical correctness bugs

**P1-R1 — Waive is broken at the database layer.** The new migration adds an unconditional `CHECK ("paidAmount" + "remainingAmount" = amount)`, but the waive path sets `remainingAmount = 0` while `paidAmount` stays at the ledger value (waive events aren't counted as "paid"). *Evidence:* `migrations/20260822…:14` vs `payments.service.ts:710-720`, `:872-881`. *Scenario:* waive a pending QAR 1,000 installment → writes `paid=0, remaining=0, amount=1000` → `0+0 ≠ 1000` → Postgres rejects → 500. Every reachable waive fails; the whole dual-control waive feature is dead at the DB. No test covers waive. *Fix:* set `paidAmount = amount` on waive (treat forgiven as settled) **or** make the CHECK conditional (`status <> 'waived'`); add a waive test.

**P1-R2 — Down-payment collection flow dead-ends.** `recordDownPayment` throws `down_payment_not_implemented` (real code parked in `.wip`), and `application-transitions.ts` has no edge *out of* `down_payment_required`. Meanwhile `activate()` enforces `assertDownPaymentSatisfied` reading `down_payment` ledger events — which nothing can create. *Net:* any offer with down payment > 0 can never be activated; only 0%-down deals complete. *Evidence:* `applications-lifecycle.service.ts:363-369`; `application-transitions.ts:24-31`. *Fix:* activate the `.wip` down-payment recorder (module/controller/service) or wire an equivalent endpoint that writes a `down_payment` ledger event and advances the state; add a test.

**P1-R3 — No ErrorBoundary in any of the six apps.** Any render throw white-screens the whole SPA — including mid-payment — with no recovery. Sentry is initialized but there's no boundary to catch. *Evidence:* zero `ErrorBoundary`/`componentDidCatch` in the repo; `app-bootstrap.tsx:41-50` wraps only Query/Router. *Fix:* add `Sentry.ErrorBoundary` (already a dependency) with a fallback inside `mountPortalApp` — one change covers all six apps.

**P1-R4 — "Pay online" still has no double-submit guard.** `ApplicationDetailPanel.tsx:312-329` is a raw async onClick with no pending/disabled state — rapid taps create multiple SkipCash sessions. *Fix:* `useMutation` + `disabled={pay.isPending}`.

---

## 4. Security Findings (delta)

Security posture improved substantially: payment bypass closed, tiered rate limiting, Helmet + CSP + per-portal headers, server-generated storage keys, MFA + login lockout + logout-all, session guard re-loads the user every request. **Remaining/new:**

| ID | Sev | Finding | Priority |
|---|---|---|---|
| P0-R1 (F1) | **Critical** | Officer cross-company IDOR on lifecycle handlers (`.wip` fix not wired) | P0 |
| F2 | **High** | Any officer downloads any company's contract PDF (`downloadContract` unscoped) | P0 (part of P0-R1) |
| F3 | **High** | Unbounded KYC/contract uploads (no multer fileSize limit; buffered before size check → memory DoS) | P1 |
| F4 | **Medium** | `GET /ops/zoho/failures` returns customer emails across all companies to scoped officers (no `opsCompanyFilter`) | P2 |
| F7 | **Medium** | MFA available but not server-enforced — a privileged user who never enrolls can use all ops endpoints | P2 |
| F8 | **Medium** | `.env.local` with a real Vercel OIDC token still in the tree — rotate + delete | P2 |
| F5 | **Low** | Platform-wide `/ops/metrics` aggregates exposed to scoped officers (no PII) | P3 |
| F6 | **Low/Med** | Dealer sets unvalidated `defaultOfferId` (offer/rate steering) | P3 |
| — | Info | Real KYC PDFs land on ephemeral local disk when `S3_ENDPOINT` unset — make S3 mandatory in prod (fail-fast) | P2 |

---

## 5. Fintech Findings (delta)

Now genuinely strong on the fundamentals — append-only ledger, row-locked money mutations, exact minor-unit rounding with last-installment true-up, separation of duties, dual-control waive, fail-closed compliance gate, and a real disclosure-complete contract PDF with signed-upload fingerprint verification. **Remaining:**

- **P1-R1 waive DB-broken**, **P1-R2 down-payment dead-ends** (above) — the two flows that most directly move money are currently non-functional.
- **Compliance provider is a throwing stub** → the standard `approveWithContract` path can't complete until a KYC/AML vendor is wired (correct fail-closed behavior; track as a go-live dependency). *Evidence:* `compliance-provider.stub.ts`.
- **Direct-activate bypasses the compliance gate and contract signing** (`allowDirectActivate` path enforces down-payment but skips AML + contract). Defaults off, but an AML control gap once enabled. **P2.**
- **System-actor FK bug (NEW-4):** `'system'` is used as `actorUserId` for cron writes (overdue sweep, reminder dedup, sandbox complete) but no `system` user is seeded → FK violation (23503). Payment-reminder run aborts mid-batch and, because the dedup row never writes, **re-notifies/re-emails the same customer every run (spam)**. *Fix:* seed a `system` user or use `actorUserId: null`. **P2.**
- **No reconciliation report / bank-statement-to-ledger matching** yet; **no refunds/early-settlement**; contract disclosures are generic (not certified Qatar-law text — a legal-review item).
- **Backups/PITR undocumented** — for a financing ledger, document backup cadence, PITR window, and a restore drill. **P2.**

---

## 6. Product / UX / Ops Findings (delta)

**UX** improved markedly (per-app maturity: marketplace 4→4.5, credit 2.5→3.5, admin 2.5→3.5, finance 3→3.5, super-admin 3→3.5, dealer 2→3). Systemic wins came from centralizing fixes in `shared/`: one QueryClient, one 401-intercepting `apiFetch`, one bootstrap with Sentry + fail-fast API-config. Remaining: **no ErrorBoundary (P1-R3)**, **pay double-submit (P1-R4)**, **ops apps still 100% hardcoded English** (no i18n in admin/dealer/credit/finance/super-admin; and marketplace quote-redeem + apply-field labels still English) — Arabic users get an English back office (**P2**), **dealer CompanyPage dumps raw JSON** (**P2**), a **401 latch that never resets** if a 401 occurs on an `/auth/*` page (silently swallows later 401s — **P3**), and no-image listings still show generic car stock as the vehicle (**P3**).

**Ops/Observability:** real scheduler with per-job health tracking, Sentry, split liveness/readiness, analytics taxonomy with PII scrubbing, email outbox. Gaps: no request-id/correlation-id middleware (P3); the system-actor FK bug undermines two cron jobs (P2, above); no backup/DR runbook (P2).

**Testing:** transformed — unit specs for pricing parity, transitions, guarded-transitions, down-payment, separation-of-duties, compliance gate, company-scope, login-lockout, analytics; plus **integration tests on real Postgres** with **regression locks** for the payment-bypass and company-scope-read findings. **Coverage gaps that let the new bugs through:** no tests for **waive** (would have caught P1-R1), **down-payment flow** (P1-R2), or **cron jobs** (NEW-4). Add these three.

---

## 7. Updated Scorecard (before → after)

| # | Category | 19 Aug | 20 Aug | Note |
|---|---|---:|---:|---|
| 1 | Product completeness | 4 | 5 | Ledger/contract/compliance/jobs added; waive + down-payment currently broken |
| 2 | UX | 5 | 6.5 | Confirmations, pending states, 401 UX, credit data, pagination |
| 3 | User flows | 5 | 5.5 | Two money flows (waive, down-payment) non-functional |
| 4 | Security | 3 | 6 | Big gains; capped by residual lifecycle IDOR (P0) |
| 5 | Authentication | 6 | 8 | MFA, lockout, logout-all, session hardening |
| 6 | Authorization | 3 | 5.5 | Payments/reads scoped correctly; lifecycle handlers still cross-tenant |
| 7 | Database | 4 | 7.5 | Ledger, RESTRICT, CHECKs, immutable audit, indexes; one CHECK breaks waive |
| 8 | API / backend | 5 | 7 | Guarded transactions, row locks, pagination |
| 9 | Frontend / mobile | 5 | 6.5 | Shared fixes; no ErrorBoundary, i18n gaps |
| 10 | Performance | 5 | 6 | Pagination + hot-path indexes |
| 11 | Testing | 2 | 6.5 | Unit + integration + regression locks; waive/down-payment/cron untested |
| 12 | DevOps | 2 | 7 | Real CI + lint; pre-deploy migrations; PORT honored |
| 13 | Monitoring | 1 | 6 | Sentry, readiness probe, job health; no request-id |
| 14 | Reliability | 3 | 5.5 | Outbox + jobs + locks; system-actor FK bug + broken waive |
| 15 | Scalability | 4 | 6 | Pagination, indexes, stateless API |
| 16 | Admin / operations | 6 | 6.5 | Jobs + tooling; dealer raw-JSON page |
| 17 | Notifications | 3 | 6 | Outbox + reminders + dedup; FK bug can spam/abort |
| 18 | Analytics | 1 | 6.5 | Real taxonomy + PII scrub |
| 19 | Documentation | 6 | 6.5 | Glossary + env example + attic; no DR runbook |
| 20 | Fintech readiness | 2 | 5.5 | Ledger/SoD/dual-control/compliance/disclosures; down-payment+waive broken, provider stub, direct-activate bypass |

**Overall Production-Readiness: 3.6 → 6.0 / 10 (Functional production product).** Gated from go-live by one residual P0 (un-wired IDOR fix) and two P1 correctness bugs — all narrowly scoped.

---

## 8. Priority Roadmap (what's left)

**Phase 0 — Close the blocker (days):**
1. **Activate the `.wip` files** (lifecycle service + controller + module): adds company-scope to approve/activate/transition/download-contract and file-size limits to KYC/contract uploads — closes **P0-R1, F2, F3** at once. Delete the stale originals. Add a per-handler company-scope regression test.

**Phase 1 — Fix the correctness bugs (days):**
2. **Waive** — reconcile the CHECK vs the waive write (P1-R1) + add a waive test.
3. **Down-payment recorder** — activate the `.wip` implementation and add the missing state transition (P1-R2) + a test.
4. **ErrorBoundary** in `mountPortalApp` (P1-R3); **pay-online double-submit guard** (P1-R4).
5. **Seed a `system` user** (or null actor) to fix the cron FK bug (NEW-4).

**Phase 2 — Hardening (weeks):**
6. Wire a real **KYC/AML compliance provider** (replaces the stub; unblocks the standard approval path); run the **compliance gate + contract requirement in the direct-activate path** too.
7. Scope `/ops/zoho/failures` (and optionally `/ops/metrics`) by company (F4/F5); **enforce MFA** on privileged routes (F7); **rotate + delete** the `.env.local` token (F8); make **S3 mandatory in prod** (fail-fast).
8. **i18n** for ops apps + the marketplace quote/apply residuals; dealer CompanyPage; 401-latch reset.
9. **Backup/PITR runbook**; request-id middleware; reconciliation report.

**Phase 3 — Optimization:** unify the listing-card estimator with shared pricing (NEW-3); refunds/early-settlement; certified Qatar-law contract disclosures; remaining unbounded reference-list caps.

---

## 9. Top 10 (this round)

1. **Wire the `.wip` files** — the single highest-leverage change; closes the live cross-tenant P0 and the upload DoS together.
2. **Fix waive** (DB CHECK vs code) — a headline feature currently 500s on every use.
3. **Make the down-payment flow work** — today only 0%-down deals can activate.
4. **Add ErrorBoundary** to all six apps.
5. **Guard pay-online against double-submit.**
6. **Seed the `system` user** to stop cron FK failures (and the reminder-spam loop).
7. **Wire a real KYC/AML provider** and run the gate on the direct-activate path.
8. **Add tests for waive, down-payment, and cron** — the three gaps that let these bugs ship.
9. **Rotate the Vercel token; make S3 mandatory in prod; enforce MFA on privileged roles.**
10. **Document backups/PITR** and add a restore drill.

---

*Rev 2, 20 Aug 2026. The team's remediation since the baseline is substantial and largely correct; the codebase moved from "Early product" to "Functional production product." Go-live is now gated by a small, well-scoped set of defects — most of which are already written and merely need activating — rather than by systemic gaps. Re-verify the residual P0 and the two P1 correctness bugs after the `.wip` activation before any production traffic.*
