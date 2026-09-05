# Intensive QA — blox-marketplace (DriveMarket) — 2026-09-05

Mode: READ / RUN / REPORT. No product code was changed during this run. The run exercised the
**uncommitted working tree** that contains the portal-parity implementation from 2026-09-04
(43 modified/new files, see `docs/PORTAL_PARITY_MATRIX_2026-09-04.md` §6).

## 1. Verdict

**At audit time: NO-GO (narrow).** One core end-to-end journey was broken in the UI: **new customer
registration**. Everything else that was exercised worked and the six portals are aligned and talking
to the same API state.

**After fixes (same day, see §10): GO for local.** All nine defects below plus one found while fixing
(D10) are corrected in the working tree and re-verified end to end (30/30 checks, §10). The changes are
uncommitted and have not been deployed.

| Area | Raw | Adjusted* | Notes |
|---|---|---|---|
| Part 1 — Auth, email verification, forgot/reset, sessions, invites (API) | 26/28 | 27/28 | A6 real (D2); C3 harness artifact |
| Part 1b — Same journeys through the real UI (Playwright) | 2/3 | 2/3 | Register UI fails (D1/D2); forgot→reset→login passes |
| Part 2 — Application lifecycle, payments, settlements, credits, companies, quotes, RBAC (API) | 104/108 | 107/108 | J2/J3/J11 = separation of duties working as designed; I2 real (D4) |
| Part 3 — Cross-portal UI alignment, 6 portals + role isolation (Playwright) | 47/50 | 49/50 | 2 heuristic misses; MK detail gap real (D6) |
| Part 3b — Finance portal Arabic on new screens | 4/4 | 4/4 | RTL, translated, no raw keys |
| Email delivery (Mailpit) + outbox retry worker | pass | pass | verification, reset, walk-in invite; 4/4 retried after backoff |

\*Adjusted = harness-caused or by-design failures removed; real defects still counted as failures.

## 2. Environment

- API `http://localhost:3010` (built `dist`, `REQUIRE_EMAIL_VERIFICATION=true`, `COMPLIANCE_PROVIDER=synthetic`,
  `RATE_LIMIT_AUTH_MAX=5000`, `SMTP_HOST=localhost SMTP_PORT=25 → Mailpit`).
- Portals (Vite): marketplace 5173, admin 5174 (`/main`), super-admin 5175, dealer 5176, credit 5177, finance 5179.
- Mailpit container `qa-mailpit` (UI 8025, SMTP 25). 16 messages captured.
- Postgres local, migrations applied incl. `20260904000000_add_application_settlements` and
  `20260904000001_add_missing_catalog_credit_tables`.
- Harness: `C:/Users/TS/AppData/Local/Temp/qa/` — `qa-auth-email.mjs`, `qa-lifecycle.mjs`,
  `qa-ui-crossportal.mjs`, `qa-ui-recheck.mjs`, `qa-ui-recheck2.mjs`; results in `results-*.json`;
  screenshots in `ui/`.
- Seed accounts `*@drivemarket.local` / `Password123!` plus QA-created users, companies, listings and
  applications (ids in `results-lifecycle.json`). QA data remains in the local DB.

## 3. Part 1 — Authentication and email (API-level)

| # | Case | Result |
|---|---|---|
| A1–A3 | Sign-up 200, no session issued, unverified sign-in → 403 `EMAIL_NOT_VERIFIED` | PASS |
| A4–A5 | "Verify your Blox email address" delivered with verify link | PASS |
| A6 | Verify link redirects to marketplace | **FAIL** → redirects to `http://localhost:3010/` (API 404 JSON). See D2 |
| A7–A9 | Verified sign-in 200, `/me` shows `email_verified=true role=customer`, wrong password 401 | PASS |
| B1–B4 | request-password-reset 200, reset mail delivered, link resolves to `/auth/reset-password?token=` | PASS |
| B5–B9 | Reset 200, old password 401, new password 200, token single-use, prior session revoked | PASS |
| B10 | Reset for unknown email → 200 (no enumeration) | PASS |
| C1 | Sign-in without `Origin` → 403 (CSRF) | PASS |
| C2, C4 | Seed sessions valid; `mfa_required` / `two_factor_enabled` present for credit/finance/admin/super | PASS |
| C3 | revoke-all → next `/me` 401 | FAIL in harness only: the 5-minute `session_data` cache cookie still answers. Sending the token-only cookie confirms revocation. See D7 |
| D1–D2 | Dealer invites walk-in agent → invite email delivered | PASS |

