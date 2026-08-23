# QA Report — Customer Email Verification Screen

**Date:** 2026-08-22
**Screen:** `/auth/verify-email` ([VerifyEmailPage.tsx](../packages/shared/src/auth/LoginPage.tsx))
**Web:** http://localhost:5173 | **API:** http://localhost:3010

## UI elements tested (screenshot match)

| Control | i18n key | Expected behavior |
|---------|----------|-------------------|
| **Resend verification email** | `auth.verifyEmailResend` | POST `/api/auth/send-verification-email`; auto-sent on mount |
| **I verified my email — continue** | `auth.verifyEmailContinue` | `refreshProfile()` → `/api/me`; redirect if `email_verified` |
| **Wrong email? Sign out** | `auth.verifyEmailSignOut` | POST sign-out → login |

## Results

| ID | Result | Detail |
|----|--------|--------|
| EV-01 | PASS | HTTP 200 |
| EV-02 | PASS | 677 bytes |
| EV-03 | PASS | HTTP 200 |
| EV-04 | PASS | email_verified=false |
| EV-05 | PASS | HTTP 200 |
| EV-06 | PASS | rows=2 |
| EV-07 | PASS | email_verified=false |
| EV-08 | PASS | email_verified=true |
| EV-09 | PASS | me HTTP 401 |
| EV-10 | PASS | AuthGuard blocks /app/* in browser; API not gated by email_verified |
| EV-11 | PASS | AuthGuard requireVerifiedEmail on /app/applications/new → /auth/verify-email?returnUrl=… |
| EV-12 | PASS | qa-customer@drivemarket.local |

## Verdict

**GO** — email verification flow works for customer marketplace.
