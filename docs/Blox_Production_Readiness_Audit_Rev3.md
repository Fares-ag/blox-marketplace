# Blox / DriveMarket — Production-Readiness Audit (Rev 3)

**Product:** DriveMarket (brand "Blox") — vehicle-financing marketplace, Qatar (QAR)
**Audit date:** 20 August 2026 (third pass)
**Method:** Fresh static inspection of the current source by two parallel specialist reviews (backend/security/fintech/DB; frontend/ops/QA). Every Rev 2 finding re-verified against current code and classified FIXED / PARTIAL / NOT-FIXED; new issues hunted fresh. Tags: VERIFIED (code read) / UNVERIFIED. The repo's own integration tests run against real Postgres (testcontainers) in CI, which validates the migration chain and the key invariants.

> **Trajectory:** 19 Aug **3.6 (Early product)** → 20 Aug AM **6.0 (Functional production)** → now **7.0 (Strong production system)**. The team has, across three fix rounds, closed every P0 and every security/financial-integrity P1. What blocks *actual go-live* is no longer defects — it's three **launch dependencies** that are deliberately fail-closed (real KYC/AML provider, real payment gateway, counsel-certified contract text). Those are vendor/legal integrations, not architectural problems.

---

## 1. Executive Summary

This is now a **genuinely solid production-grade codebase** with a small, well-understood set of remaining work. The Rev 2 blockers are all closed and *tested*:

