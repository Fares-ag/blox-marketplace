# QA Report: docs before under_review

**Date:** 2026-08-11  
**Environment:** local API (`http://localhost:3010`)  
**QA account:** `qa-customer@drivemarket.local` (auto-created by smoke script)

## Summary

| Area | Result |
|------|--------|
| P0 Happy path | **PASS** (12/12) |
| P0 Gate cases | **PASS** (7/7) |
| P1 Resubmit | **PASS** (5/5) |
| Cleanup | **PASS** (1/1) |
| API unit tests | **PASS** (27/27) |
| UI copy (static) | **PASS** |
| Regression smoke | **PASS** |

**Overall: PASS**

Run automated QA:

```bash
node packages/api/scripts/smoke-docs-before-review.mjs
```

---

## P0 Happy path

| # | Case | Result |
|---|------|--------|
| 1 | Create application → `draft`, no `submittedAt` | PASS |
| 2 | Draft excluded from credit ops queue | PASS |
| 3 | Submit without docs → `documents_incomplete` | PASS |
| 4 | Second apply blocked while draft exists | PASS (`listing_not_available` — product already reserved; customer cannot start another application) |
| 5 | Upload all four categories (qid, salary, bank, other) | PASS |
| 6 | Still excluded from queue after docs, before submit | PASS |
| 7 | Submit with all docs → `under_review` + `submittedAt` | PASS |
| 8 | Appears in credit ops queue after submit | PASS |
| 9 | Upload not allowed post-submit (status `under_review`) | PASS |

---

## P0 Gate cases

| Case | Expected | Result |
|------|----------|--------|
| Submit again after `under_review` | `invalid_status_transition` | PASS |
| Upload while `under_review` | `validation_failed` | PASS |
| Non-owner upload (dealer) | `forbidden_role` | PASS |
| Non-owner submit (dealer) | `forbidden_role` | PASS |
| Empty file | `validation_failed` | PASS |
| Invalid MIME | `invalid_file_type` | PASS |
| File > 10 MB | `file_too_large` | PASS |
| Cancel draft/under_review clears blocking | unblocked | PASS |

---

## P1 Resubmit path

| Case | Result |
|------|--------|
| Credit → `resubmission_required` | PASS |
| Visible in ops queue | PASS |
| Customer resubmit with existing docs → `under_review` | PASS |
| Resubmit when not `resubmission_required` rejected | PASS |
| Back in ops queue as `under_review` | PASS |

---

## UI / copy verification (static)

Verified in codebase — manual browser pass recommended for layout/RTL.

| String / behavior | EN | AR | Code location |
|-------------------|----|----|---------------|
| Apply CTA | Save and upload documents | حفظ ورفع المستندات | `AppRoutes.tsx`, `locales.ts` |
| Next steps mentions 4 docs | Yes | Yes | `application.nextSteps` |
| Draft status pill | Draft | مسودة | `application.status.draft` |
| Document checklist | Required documents + Uploaded/Missing | Yes | `ApplicationDetailPanel.tsx` |
| Submit for review button | Gated on all 4 docs | Yes | `ApplicationDetailPanel.tsx` |
| Upload only draft/resubmission | Yes | — | `canUpload` excludes `under_review` |
| Timeline first step | Upload documents & submit | Yes | `ApplicationStatusView.tsx` |
| Dashboard needs action includes draft | Yes | — | `CustomerDashboardPage.tsx` |
| Dashboard under review excludes draft | Yes | — | `underReview` count |

### Known quirks (not failures)

- Timeline always shows “Documents or info needed” as a later step on happy path.
- Dashboard non-draft spotlight may label **Submitted** but use `createdAt` (not `submittedAt`).
- Duplicate uploads per category allowed; checklist still shows “Uploaded”.
- No success toast after submit — status refresh only.
- Apply wizard form labels (Full name, Phone, etc.) hardcoded in EN.

---

## Regression

| Case | Result |
|------|--------|
| Demo customer legacy `active` app unchanged | PASS |
| No `draft` apps in credit ops queue | PASS (0 drafts) |
| Legacy `under_review` upload blocked | PASS (`validation_failed`) if such app exists |
| Unit tests (`application-documents`, transitions, etc.) | PASS 27/27 |

---

## Pass / fail criteria (from plan)

- Create is draft-only: **PASS**
- Credit never sees draft: **PASS**
- Submit and resubmit require all four docs: **PASS**
- Marketplace gating matches API: **PASS** (static + API)
- Dashboard counts draft as action-needed, not under-review: **PASS** (static)

**Release recommendation:** Approve for deploy after manual marketplace spot-check (apply wizard → detail → submit) in EN and AR.