## 3b. Same journeys through the real UI

| Journey | Result | Observed |
|---|---|---|
| Register at `/auth/register` | **FAIL** | Form has name/email/password only. After submit the page stays on `/auth/register` and shows **"Authentication is required."** The verification email *is* sent. Clicking its link lands on `http://localhost:3010/` → `{"error":{"code":"not_found"…}}`. Better Auth did create a session, so manually opening `/app/dashboard` afterwards works. |
| Forgot password at `/auth/forgot-password` → mail → `/auth/reset-password?token=` → login | PASS | Reset page accepts new password, shows done state (no redirect), login with the new password lands on `/app/dashboard`. |
| Resend verification from `/auth/verify-email` | PASS (code path sends `callbackURL`) | Only the initial sign-up omits it. |

## 4. Part 2 — Lifecycle, money flows and portal alignment (API)

All groups ran against the same data set so cross-portal consistency could be checked afterwards in the UI.

| Group | Pass | What it covered |
|---|---|---|
| E Offers | 3/3 | admin lists/edits offers, customer sees published only |
| F Inventory | 8/8 | dealer draft → images → publish; reserved/sold visibility |
| G Application intake | 8/8 | apply + documents + submit → `under_review`; ops notified |
| H Credit/finance decisions | 18/18 | compliance gate before approve-for-finance; UR→PFA; PFA→REJ/UR; contract send/sign; CSR→RS; DPR/DPS; admin reopen; listing release/re-reserve; `vehicle_unavailable` 409 when sold |
| I Resubmission | 14/15 | I2 **FAIL**: customer DTO has no reason for `resubmission_required` (D4) |
| J Payments | 12/15 | credit marks paid, bank pending/confirm, paid-schedule refused; J2/J3/J11 403 `separation_of_duties` because the same finance user approved the application — by design, not a defect. Dual-control waive passes |
| K Settlements | 12/12 | customer request → finance approve/reject (reason required) → `ops/settlements` list |
| L Companies & agents | 14/14 | admin creates company, group_admin scoping, `opsCompanyFilter` denies cross-company reads |
| M Quotes | 4/4 | dealer quote → customer sees → converts |
| N RBAC negatives | 11/11 | customer/dealer denied on ops endpoints, finance denied `activate`, credit denied settlements approve |

## 5. Part 3 — Cross-portal UI (Playwright, real logins)

| Portal | Pass | Highlights |
|---|---|---|
| Finance (5179) | 18/18 | lands on `/queue`; Activation (view-only) / Review tabs; Active book; Payments (Schedules/Transactions/Bank); Settlements shows approved row; Credits adjust; Exports CSV downloads; no Activate button; `/applications/view/:id` alias; `/schedules` → `/payments`; zero console errors |
| Credit (5177) | 6/6 | Pipeline/Rejected; Approve for finance + Approve & send contract; no admin-only Activate; mark-paid controls on active app |
| Dealer (5176) | 4/6 | inventory, quotes, back-link pass. Two "FAIL"s were regex heuristics (tab labels matched `Approve|Reject`; list text keyed on a name not rendered); manual screenshot review confirms the lead view is read-only |
| Admin (5174) | 7/7 | `/main` base path wiring, Activate (admin) absent on active app, promotions / insurance rates / settlement discounts load (drift migration OK) |
| Super-admin (5175) | 2/2 | activity logs show `status_transition` and settlement events from this run |
| Customer (5173) | 5/6 | applications list, notifications, calendar, sold listing state pass; **application detail shows no schedule/payments** while dashboard and calendar do (D6) |
| Role isolation | 5/5 | wrong-portal logins bounce with `?reason=not_dealer|not_credit|not_finance|not_admin|not_super_admin` and the session is revoked server-side |
| Finance Arabic | 4/4 | `/queue /settlements /credits /book` render `dir=rtl`, Arabic text, no raw `ops.*` keys |

Cross-portal communication check: the application created by the customer appeared in dealer
Applications, credit Queue, finance Activation/Review, admin Applications and super-admin activity logs
with the same status at each step; payments recorded in credit showed in finance Payments and the
customer calendar; the settlement requested by the customer appeared in finance Settlements.