- **The residual cross-tenant IDOR is gone** — every per-record lifecycle handler (approve, activate, transition, submit-signed-contract, download-contract) now enforces company scope, with a clean read/write split (403 on actions, 404 on reads so records aren't enumerable), and a **regression integration test** proves a Company-A officer can't touch Company-B records.
- **The two P1 correctness bugs are fixed and tested:** waive no longer violates the DB CHECK (the ledger now counts waive so `paid + remaining = amount` always holds, with a dedicated `payment-ledger` spec); the down-payment flow is fully wired (real `recordDownPayment` + the missing transition edge), so non-zero-down deals can now be recorded and activated end-to-end.
- **The reliability bugs are fixed:** the `system` user is seeded (migration + idempotent boot upsert), so cron jobs no longer FK-fail or spam customers; MFA is now **server-enforced** on privileged roles via a global guard; S3 is mandatory in prod (fail-fast); uploads are size-limited before buffering; and a **request-id correlation middleware** threads through logs, Sentry, and responses.
- **Frontend hardening landed:** a Sentry ErrorBoundary wraps all six apps, the pay-online button is a proper `useMutation` with a pending guard, the 401 latch resets on `/auth` routes, and the dealer company page is a real fielded view.
- **Ops maturity:** a good **backup/DR runbook** (RPO/RTO, PITR, quarterly restore drill, post-restore ledger-invariant SQL check), integration tests for waive/down-payment/jobs/regression/request-id wired into CI.

The financial core is now defensible: an append-only `PaymentEvent` ledger as source of truth, row locks (`SELECT … FOR UPDATE`) and guarded compare-and-set transitions eliminating the earlier races, dual-control waive, separation of duties, a fail-closed compliance gate, and a real fingerprinted contract PDF.

**What still stands between this and real customers** is three fail-closed launch dependencies and some polish:

1. **No real payment gateway yet.** Online self-pay is inert in prod — `verifyAndComplete` is a `NotImplemented` stub and `completeSkipCashPayment` 403s outside sandbox. This is *correctly* fail-closed (it never fakes a payment), but the customer-facing "Pay online" flow can't complete until SkipCash is wired with webhook signature verification. Manual finance-officer recording works. **P1 (feature/launch).**
2. **No real KYC/AML provider yet.** The compliance gate is real and fail-closed, but the provider is a stub — so in prod the standard approval path can't complete until a vendor is integrated. **P2 (launch).**
3. **Contract disclosures are literally marked "DRAFT — do not use in production."** Every generated PDF embeds uncertified Qatar consumer-credit text. Must be replaced with counsel-certified wording before any real contract is issued. **P2 (legal, must-fix pre-launch).**

Plus polish: i18n gaps on several ops screens (dealer inventory/quotes, some admin pages), loading-vs-empty-state conflation in ops tables, no frontend/E2E tests (all six apps' UI fixes are unprotected by automation), and a stray `schema.prisma.wip` to delete.

**Overall Production-Readiness Score: 7.0 / 10 — Strong production system** — with the honest caveat that go-live to real customers is gated by the three launch dependencies above, which are integration/legal work, not engineering defects.

---

## 2. Verification summary — Rev 2 findings

| Rev 2 finding | Status | Evidence |
|---|---|---|
| **P0-R1 Lifecycle cross-tenant IDOR** | ✅ **FIXED + tested** | `assertCompanyScope` at `applications-lifecycle.service.ts:109/265/310/397/470`, read-scope `:581`; regression integration test for cross-company approve/activate/transition/contract |
| **P1-1 Unbounded KYC/contract uploads** | ✅ **FIXED** | `multerUploadOptions()` on all three interceptors (`applications.controller.ts:122,159,170`); 413 handler |
| **P1-2 Waive breaks DB CHECK** | ✅ **FIXED + tested** | `payment-ledger.ts:32-34` counts waive → `paid+remaining=amount`; `payment-ledger.spec.ts` + `waive` integration test |
| **P1-3 Down-payment dead-ends** | ✅ **FIXED + tested** | real `recordDownPayment` (`:382`), transition edge (`application-transitions.ts:28`), `assertDownPaymentSatisfied` still gates; `down-payment` integration test |
| **P1-4 No ErrorBoundary** | ✅ **FIXED** | `Sentry.ErrorBoundary` in `app-bootstrap.tsx:46-57` wraps all six apps |
| **P1-5 Pay-online double-submit** | ✅ **FIXED** | `useMutation` + `disabled={isPending}` (`ApplicationDetailPanel.tsx:146-165`) |
| **P1-6 System-actor FK (cron spam/abort)** | ✅ **FIXED + tested** | `ensureSystemUser` at boot + migration `20260828`; `jobs` integration test |
| **P2 MFA enforcement** | ✅ **FIXED** | server-enforced in `guards.ts:82-89` (global guard); `guards-mfa.spec.ts` |
| **P2 Compliance on direct-activate** | ✅ **FIXED** | direct branch now runs `assertPassedForApproval` + requires contract (`:483-489`) |
| **P2 Zoho-failures / metrics scope** | ✅ **FIXED** | `opsCompanyFilter` on zoho/failures; `/metrics` restricted to admin/super_admin |
| **P2 S3 mandatory in prod** | ✅ **FIXED** | `storage.service.ts:43-66` fail-fast |
| **P2 401 latch reset** | ✅ **FIXED** | resets on `/auth/*` (`api.ts:44-46`) |
| **P2 Dealer CompanyPage raw JSON** | ✅ **FIXED** | fielded showroom view (`dealer/main.tsx:768-876`) |
| **P2 Backup/DR runbook** | ✅ **FIXED (good)** | `docs/BACKUP_DR.md` — PITR, restore drill, ledger-invariant check |
| **P2 request-id middleware** | ✅ **FIXED + tested** | `common/request-id.ts` (logs + Sentry + header) |
| **P2 Missing tests (waive/down-payment/cron/lifecycle-scope)** | ✅ **FIXED** | new integration suites wired into CI |
| **i18n ops apps** | ⚠️ **PARTIAL** | credit/super-admin/most admin done; dealer inventory/quotes + admin products/offers/ledgers + finance dialogs still English |

Every Rev 2 P0/P1 is closed. No regression detected. This is unusually clean remediation.

---

## 3. Remaining Findings (all P1-launch / P2 / P3 — no open P0)

**R1 — Online payment gateway not wired (P1, feature/launch, VERIFIED).** `verifyAndComplete` throws `NotImplemented` (`payments.service.ts:504`); the returned `redirect_url` is just the marketplace return URL, not a SkipCash hosted page; prod completion 403s. Customer "Pay online" can't complete in prod. Correctly fail-closed (no fake payments). *Fix:* integrate SkipCash create-payment + webhook signature verification; return the real gateway redirect. Manual finance recording works meanwhile.

**R2 — KYC/AML compliance provider is a stub (P2, launch, VERIFIED).** `compliance-provider.stub.ts` throws; the dev provider is disabled in prod. Gate is real and fail-closed, so the standard approval path can't complete in prod until a vendor is wired. *Fix:* implement a real provider; add a boot health-check that flags "stub compliance provider in production."

**R3 — Contract disclosures marked DRAFT / uncertified (P2, legal must-fix, VERIFIED).** `contract-disclosures.ts:8` renders "DRAFT — PENDING COUNSEL CERTIFICATION. Do not use in production" into every contract PDF. *Fix:* replace with counsel-certified Qatar consumer-credit text; add a guard that blocks contract generation while the DRAFT marker is present.

**R4 — Signed-contract integrity check trusts PDF metadata, not visible content (P3, VERIFIED).** `verifySignedContractReferencesOriginal` checks only Subject/Keywords for the fingerprint, so a customer could alter visible amounts in the PDF body while keeping metadata intact. *Mitigation:* server's source of truth for terms is the pricing snapshot, not the uploaded file — so financial terms aren't taken from it; impact is archival mismatch. *Fix:* re-hash canonical terms from the upload or overlay a server-rendered terms page.

**R5 — No frontend / E2E tests (P2, VERIFIED).** API unit + integration coverage is strong (23 unit specs, 6 integration suites), but **all six apps have zero component/E2E tests** — none of the round 1–3 frontend fixes (pay double-submit, 401 latch, ErrorBoundary, quote-redeem→apply, apply wizard, signed-contract upload) are regression-locked. *Fix:* add Playwright covering the critical journeys (register/login/recovery, apply→KYC→submit, approve/reject, pay/session-expiry).

**R6 — Loading vs empty-state conflation in ops tables (P2, VERIFIED).** `OpsDataTable` renders the empty message whenever `rows.length===0` with no loading awareness, so "No applications / No quotes" flashes during initial fetch on slow networks (admin, dealer pages). *Fix:* thread `isLoading` into `OpsDataTable` and show a skeleton first (dealer CompanyPage already does this — use as the pattern).

**R7 — i18n gaps on ops screens (P2/P3, VERIFIED).** Dealer InventoryEditor + QuotesPage, admin Products/Offers/Ledgers, and finance confirm dialogs / payment-method options are still hardcoded English; some pages show raw snake_case enum labels (`pending_finance_activation`) instead of the existing label helpers. *Fix:* route strings through `useOpsLabels` and the status-label helpers.

**R8 — `recordDownPayment` actor-table mismatch (P3, VERIFIED).** The endpoint allows `finance_officer` and calls `transitionApplication` directly, but the declared edge lists actors `['credit','admin']` — the two authorities disagree (not an escalation; recording a down payment is a legitimate finance action). *Fix:* add `finance` to the edge or route through `assertOpsTransitionAllowed`.

**R9 — Stray `schema.prisma.wip` (P3, VERIFIED).** A stale duplicate schema (missing 2FA/lockout/separation-of-duties/pendingWaive fields). Prisma ignores it, but it's a drift hazard. *Fix:* delete it.

**R10 — Destructive ops actions don't validate reason client-side (P3, VERIFIED).** Reject buttons enable without a reason; the server enforces it (tested), so the only cost is a wasted round-trip + a confusing error. *Fix:* disable until reason is non-empty.

**R11 — System user is an active `super_admin` with no credential (P3, VERIFIED).** Cannot authenticate (no account row), so risk is theoretical; consider a dedicated non-privileged system role or an explicit guard that `id='system'` can never hold a credential.

---

## 4. Scorecard (full trajectory)

| # | Category | 19 Aug | 20 AM | **Now** |
|---|---|---:|---:|---:|
| 1 | Product completeness | 4 | 5 | **6** |
| 2 | UX | 5 | 6.5 | **7** |
| 3 | User flows | 5 | 5.5 | **6.5** |
| 4 | Security | 3 | 6 | **8** |
| 5 | Authentication | 6 | 8 | **8.5** |
| 6 | Authorization | 3 | 5.5 | **8** |
| 7 | Database | 4 | 7.5 | **8** |
| 8 | API / backend | 5 | 7 | **7.5** |
| 9 | Frontend / mobile | 5 | 6.5 | **7** |
| 10 | Performance | 5 | 6 | **6.5** |
| 11 | Testing | 2 | 6.5 | **7.5** (API); FE/E2E still 0 |
| 12 | DevOps | 2 | 7 | **7.5** |
| 13 | Monitoring | 1 | 6 | **7** |
| 14 | Reliability | 3 | 5.5 | **7** |
| 15 | Scalability | 4 | 6 | **6.5** |
| 16 | Admin / operations | 6 | 6.5 | **7** |
| 17 | Notifications | 3 | 6 | **6.5** |
| 18 | Analytics | 1 | 6.5 | **6.5** |
| 19 | Documentation | 6 | 6.5 | **7** |
| 20 | Fintech readiness | 2 | 5.5 | **6.5** |

**Overall: 3.6 → 6.0 → 7.0 / 10 — Strong production system**, gated for go-live by the three launch dependencies (gateway, KYC/AML vendor, certified contract text).

---

## 5. Priority Roadmap (what's left)

**Phase 1 — Launch dependencies (blocks real customers; mostly integration/legal):**
1. Wire the **SkipCash gateway** — create-payment + hosted redirect + **webhook signature verification** in `verifyAndComplete` (R1).
2. Integrate a **real KYC/AML provider** behind the existing compliance interface; add a prod boot health-check that flags the stub (R2).
3. Replace **contract disclosures** with counsel-certified text + a guard blocking generation while DRAFT (R3).

**Phase 2 — Hardening & confidence:**
4. **Playwright E2E suite** for the critical journeys (R5) — the biggest remaining test gap.
5. **Loading states** in `OpsDataTable` (R6); finish **ops i18n** + raw-enum labels (R7).
6. Strengthen **signed-contract verification** beyond metadata (R4); align the **down-payment actor table** (R8); delete `schema.prisma.wip` (R9).

**Phase 3 — Polish:**
7. Client-side reason validation (R10); system-user role hardening (R11); reconciliation reporting; refunds/early-settlement; the listing-card estimator unification and remaining unbounded reference lists from Rev 2 P3.

---

## 6. Top 10 (this round)

1. **Wire the payment gateway** (with webhook signature verification) — the one feature that makes the product actually transactable.
2. **Integrate a real KYC/AML provider** — unblocks the approval path and satisfies the QFC AML obligation.
3. **Certify the contract disclosures** — no real contract can issue with a "DRAFT — do not use" stamp.
4. **Add a Playwright E2E suite** — lock the frontend fixes that three rounds produced.
5. **Fix loading-vs-empty states** in ops tables — small change, real perceived-quality win.
6. **Finish ops i18n + enum labels** — consistency for Arabic users on the back office.
7. **Harden signed-contract verification** beyond PDF metadata.
8. **Delete `schema.prisma.wip`** and align the down-payment actor table — remove drift/ambiguity.
9. **Add a prod boot health-check** that fails or loudly warns when the compliance provider or gateway is still a stub — so a stub never silently ships as "ready."
10. **Add reconciliation reporting** (bank-statement/gateway ↔ ledger) — the next fintech-maturity step once money actually moves.

---

*Rev 3, 20 Aug 2026. Three rounds of remediation have moved this from Early product to a Strong production system with a clean, tested financial core and no open P0 or security/integrity P1. Remaining work is dominated by three fail-closed launch dependencies (payment gateway, KYC/AML vendor, certified legal text) plus frontend test coverage and UX polish — none of which are architectural defects. Re-verify after the gateway and compliance vendor are wired, since those introduce the first real external money/PII flows.*
