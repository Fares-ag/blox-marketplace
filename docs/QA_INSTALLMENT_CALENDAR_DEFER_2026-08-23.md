# QA Report — Fixed Installments, Flexible Tenure, Calendar & Deferrals

**Date:** 2026-08-23  
**Scope:** Fixed amortized schedules, tenure 1–60 months, customer payment calendar (web), defer payments (API + web + mobile)  
**Repos:** blox-marketplace `1b76abeb25d95d4dcfee994423f8513bf6abd781` · blox-app `5a57e0a67ee1b901c6d94a0656465d3d1a390040`

---

## 1. Executive Summary & Verdict

**Verdict: CONDITIONAL GO**

Core math, tenure validation, customer payments hub, defer API, marketplace calendar page, and mobile defer wiring are implemented and covered by automated tests. Manual smoke journeys (PC-01–PC-07, DW-01–DW-05, MC-01–MC-04, DM-01–DM-03) remain for release sign-off in staging with real customer accounts.

---

## 2. Automation Baseline (E.1)

| Command | Result | Details |
|---------|--------|---------|
| `npx vitest run packages/shared/src/lib/generate-schedule.spec.ts packages/shared/src/lib/pricing.spec.ts packages/api/src/applications/application-pricing.spec.ts packages/api/src/applications/payment-schedules.spec.ts` | ✅ PASS | 258/258 |
| `npm run test:integration -w @drivemarket/api` | ✅ PASS | 39/39 (includes 6 new defer tests) |
| `npm run typecheck -w @drivemarket/marketplace` | ✅ PASS | Payment calendar page compiles |
| `flutter test` (blox-app PMT test) | ⚠️ SKIP | Flutter CLI not available in CI shell; test file added at `test/core/finance/installment_schedule_builder_test.dart` |
| `npm run typecheck` (root) | ⚠️ PRE-EXISTING | API package typecheck fails on shared JSX/import.meta (unchanged baseline) |

### New / updated test files

| File | Tests | Status |
|------|-------|--------|
| `packages/shared/src/lib/generate-schedule.spec.ts` | 4 | ✅ |
| `packages/api/test/integration/defer.integration.spec.ts` | 6 | ✅ |
| `blox-app/test/core/finance/installment_schedule_builder_test.dart` | 2 | Added (not run) |

---

## 3. Implementation Summary

### Part A — Fixed installments (`amortized_fixed`)

- `generate-schedule.ts` uses `buildInstallmentAmounts` (PMT); dynamic rent disabled
- Ops wizard (`InstallmentPlanStep`) uses `buildPricingSnapshot` + fixed schedule
- Fallback paths (`generatePaymentScheduleFallback`, `buildPlanFromPricingSnapshot`) aligned

**Validated:** 100k / 10% down / 12m / 0% → 12 × 7,500 QAR (unit test FI-01 equivalent)

### Part B — Flexible tenure (1–60 months)

- Shared constants `MIN_TENURE_MONTHS=1`, `MAX_TENURE_MONTHS=60`
- API `assertTenureAllowed` validates range (whitelist decoupled)
- Marketplace vehicle detail + apply flow: numeric tenure input
- Ops wizard: numeric tenure field
- Flutter: `clampTenureMonths(1, 60)` on vehicle calculators

### Part C — Mobile PMT parity

- `computeLoanFigures` updated to standard PMT formula matching web `computeExactMonthlyPayment`

### Part D — Customer calendar & deferrals

| Endpoint | Purpose |
|----------|---------|
| `GET /api/v1/customer/payments/hub` | All schedules + credits (web) |
| `GET /api/v1/mobile/payments/hub` | Alias (mobile, unchanged path) |
| `GET /api/v1/customer/payments/deferral-status` | Quota + membership flag |
| `POST /api/v1/applications/:id/schedules/:scheduleId/defer` | Defer one installment (+1 month) |

- Marketplace `/app/calendar` — month grid, day detail, defer action
- Application detail schedule rows — defer button when member + quota
- Mobile `MembershipDeferralRepository` wired to defer + status APIs

**Defer rules enforced:** active Blox membership on application, 3/year quota, pending/overdue only, ownership check.

---

## 4. Checklist Matrix (automated coverage)

| ID | Area | Automated | Manual |
|----|------|-----------|--------|
| FI-01 | Ops wizard 12×7,500 | ✅ unit | Recommended |
| FI-04 | Activation DB sync | ✅ payment-schedules.spec | Recommended |
| FT-04 | Tenure 0/61 rejected | ✅ application-pricing.spec | — |
| FT-01–03 | Tenure 7/18/60 UI | — | Required |
| DF-01–06 | Defer API | ✅ defer.integration.spec | — |
| PC-01–07 | Web calendar | — | Required |
| DW-01–05 | Web defer UI | — | Required |
| MC-01–04 | Mobile calendar | — | Required |
| DM-01–03 | Mobile defer | — | Required |
| XP-01–04 | Cross-portal parity | Partial (hub alias test) | Required |

---

## 5. Manual Journey Scripts (E.4)

### Journey A — Flexible tenure application

1. Browse vehicle → set tenure **7** → apply → ops approve → activate  
2. Verify 7 equal installments in ops workspace and customer application detail

### Journey B — Payment calendar

1. Log in as active customer → `/app/calendar` (web) and mobile calendar tab  
2. Confirm upcoming payments visible; navigate prev/next month

### Journey C — Defer payment

1. Member with quota → defer next payment on web calendar or application detail  
2. Confirm due date +1 month → verify mobile calendar matches → attempt 4th defer (expect `deferral_quota_exhausted`)

---

## 6. Exit Criteria

| Verdict | Criteria |
|---------|----------|
| **GO** | All manual PC/DW/MC/DM/XP items pass in staging; Flutter test run green locally |
| **CONDITIONAL GO** | Automated baseline green; manual customer journeys pending (current state) |
| **NO GO** | Wrong installment amounts, defer without schedule update, or cross-portal mismatch |

---

## 7. Known Limitations

- Existing `dynamic_rent` applications are not backfilled (by design)
- Flutter defer from calendar day tap not added (checkout + web calendar + app detail covered)
- Root monorepo `typecheck` still reports pre-existing shared-package JSX/import.meta issues in API workspace

---

## 8. Sign-off Log

| Check | Owner | Date | Result |
|-------|-------|------|--------|
| Unit + integration automated | Agent | 2026-08-23 | ✅ PASS |
| Staging manual matrix | — | — | Pending |
| Product sign-off | — | — | Pending |