## 6. Defects

| ID | Sev | Defect | Evidence / location |
|---|---|---|---|
| D1 | **P1** | Register UI shows "Authentication is required." after a successful sign-up. `signUp` posts to `sign-up/email` and then immediately calls `/api/me`; with `requireEmailVerification` no session cookie exists yet, so the 401 is surfaced as an error and the user is never routed to `/auth/verify-email`. | `packages/shared/src/auth/auth-store.ts:193-215`, `packages/shared/src/auth/LoginPage.tsx:221-229` |
| D2 | **P1** | Verification link from the sign-up email lands on the API root (`/` → 404 JSON) because sign-up sends no `callbackURL`. The resend path does send one, so only the first email is affected. | `auth-store.ts:200` vs `LoginPage.tsx:543`; A6 |
| D3 | P2 | Staff notifications are written (credit 29, dealer 27, admin 29 unread) but no ops portal renders them; finance receives none because `notifyOpsOnSubmit` targets credit/dealer/admin only, and scoped credit officers are excluded. Link is `/applications/:id`, which is wrong under the admin `/main` base. | `packages/api/src/applications/applications.service.ts:789-800`; `BloxShell.tsx` has no notifications UI |
| D4 | P2 | Reason given with `resubmission_required` is stored in `statusReason` (ops-only) and `resubmissionComment` is only set for `contract_signing_required`, so the customer never sees why they must resubmit. | `applications-lifecycle.service.ts:391-394`; I2 |
| D5 | P2 | Finance cannot complete a solo flow: the finance user who approved an application is refused on mark-paid / confirm-bank (`separation_of_duties`). Correct control, but the finance Payments UI offers the buttons and only errors on click. Suggest hiding/disabling with a hint. | `payments.service.ts`; J2/J3/J11 |
| D6 | P3 | Customer application detail for an active application shows no schedule, next contribution or paid state; the dashboard and calendar do. | MK detail; screenshot `ui/customer-application.png` |
| D7 | P3 | Session revocation (revoke-all, password reset, wrong-portal bounce) takes up to 5 minutes to bite for clients holding the `session_data` cache cookie. | Better Auth cookie cache; C3 |
| D8 | P3 | Reset-password success shows a done state but does not redirect or offer a sign-in link prominently; users must navigate to login themselves. | `LoginPage.tsx:428` |
| D9 | P3 (dev-ex) | Mail transport forces STARTTLS on any non-25 non-secure port (`requireTLS: !secure && port !== 25`), so plain local SMTP sinks on 1025 fail with 502; documented workaround is mapping Mailpit to port 25. | `packages/api/src/mail/mail.service.ts` |

No P0 found. Nothing in the parity implementation (transitions, finance routes, settlements, credits,
base-path wiring, i18n) failed.

## 7. Not a bug / harness artifacts

- C3 revoke-all "200 after revoke": probe kept the `session_data` cache cookie. Token-only request returns 401.
- J2/J3/J11: separation of duties correctly refusing the approver. Re-running with a different finance user passes.
- DL heuristics: dealer lead view has tab buttons whose labels matched the negative regex; visually read-only.

## 8. Not covered

- SkipCash live callbacks (only synthetic `pay` path), M2P, Zoho CRM push (no credentials used), Supabase/Flutter.
- MFA enrolment UI (only the `/me` flags), production rate limiter behaviour (raised locally), Arabic on non-finance portals beyond spot checks.
- Load/perf.

## 9. Recommended fix order (as written before fixing)

1. D1 + D2: pass `callbackURL: ${origin}/auth/verify-email` in `signUp`, and treat a 401 from `/api/me` after sign-up as "verification pending" → navigate to `/auth/verify-email`.
2. D4: copy `reason` into `resubmissionComment` for `resubmission_required` too.
3. D3: add finance to `notifyOpsOnSubmit`, make the link base-path aware, and add a notifications entry to the ops shell (or drop staff notifications).
4. D5, D6, D8 UX follow-ups; D7 accept or shorten cookie cache; D9 relax `requireTLS` for localhost.

## 10. Fixes applied and re-verified (2026-09-05, uncommitted)

