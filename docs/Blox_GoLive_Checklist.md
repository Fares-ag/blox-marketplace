# Blox / DriveMarket — Go-Live Readiness Checklist (Offline-First Launch)

One page to run against before the first real customer. Reflects the decision to **launch with offline payments only** (cash, cheque, card-POS, bank transfer) and **defer the online gateway**. Status as of the Rev 3 audit + the offline-first direction.

Legend: ✅ done · 🟡 in progress / partial · ⬜ not started · 🔒 blocker for go-live

---

## 1. Security & authorization
- ✅ Cross-tenant IDOR closed on all per-record handlers (regression-tested)
- ✅ MFA server-enforced for privileged roles; login lockout; logout-all
- ✅ Rate limiting, Helmet/CSP, security headers on API + all portals
- ✅ Uploads size-limited; storage keys server-generated
- 🔒⬜ **Open redirect in auth `returnUrl`** — validate same-origin (Prompt A1)
- 🔒⬜ **Dependency CVEs** — patch react-router + `npm audit fix` (Prompt A1)
- ⬜ Rotate the Vercel token in `.env.local`; confirm it was never committed
- ⬜ **Third-party penetration test** (before real money/PII) — a static audit is not a pen test

## 2. Financial integrity (offline rail)
- ✅ Append-only PaymentEvent ledger; row locks; guarded transitions; dual-control waive; separation of duties
- ✅ Down-payment recorded + enforced; waive invariant correct
- 🔒⬜ **Cheque clearance lifecycle** — a cheque must not count as paid until cleared; bounce un-settles (Prompt B2). This is the offline-first must-fix.
- ⬜ Structured payment methods (cash/cheque/card_pos/bank_transfer) with method-specific fields (Prompt B2)
- ⬜ Offline payment **receipts** + cheque-received acknowledgement (Prompt B3)
- ⬜ **Reconciliation** report (per-method, pending-cheque aging, bank-deposit matching, CSV) (Prompt B4)
- ⬜ Cheques-pending-clearance aging job (Prompt B2)

## 3. Payments configuration
- 🔒⬜ **`PAYMENTS_ONLINE_ENABLED=false`** and no "Pay online" button shown; SkipCash endpoints 404; customers see offline-payment guidance (Prompt B1)
- ✅ Manual/offline `recordPayment` works (company-scoped, SoD, ledgered)

## 4. Compliance & legal (launch blockers)
- 🔒⬜ **Real KYC/AML provider** wired (currently a fail-closed stub — approvals can't complete in prod until done) (Rev 3 R2)
- 🔒⬜ **Prod boot guard** that fails/loudly warns when compliance provider is still a stub (Rev 3 R2)
- 🔒⬜ **Counsel-certified contract disclosures** — replace the "DRAFT — do not use in production" text; block generation while DRAFT marker present (Rev 3 R3)
- ⬜ QFC licensing / Qatar Credit Bureau membership status confirmed (per the KYC build plan)
- ⬜ PDPPL/QFC DPR posture for KYC + financial data documented; retention/deletion path verified

## 5. Reliability & data
- ✅ Migrations reconciled; run as Railway pre-deploy (not boot CMD)
- ✅ System user seeded (cron FK fixed); email outbox; background jobs
- ✅ Backup/DR runbook written
- 🔒⬜ **Confirm Railway PITR/backups are actually ENABLED** (a runbook ≠ an enabled backup) and run the restore drill once for real
- ⬜ Verify prod secrets/env are set: S3 buckets (mandatory in prod), SMTP, DB URL, auth secret

## 6. Quality & release
- ✅ CI: typecheck, real ESLint, unit + integration tests, build
- ✅ Strong API test coverage (unit + integration, incl. regression locks)
- ⬜ **Playwright E2E** for the critical journeys — now including **offline payment recording + cheque clear/bounce** instead of online pay (Rev 3 R5)
- 🟡⬜ Pricing→CJS build hygiene: prebuild hook + CI exercises the compiled artifact (Prompt A2)
- ⬜ Delete `schema.prisma.wip`

## 7. Observability
- ✅ Sentry (API + frontends), request-id correlation, health/readiness probe, job-health tracking
- ⬜ Alerting wired to a channel the team actually watches (email/Slack/pager) for: readiness failures, job failures, email-outbox backlog, cheque-clearance aging
- ⬜ Confirm someone is paged if it breaks at 2 a.m.

## 8. UX / product (not blockers, but customer-visible)
- ✅ ErrorBoundary, 401/session-expiry handling, pay-button guard, dealer profile page
- ⬜ Loading-vs-empty states in ops tables
- ⬜ Ops i18n (dealer inventory/quotes, some admin pages, finance dialogs) + raw enum labels
- ⬜ Signed-contract verification beyond PDF metadata

---

## The short version — what's actually blocking go-live (🔒)

1. **KYC/AML provider** wired + prod stub-guard (compliance).
2. **Certified contract disclosures** (legal).
3. **Cheque clearance lifecycle** — offline money must be modeled correctly (financial integrity).
4. **Open redirect + dependency patches** (security — quick).
5. **Gateway cleanly disabled** so customers aren't shown a dead pay button.
6. **Confirm backups are enabled** + one real restore drill.
7. **A pen test** before handling real customer money/PII.

Everything else (Playwright, reconciliation, receipts, i18n, polish) is strongly recommended and should follow quickly, but items 1–7 are the gates. With the gateway deferred, this is a materially shorter list than a card-payments launch would be — the hard remaining work is compliance/legal and getting cheques right.
```

