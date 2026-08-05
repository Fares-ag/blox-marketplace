# 09 — Acceptance Test Matrix

**Product:** DriveMarket  
**Related:** [`07_BUILD_PHASES.md`](07_BUILD_PHASES.md) · [`05_API_RPC_CONTRACT.md`](05_API_RPC_CONTRACT.md) · [`03_DOMAIN_MODEL.md`](03_DOMAIN_MODEL.md) · [`11_DESIGN_GUIDELINES.md`](11_DESIGN_GUIDELINES.md)

Mark each case Pass / Fail / Blocked. Do not declare a phase complete with open Fail on must-pass cases.

**Legend:** M = manual · A = automated (Vitest/Playwright/SQL) · P = phase introduced

---

## Phase 0

| ID | Type | Case | Expected | P |
|----|------|------|----------|---|
| P0-01 | M | `supabase db reset` | Applies clean; no error | 0 |
| P0-02 | M | Start marketplace :5173 | App loads | 0 |
| P0-03 | M | Start dealer/credit/finance/admin/super-admin | Ports from `04` | 0 |
| P0-04 | M | Login seeded customer on marketplace | Dashboard/shell | 0 |
| P0-05 | M | Customer token on dealer app | Redirect `not_dealer` | 0 |
| P0-06 | M | Login admin on admin app | Shell loads | 0 |
| P0-07 | A/M | `--dm-*` CSS variables present | Inspect computed styles | 0 |
| P0-08 | M | Marketplace home composition | Brand + headline + support + CTA + full-bleed image; no stat strip in first viewport (`11`) | 0 |
| P0-09 | M | Primary font | Not Inter/Roboto/Arial/system as primary | 0 |
| P0-10 | A | No `SERVICE_ROLE` in Vite env examples | Grep clean | 0 |
| P0-11 | A | Typecheck + lint | Exit 0 | 0 |

---

## Phase 1

| ID | Type | Case | Expected | P |
|----|------|------|----------|---|
| P1-01 | M | Dealer creates draft listing | Saved `draft` | 1 |
| P1-02 | M | Publish without images | Blocked validation | 1 |
| P1-03 | M | Publish with required fields + image | `published`; `published_at` set | 1 |
| P1-04 | M | Guest `/vehicles` | Listing visible | 1 |
| P1-05 | M | Facets filter make/year/price | Result set correct | 1 |
| P1-06 | M | Detail calculator | Monthly estimate renders with numeric font | 1 |
| P1-07 | M | Apply while logged out | Auth gate + returnUrl | 1 |
| P1-08 | M | Unverified email apply | Blocked verify screen | 1 |
| P1-09 | M | Submit apply with docs | `under_review`; docs in Storage | 1 |
| P1-10 | M/A | Listing after apply | `reserved`; absent from search | 1 |
| P1-11 | M/A | Second apply same customer | `blocking_application_exists` | 1 |
| P1-12 | M | Dealer sees lead | App listed on stock; no status controls | 1 |
| P1-13 | M | Credit queue | Sees new app in scope | 1 |
| P1-14 | M | Credit reject | `rejected`; listing back `published` | 1 |
| P1-15 | M | Credit resubmission | Customer notified; can return `under_review` | 1 |
| P1-16 | A | Public product payload | No VIN, no QID, no KYC paths | 1 |
| P1-17 | M | Reserved detail as other user | Unavailable / 404 | 1 |
| P1-18 | M | Reserved detail as applicant | Pending financing visible | 1 |
| P1-19 | M | Admin creates company + dealer | Dealer can log in | 1 |
| P1-20 | M | Visual QA marketplace home + detail | Checklist in `11` | 1 |

---

## Phase 2