| ID | Fix | Where |
|---|---|---|
| D1 | `signUp` sends `callbackURL`, reads Better Auth's `token`; `token: null` returns `pendingVerification` instead of probing `/api/me`. Register page routes to `/auth/verify-email?email=…`; the verify page renders a session-less "account created, check your inbox" state with resend, sign-in and start-again links (EN/AR). | `packages/shared/src/auth/auth-store.ts`, `LoginPage.tsx`, `i18n/locales.ts` |
| D2 | Covered by the `callbackURL` above; link now 302s to `/auth/verify-email` and auto-signs in. | same |
| D3 | `notifyOpsOnSubmit` now targets finance officers (global and company-assigned) and company-assigned credit officers too. New `ShellNotifications` in `BloxShell`: badge with unread count (polled every 60 s), popover list, mark-read on click, links resolved through the portal base path (admin `/main`). | `packages/api/src/applications/applications.service.ts`, `packages/shared/src/components/BloxShell.tsx`, locales |
| D4 | `resubmissionComment` is set for `resubmission_required` as well as `contract_signing_required`; `statusReason` stays ops-only. | `applications-lifecycle.service.ts` |
| D5 | Ops detail DTO gains `separation_of_duties_blocked` (approver detected from activity logs, company flag honoured). Workspace passes a reason to `InstallmentScheduleTable`, which disables Mark paid and shows the explanation. API still returns 403. | `applications.service.ts`, `ops-applications/types.ts`, `ApplicationWorkspace.tsx`, `InstallmentScheduleTable.tsx`, locales |
| D6 | Root cause was a shape mismatch: the API returns snake_case, the customer pages read camelCase, so pricing, schedules, reasons and documents never rendered on the detail page. Added `normalizeCustomerApplication` at the fetch boundary (detail page, dashboard list and spotlight). | `packages/marketplace/src/lib/application-dto.ts`, `AppRoutes.tsx`, `CustomerDashboardPage.tsx` |
| D7 | Session cookie cache default lowered from 300 s to 60 s (env still overrides); spec and `.env.example` updated. | `packages/api/src/auth/auth-config.ts` |
| D8 | Reset success redirects to `/auth/login?reason=password_reset` with a banner. | `LoginPage.tsx` |
| D9 | `resolveSmtpRequireTls`: STARTTLS required only on submission ports against remote hosts; skipped on port 25 and for localhost/127.0.0.1; `SMTP_REQUIRE_TLS=true|false` overrides. 4 unit tests added. | `packages/api/src/mail/mail.service.ts`, `smtp-require-tls.spec.ts`, `.env.example` |
| D10 (new) | Mark paid never rendered for live schedule rows in the workspace: the display mapper renames `pending`→`upcoming`, `overdue`→`due`, but the button gate checked the raw names. Rows now carry `liveStatus` and the gate uses it. Payments had only been possible from the finance Payments page. | `packages/shared/src/lib/resolve-display-schedule.ts`, `InstallmentScheduleTable.tsx` |

Verification (API rebuilt and restarted from `dist`, portals on Vite HMR; scripts `qa-fix-verify.mjs`,
`qa-fix-verify-sod.mjs`, screenshots `ui/fix-*.png`):

| Check | Result |
|---|---|
| Register via UI → `/auth/verify-email?email=…`, "account created" copy, mail delivered, link → `/app/dashboard` | PASS |
| Sign-up API returns `token: null`; verify link 302 → `localhost:5173/auth/verify-email` | PASS |
| Forgot → reset via UI → `/auth/login?reason=password_reset` banner → login with new password | PASS |
| New submission: finance unread 0 → 1 with link `/applications/:id`; credit badge 30, popover lists items, click opens app; admin link resolves to `/main/applications/:id` | PASS |
| Credit requests resubmission → customer DTO and detail page show the reason; `status_reason` absent for customer | PASS |
| App A: finance flagged `separation_of_duties_blocked`, credit/admin not; API pay as approver still 403; UI hint shown and 44/44 Mark paid disabled for finance, 44/44 enabled for credit | PASS |
| Customer detail renders QAR pricing and the 48-row payment schedule | PASS |
| Unit tests: API 43 files / 361 tests, shared 5 files / 257 tests; `tsc` clean for api, shared, marketplace, finance, admin, credit; eslint clean on changed files | PASS |
| Cross-portal UI suite re-run | 48/50 (the two remaining are the dealer regex heuristics from §7) |

Not re-run: production, SkipCash live, Zoho, MFA enrolment. Harness artifacts C3 and the dealer
heuristics are unchanged and still not defects.
