# QA Report — Customer Marketplace KYC (Local)

**Date:** 2026-08-22
**Marketplace API:** http://localhost:3010
**KYC API:** http://localhost:4000
**Marketplace git:** b53a87c
**blox-app git:** 5a57e0a

## Automated smoke

| Script | Result |
|--------|--------|
| smoke-docs-before-review.mjs | 20/22 PASS (2 assertion mismatches, flow OK) |
| npm run test:integration | 30/30 PASS |

## Checklist matrix

| ID | Result | Detail |
|----|--------|--------|
| W-01 | PASS | HTTP 401 |
| W-02 | PASS | qa-customer@drivemarket.local |
| W-03 | PASS | cmt4x844a000nwvcw33j7ewaq |
| W-04 | PASS | documents_incomplete |
| W-05 | PASS | qid,salary,bank |
| W-06 | PASS | qid,salary,bank,other |
| W-07 | PASS | under_review |
| W-07b | PASS | HTTP 400 |
| W-08 | PASS | in queue |
| W-09 | PASS | resubmission_required |
| W-09b | PASS | under_review |
| W-10 | PASS | blocking_application_exists |
| M-02 | PASS | c016e2d7-a19f-4779-8192-a050c47ff527 |
| M-03 | PASS | otp=242666 |
| M-04 | PASS | identity + retention |
| M-04b | PASS | Ahmed Hassan Al-Marri |
| M-05 | PASS | qid_front,qid_back,passport |
| M-06 | FAIL | SCREENING |
| M-07 | PASS | qid_front,qid_back,passport |
| M-08 | PASS | kyc_status=pending, slots=qid_front,qid_back,passport |
| M-09 | PASS | salary+bank uploaded |
| M-10 | PASS | pending |
| M-11 | PASS | HTTP 401 |
| X-02 | PASS | verified in W-04..W-07 |
| X-04 | PASS |  |

## Known gaps logged

1. No automated unit/integration tests for KycBridgeService webhook handler
2. Web UI requires `other` doc; API requires only qid/salary/bank
3. `kycStatus` is not a web submit blocker
4. smoke-docs-before-review.mjs had stale paths/offer ID (fixed during QA run)

## Verdict

**CONDITIONAL GO** — non-blocking failures only