| ID | Type | Case | Expected | P |
|----|------|------|----------|---|
| P2-01 | M | Approve with contract | `contract_signing_required`; contract available | 2 |
| P2-02 | M | Upload signed PDF | `contracts_submitted` | 2 |
| P2-03 | M | Contract under review → pending activation | Status path per matrix | 2 |
| P2-04 | M | Activate | `active`; schedules N rows; listing `sold` | 2 |
| P2-05 | A/M | Activate twice | Idempotent; schedules not duplicated | 2 |
| P2-06 | M | Finance user activate attempt | Forbidden | 2 |
| P2-07 | M | Direct activate with flag false | `direct_activate_disabled` | 2 |
| P2-08 | M | Direct activate with flag true | `active` + schedules | 2 |
| P2-09 | M | Customer cancel `under_review` | `submission_cancelled`; unreserve | 2 |
| P2-10 | M | Cancel after contract required | Forbidden in MVP | 2 |
| P2-11 | M | Dealer unpublish reserved | `listing_has_active_financing` | 2 |
| P2-12 | M | Invalid transition UI/RPC | `invalid_status_transition` | 2 |
| P2-13 | M | Activity log entries | Present for transitions | 2 |
| P2-14 | A | Transition matrix unit tests | Allowed/denied edges | 2 |

---

## Phase 3

| ID | Type | Case | Expected | P |
|----|------|------|----------|---|
| P3-01 | M | `can_pay=false` pay attempt | `company_cannot_pay` | 3 |
| P3-02 | M | Sandbox SkipCash pay | Redirect; return; schedule `paid` | 3 |
| P3-03 | A/M | Webhook replay | No double payment; 200 idempotent | 3 |
| P3-04 | M | Verify path alone | Completes if webhook delayed | 3 |
| P3-05 | M | Amount mismatch | Fail closed; monitor log | 3 |
| P3-06 | M | Bank transfer mark paid (ops) | Schedule paid + reference | 3 |
| P3-07 | M | Reminder cron dry run | Outbox/notification rows | 3 |
| P3-08 | M | Receipt UI | Shows amount QAR tabular | 3 |
| P3-09 | A | Secrets not in client bundle | Grep build artifacts | 3 |

---

## Phase 4

| ID | Type | Case | Expected | P |
|----|------|------|----------|---|
| P4-01 | M | Credit scope assigned | Only assigned companies visible | 4 |
| P4-02 | M | Finance scope assigned | Same for finance | 4 |
| P4-03 | M | Finance mark paid | Works; no Activate control | 4 |
| P4-04 | M | Dealer note | Visible to ops; customer policy as designed | 4 |
| P4-05 | M | Outbox failure retry | attempts increment; eventual sent/failed | 4 |
| P4-06 | M | Settlement discount optional | If implemented, math matches settings | 4 |

---

## Phase 5

| ID | Type | Case | Expected | P |
|----|------|------|----------|---|
| P5-01 | M | Compare 2 vehicles | Side-by-side | 5 |
| P5-02 | M | Compare 3 vehicles | Works; 4th blocked | 5 |
| P5-03 | M | Favorites | Persist per user | 5 |
| P5-04 | M | Featured listing | Appears in featured region below fold or designated slot | 5 |
| P5-05 | M | OG tags on detail | title/image/price present | 5 |
| P5-06 | M | Dealer white-label | Logo + accent on dealer portal only | 5 |
| P5-07 | M | White-label contrast | Reject/warn unsafe accent (`11`) | 5 |
| P5-08 | M | Flutter auth + browse + apply | Parity checklist | 5 |
| P5-09 | M | Flutter pay sandbox | Optional if Phase 3 APIs stable | 5 |

---

## Cross-cutting (run every phase that touches UI)

| ID | Type | Case | Expected |
|----|------|------|----------|
| X-01 | M | Focus rings visible | Keyboard tab through primary flows |
| X-02 | M | Reduced motion | No jarring motion when preference set |
| X-03 | M | RTL token hooks | Logical properties used on new layouts |
| X-04 | M | Status chip colors | Match semantic tokens in `11` |
| X-05 | M | No emoji-as-UI | Icons from icon set only |

---

## Suggested automation priority

1. SQL/RPC tests: blocking application, reservation, transition matrix, activate idempotency, payment idempotency.  
2. Vitest: calculator pure functions; error code mapping.  
3. Playwright smoke (staging): login → publish → apply → approve → activate.  
4. Playwright pay (sandbox): one installment success + webhook replay.
