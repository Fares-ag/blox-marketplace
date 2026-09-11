**Status (2026-09-11):** Blox-native Diminishing Musharakah servicing (ownership register, LPO, unit offers, hardship, settlement completion) is built **in-house** in `blox-marketplace`, behind flags that default off. The M2P “do not build LPO/LMS” note below is **superseded** for Model A origination. See `docs/COMPLIANCE_SOT.md` and drivemarket journeys J12–J18.

# BLOX × M2P — Frontend Fit Report

**Document 5 of 5 — Planning pack addendum**  
**Prepared for:** Blox product, frontend, and backend  
**Date:** 2026-09-02  
**Status:** Planning — not an implementation spec for M2P JSON (Pending Item #36 still open)

**Sources**

| # | Document | Role |
|---|----------|------|
| 01 | System Overview & Backend Understanding | Boundaries, statuses, hard gates, LMS math, open questions |
| 02 | Frontend Functional Specification | Screens A1–A14, B1–B8, Part C–E |
| 03 | API Integration Map | LOS/LMS/Blox endpoints, routing, errors |
| 04 | Frontend Architecture & Build Plan | Stack, phases, DoD, risks |
| — | `blox-marketplace` (DriveMarket monorepo) | NestJS API + 6 Vite portals |
| — | `blox-app` (`blox_customer` Flutter) | Customer iOS/Android app |

This report answers: how far the current Blox frontends and Nest API are from a complete M2P LOS/LMS customer layer; what to keep, wrap, or retire; the phased change plan; extra portals and features worth adding; and every FSD surface that must not be forgotten.

---

## 1. Executive summary

Blox is building a QCB-oriented, Sharia-compliant (Diminishing Musharakah) vehicle-financing platform. **M2P owns LOS, LMS, and Collect.** Blox owns **all customer-facing UI**, dealer/inventory, SkipCash, membership, notifications (Sala), white-label theming, and **middleware** between browsers/apps and M2P.

**`blox-marketplace` today is a different architecture:** NestJS + Prisma is the *system of record* for applications, schedules, and credit decisions. Six React+Vite portals (marketplace, admin, dealer, credit, finance, super-admin) talk to that API. Auth is Better Auth (email/password). Partner finance goes to **Zoho CRM**. KYC is a **separate Blox service**.

**`blox-app` is ahead of the web portal** on offer, pre-disbursal, KYC capture, and servicing dashboard — still against the Blox Nest API, not M2P.

**Do not throw away DriveMarket. Do not rebuild a second LOS.** Evolve `packages/api` into the M2P BFF. Keep marketplace, dealer inventory, quotes, membership, SkipCash, and Zoho (Model B). Replace customer auth, the status machine, the offer disclosure gate, and LMS-sourced servicing. Shrink credit/finance portals so they no longer underwrite Model A.

| Dimension | Spec (Docs 01–04) | Today | After this plan |
|-----------|-------------------|-------|-----------------|
| Backend of record | M2P LOS + LMS | NestJS/Prisma | Nest BFF + local Blox facts; LOS/LMS for origination/servicing |
| Customer web | Next.js (Doc 04) | Vite marketplace | **Stay Vite** — do not migrate mid-integration |
| Customer app | Same journeys | Flutter v2 (v1 still in tree) | Flutter v2 only, rewired to BFF/M2P |
| Auth (customer) | Mobile OTP → JWT | Email/password | OTP primary; ops keep Better Auth + TOTP |
| Statuses | ~30 LOS codes → 6-step tracker | 14 Prisma statuses | LOS snapshot + Blox pointer row |
| Offer / Sharia gate | Disclosure before Accept | Web: missing. App: screen, no gate | Both + `DisclosureGate` |
| Consents | Four mandatory | Web none; app 2 of 4, not POSTed | Hard block + immutable |
| Servicing math | LMS only | Local `generate-schedule` | LMS JSON after booking |
| SkipCash | Blox then confirm to LMS | Initiate; Nest verify stub | Verify + webhook + idempotency |

**Highest-risk bugs already in code (fix in Phase 0, before M2P creds):** marketplace shows `rejectionReason` to customers (AML tipping-off); Flutter consents are not persisted; `skipcash_verify_not_implemented`; no session idle timeout; local schedule treated as truth after `active`.

---

## 2. Target architecture

```
Flutter app ──┐
Marketplace ──┤
Assist shell ─┼──► Nest BFF (evolve packages/api)
Dealer/Admin ─┤         ├── LOS proxy (JWT exchange, status cache, webhooks)
Credit (Blox)─┘         ├── LMS proxy (API A/B, quote, schedule, ownership)
                        ├── SkipCash sessions + webhooks
                        ├── Membership / premium eligibility
                        ├── Sala + in-app notifications
                        └── Tenant / theming config
                              │
              M2P LOS  ·  M2P LMS  ·  KYC vendor URL  ·  Collect (ops-only)
```

**Hard rule:** the browser and the app never call M2P. Token types differ (customer `CUST` JWT vs portal service token vs internal). Qatar residency, idempotency keys, and status-poll caching live in the BFF.

### Two identity realms

| Realm | Who | Mechanism |
|-------|-----|-----------|
| Customer | Marketplace `/app/*` + Flutter | Mobile OTP → CUST JWT wrapped in Blox session (httpOnly cookie on web; secure storage on app). Idle 10 min, warning at 8 min, absolute 8 h, **one** concurrent session. |
| Ops / dealer | Existing five portals | Keep Better Auth email/password + TOTP. Dealer **stamps** applications; OTP, KYC selfie, and consents stay on the **customer’s** device. |

### Stack decision vs Doc 04

Doc 04 specifies Next.js 15 App Router. The repos are **Vite + React Router** (six portals) and **Flutter**. **Do not migrate to Next.js in the same program as M2P.** Keep the current clients. Adopt stack-agnostic Doc 04 ideas: status machine as source of truth, Zod/FSD field schemas, TanStack Query polling, MSW + Playwright (web), integer QAR, Qatar-compliant analytics.

---

## 3. Keep, wrap, or retire

| Asset | Decision | Why |
|-------|----------|-----|
| Marketplace browse, compare, dealer directory, quote tokens | **Keep** | Out of LOS scope; this is how a vehicle enters apply (A0) |
| Dealer inventory CRUD | **Keep** | FSD’s “Blox Admin Panel” equivalent |
| Offers catalog, insurance rates, packages, promotions | **Keep** | Blox product config that feeds the LOS create payload |
| Zoho CRM adapter | **Keep** | Model B (credit-file handoff / `PENDING_EXTERNAL_DECISION`) |
| `blox-kyc-service` / `blox-kyc-module` | **Keep as fallback** | Until LOS returns a D-KYC URL |
| SkipCash client | **Keep; finish verify** | Spec: Blox integrates SkipCash, then confirms to LMS |
| Blox credits wallet | **Keep** | Payment method; LMS sees a gateway reference |
| FCM + in-app inbox | **Keep** | Subscribe to LOS/LMS events |
| Help / FAQ / complaints / data-rights / legal | **Keep** | Rewrite fee copy against LMS fee table |
| `blox-vehicel-care` | **Keep post-LPO** | After `FINANCING_DISBURSED`, not inside LOS |
| Better Auth | **Keep for ops** | Customers move to OTP |
| `ApplicationStatus` 14-value enum as source of truth | **Replace** | LOS status snapshot + local pointer (`losApplicationId`, vehicle, dealer, membership, SkipCash refs) |
| Local `generate-schedule` / ownership math after activation | **Retire as source of truth** | Calculator stays *indicative* pre-offer only |
| Credit portal Maker-Checker (Model A) | **Retire** | M2P LOS Case Manager |
| Finance portal schedule rebuild / activate-as-LMS | **Retire writes** | Keep membership fees, credits, bank-transfer exceptions |
| Flutter v1 screens (`USE_NEW_UI` already true) | **Delete in Phase 0** | Dual UI is migration tax |
| Customer-visible `rejectionReason` | **Remove** | AML/FATF tipping-off |
| WebP on document upload | **Remove** | FSD: PDF/JPG/PNG only |
| App bank-transfer “pending” with no POST | **Remove or ops-only** | Cheque/cash are LMS back-office |
| QPay in legal text | **Remove or implement** | Spec payment rail is SkipCash |
| Collect UI, BRE UI, LPO engine, Case Manager | **Build in-house (flagged)** | Superseded 2026-09: marketplace owns LPO, unit offers, collections/hardship. Do not dual-run an M2P Collect path on the same contract. |

---

## 4. Commercial models (customer UI almost never branches)

| Model | Lender | Customer journey | What changes |
|-------|--------|------------------|--------------|
| B2C | Blox (post-QCB) | Baseline | Theming |
| B2B2C NBFC | e.g. Al Jazeera | **Identical** | NBFC name on **contracts**; Model B may wait longer in “under review” |
| White-label | Blox; 3rd-party staff | Same steps | Tenant tokens, logo, branch-scoped RBAC (QAuto) |

Which underwriting path an application takes is decided **per Finance Provider**, never per application:

- **Model A — Full LOS:** credit team works inside M2P (Maker-Checker). Blox credit portal **must not** approve.
- **Model B — Credit file handoff:** stages 1–3 in LOS, then Blox ops + Zoho / offline pack; status `PENDING_EXTERNAL_DECISION`.

Tracker copy stays model-agnostic. Only *time spent* in review differs.

---

## 5. Gap analysis

### 5.1 Doc 02 screen inventory (27)

Legend: **Build** = net-new. **Keep** = exists, rewire. **Partial** = shell exists, wrong backend or missing gates.

| # | Screen | Pri | Web | App | M2P work |
|---|--------|-----|-----|-----|----------|
| 1 | OTP entry / verify | P0 | Build | Partial (UI, not routed; API throws) | Primary auth both clients |
| 2 | Applicant details | P0 | Partial (one form, `fullName`) | Keep (first/last, gender, QID) | Liabilities, QID checksum, email recovery |
| 3 | Vehicle + calculator | P0 | Partial | Keep | Nationality tenure/DP caps; estimate-only copy |
| 4 | Self-employed document branch | P1 | Build | Build | CR, license, 12-mo stmts, tax card, valuation |
| 5 | Document upload manager | P0 | Partial | Partial | QID front+back, bureau report, ≤5 MB, no WebP |
| 6 | Four consents | P0 | **Missing** | Partial (2 of 4, **not POSTed**) | Hard block + immutable after submit |
| 7 | Review & submit | P0 | Build as step | Partial | LOS create sequence (open item #10) |
| 8 | KYC handoff + return states | P0 | Session API only | Keep capture + platform | LOS URL; `DKYC_RETRY` / fraud / manual |
| 9 | Status tracker + CPV/pend/rework | P0 | Partial 5-step | Partial | 6-step map; generic decline |
| 10 | Offer + disclosure gate + PDF | P0 | **Missing** | Partial (no gate) | `DisclosureGate`; 7-day expiry |
| 11 | Offer expired / decline | P0 | Build | Partial | 409 / 410; no reason codes |
| 12 | Contract bundle + rework | P0 | Partial (1 PDF) | Partial (1 PDF) | Six documents (see §7) |
| 13 | Down payment SkipCash + receipt | P0 | Partial | Partial | Verify + surcharge + receipt |
| 14 | Repayment mandate | P0 | **Missing** | **Missing** | “Registered” not “active”; IBAN mask; step-up OTP |
| 15 | Pre-disbursal + delivery | P0 | Build | Partial | Four ticks including takaful 422 |
| 16 | Withdraw | P1 | Partial (3 statuses) | Partial | All pre-disburse; after disburse → settlement |
| 17 | Financing dashboard + ownership | P0 | Partial | Partial | LMS %; **multi-contract** |
| 18 | Schedule view | P0 | Partial calendar | Partial | Equity + profit columns from LMS |
| 19 | Pay installment (API A) | P0 | Partial | Partial | Idempotency, excess bucket, oldest-first |
| 20 | Part payment (API B) | P1 | Build | Partial action screen | Reduce Tenure default vs Reduce Installment |
| 21 | Early settlement | P1 | Build | Partial action screen | Quote, Ibra, QAR 1, Overpaid |
| 22 | Payment holiday | P2 | Partial (yearly quota) | Partial | 15-day grey-out; months TBD (#14) |
| 23 | Statements / letters / takaful | P1–P2 | Build | Static fees page | QAR 100 letters; takaful card |
| 24 | Notifications center | P1 | Partial inbox | Partial FCM + inbox | LOS/LMS events; tipping-off-safe copy |
| 25 | Dealer executive Assist shell | P1 | Build (**not** inventory portal) | QR / deep-link | Customer OTP / KYC / consent hand-off |
| 26 | White-label theming | P2 | Build tokens | Build theme | QAuto tenant |
| 27 | Auth/session shell | P0 | Build | Build | Idle 10m, 8h cap, 1 session, profile |

### 5.2 Applicant fields (A2) — web is behind Flutter

| Field | FSD rule | Marketplace web | Flutter |
|-------|----------|-----------------|---------|
| First / last name | 2–50 alphabetic | `fullName` only | Yes |
| Email | Valid + unique; already-registered recovery | Account email | Yes + guest password |
| Phone | +974, 8 digits; OTP-prefilled **read-only** | Editable | Prefill, not locked |
| QID | 11 digits + checksum; age from QID | Free text | Nationality from QID; checksum TBD |
| Gender | Male / Female / Prefer not to say | Missing | Yes |
| Nationality | Drives Qatari vs expat caps | Yes | Yes |
| Monthly net salary | > 0; later vs certificate | `income` | Calculator, not always wizard |
| **Monthly liabilities** | ≥ 0; feeds DBR | **Missing** | **Missing** |
| Residence duration | &lt;6 / 6–12 / &gt;12 months | Missing | Yes |
| Employment type | Gov / private approved / unlisted / self-employed | Optional string | Mapped enums |

Soft pre-checks (backend decides): Qatari 18–65 at contract end, min income QAR 5,000; Expat 21–60, min QAR 7,000, residency ACTIVE ≥ 6 months.

### 5.3 Vehicle & financing (A3) — product limits

Code today: `MIN_TENURE_MONTHS = 1`, `MAX_TENURE_MONTHS = 60`, presets 12–60, **no 72**, **no expat 48 cap**, offer `min_down_payment_pct` often **10%**.

| Rule | Action |
|------|--------|
| Tenure dropdown 12/24/36/48/60/72 then filter by nationality | Implement; confirm open item #6 |
| Car max 70k; Standard ≤90k vehicle → 50k; Premium → 70k | Offer matrix; confirm open item #2 |
| Used 50k; motorcycle 15k LOS vs 50k LMS | **Do not hardcode** until open item #1 |
| Used age ≤ 5 years; max 10 at tenure end | Calculator messaging |
| Min DP ≥ 20% expat (LMS 15–20% conflict) | Open item #4 |
| Profit bands 5–15% new, 5–20% used | `annual_rent_rate` on offer |
| Indicative installment until offer | Label as estimate; rent+principal breakdown at **offer**, not only at apply |
| Membership fee optional at apply | JSON exists; **no catalog UI** (open item #12) |
| Co-applicant / guarantor | **Skip Phase 1** unless LOS adds fields (#13) |
| Tenure/DP change **after offer** | Treat as `OFFER_REJECTED` + new application |

### 5.4 Documents (A4)

| Document | Mandatory | Today |
|----------|-----------|--------|
| QID **front and back** | Yes | App KYC slots; web **single** `qid` file |
| Salary certificate ≤ 90 days | Yes | `salary` slot; **no recency warning** (`STALE_CERT`) |
| Bank statements 6 months, salary account | Yes | `bank` slot; no page/count check |
| QCB bureau report (customer-obtained) | Yes | **No category** |
| Passport | Expats | Slot exists |
| Self-employed pack | If self-employed | Missing |
| DL / proof of residence / quotation / employment contract | Optional, configurable | `other` only |

**File policy:** PDF / JPG / PNG only, ≤ 5 MB. Marketplace `accept` includes **webp** — drop it. Per-file states: queued / uploading / scanned / accepted / rejected + reason. Hard stop until mandatory documents **accepted**.

### 5.5 Consents (A5) — go-live hard gate

Four independent checkboxes, **no** pre-tick, **no** “accept all”:

1. Credit Bureau authorization  
2. Terms & Conditions  
3. Digital KYC / biometric  
4. AML & Sanctions screening  

Capture timestamp / device on the BFF. Immutable after submit. Bureau / D-KYC APIs inaccessible until all four are on (backend enforces too).

### 5.6 OTP machine (A1) — not “add a screen”

- Qatar `+974` + 8 digits; 6-digit code; **5-minute** countdown  
- Wrong &lt; 5 → inline + remaining attempts  
- 5th wrong → **403**, lock **15 minutes**, inputs disabled, resend blocked  
- Expired → request new code  
- 4th resend in 15 minutes → **429**  
- SMS failure → **email fallback** (backend-driven)  
- **WhatsApp OTP is out of scope** (open item #8)  
- After JWT: start idle timers  
- **Step-up OTP** again for down payment, mandate setup, IBAN change  

JWT storage: Doc 03 says memory; **Doc 04 wins** — BFF httpOnly Secure SameSite cookie on web; Flutter `flutter_secure_storage`.

### 5.7 De-duplication and resume

| Scenario | Condition | Behaviour |
|----------|-----------|-----------|
| A | Customer not found | New Customer ID + Application ID |
| B | **Active** application exists | **No new application** — return existing ID + status → tracker |
| C | Previous approved (then forward) | Reuse Customer ID, **new** Application ID |
| D | Previous rejected / expired / withdrawn | Reuse Customer ID, new Application ID; **never disclose prior reason** |
| — | QID matches, name/DOB differ | `MISMATCHED_IDENTITY` — customer sees “under review”; ops reconciles |

**Active** statuses block a second origination. **Terminal** statuses allow reapply. After disbursement, a **second contract on the same client is allowed** — servicing home is **per contract**, list of contracts, not a single card.

**Resume (R1):** login with active app → tracker at the correct CTA. `CREATED` → wizard. HTTP **410** expired → new apply.

**Withdraw (W1):** any pre-disbursement state; extra warning if signed / DP paid. After `FINANCING_DISBURSED` → early settlement, not withdraw. Down-payment refund is **ops offline**.

---

## 6. LOS status → 6-step tracker

Prisma’s 14 statuses (`draft` … `completed`) become a **cache**, not the source of truth. Flutter extra flags (`approved`, `offer_ready`, `pre_disbursal_pending`) collapse into this map.

| Step shown | Backend statuses | Extra UI |
|------------|------------------|----------|
| 1. Application submitted | `CREATED`, `SUBMITTED` | Resume wizard if `CREATED` |
| 2. Identity verification | `KYC_PENDING`, `KYC_IN_PROGRESS`, `KYC_ROUTING_PENDING_MANUAL`, `DKYC_RETRY`, `DKYC_PENDING_MANUAL` | Retry **hint** (glare/blur); manual = no action; **expired QID** = explicit renew-and-reapply (exception to generic decline) |
| 3. Under review | `UNDERWRITING_PENDING`, `CREDIT_FILE_GENERATED`, `PENDING_EXTERNAL_DECISION`, `UNDER_REVIEW`, `DECISION_PENDING`, `BRE_DECISION_PENDING_MANUAL`, `ROUTING_PENDING_MANUAL`, `CPV_UNREACHABLE`, `AML_MANUAL_REVIEW`, `REWORK_REQUIRED` | CPV callback card; rework = no customer action unless paired with info request |
| 4. Offer | `FINANCING_APPROVED` + offer payload | 48h expiry banner; 7-day window |
| 5. Contract & payment | `OFFER_ACCEPTED`, `CONTRACT_REWORK`, `PRE_DISBURSAL_COMPLETE` | Rework list; mandate; DP pending |
| 6. Vehicle ready | `FINANCING_CREATED_LMS`, `FINANCING_DISBURSED` | Dealer/branch pickup. LMS book **failure** stays “finalizing” — **do not notify** |

**Terminal / special (never leak AML/fraud/bureau reasons)**

| Status | UI |
|--------|-----|
| `REJECTED_BY_UNDERWRITER`, `REJECTED_FRAUD_FLAG`, `REJECTED_AML_FLAG` | One `GenericDecline` + reapply (Scenario D) |
| `DKYC_FRAUD_LOCKED` | Same generic; 24h lock is backend |
| `OFFER_REJECTED` / `OFFER_EXPIRED` | Reapply; **409** on late accept |
| `APPLICATION_EXPIRED` | 30-day inactivity; **410** → new apply |
| `APPLICATION_WITHDRAWN` | Confirmation; DP refund ops |
| `PENDED_INFO_REQUESTED` | Actionable re-upload card |
| `MISMATCHED_IDENTITY` | Hold — “under review” to customer |

KYC vendor: 15s timeout × 3 retries (2/4/8s), then `DKYC_PENDING_MANUAL`. Bank-statement AI up to **5 minutes** — **never block the tracker** (backend-internal post-submit).

Poll `GET status` every **10–15s** while waiting; **pause when tab hidden**; refetch on visibility. Prefer LOS → BFF webhook if M2P adds it.

---

## 7. Offer, contract, money, mandate

### Offer (A9) — Sharia hard gate

Accept **disabled** until all of the following have rendered (and, recommended, schedule scrolled/expanded):

- Total asset value  
- Blox financing share QAR + %  
- Customer initial contribution QAR + %  
- Annual profit rate (% p.a. on **outstanding share**)  
- Monthly installment with **rent + principal** breakdown  
- Total financing cost (sum of rents)  
- Full amortization **table + downloadable PDF**  
- Offer expiry date (7 days, configurable)

Include a short Musharakah explainer (co-ownership, declining rent, ownership at end) — supports CPV question 5. Reject closes the application; **no in-place renegotiation**.

Marketplace has **no offer screen**. Flutter `OfferScreen` exists without a disclosure gate.

### Contract bundle (A10) — six documents, not one PDF

| Document | Customer signature |
|----------|-------------------|
| Diminishing Musharakah Agreement | Yes (customer + Blox/NBFC) |
| Agency Agreement / Wakala | Yes |
| Key Facts Statement | Acknowledgment |
| Credit Approval Memo | **No** |
| Wa’ad / Promise to Purchase | Yes |
| Vehicle Takaful Declaration | Yes |

Flow (Phase 1 unless #7 says e-sign): download → print → wet-sign → scan/photo → `POST /api/contracts/{id}/upload-signed` per document → ops verify → `CONTRACT_REWORK` loop.

### Down payment (A11)

`POST /api/payments/down-payment` → SkipCash (Apple Pay, card, Blox credits). Disclose **card surcharge** before confirm. Async webhook (~10s). Pending state; **no duplicate initiation** (idempotency). Card decline stays `OFFER_ACCEPTED`; PDC fallback is ops. Receipt + paid stamp on tracker.

Nest: implement `verifyAndComplete` (today `NotImplementedException`). Flutter SkipCash payer fields must use **real profile**, not placeholders.

### Mandate (A12) — missing on both clients

`POST /api/repayment/setup`. Auto-debit or PDC. Copy: **“registered” not “active”** (execution is out of system scope). IBAN masked on redisplay; IBAN change = step-up OTP.

### Pre-disbursal (A13) — four conditions

1. Contracts verified  
2. Down payment success  
3. Repayment mode registered  
4. Takaful opted/active, coverage ≥ vehicle value (**422** if under)

Then `PRE_DISBURSAL_COMPLETE` → “Finalizing your financing.”

### Delivery (A14)

`FINANCING_CREATED_LMS` booked; `FINANCING_DISBURSED` LPO to dealer; customer: vehicle ready + dealer/branch. Hand off to servicing dashboard.

---

## 8. LMS servicing — the UI is a renderer

After `FINANCING_CREATED_LMS`, **do not compute schedule math locally**. `PaymentSchedule` in Prisma becomes a **cache of LMS output**.

| Rule | Frontend implication |
|------|----------------------|
| Dual-component installment; day-count **30/360**; round **half-up whole QAR**; drift in last installment | Two columns (equity, profit) + integer `MoneyText` |
| Due date **2nd vs 5th** unresolved (#3) | **No hardcoded “2nd” copy** |
| Disburse **on/before the 15th** → first due next cycle + **Broken Period Profit**; after 15th → skip a month | Explain BPR once |
| Co-ownership % = principal outstanding / vehicle value; history retained | Signature “ownership journey”; chartable |
| Normal waterfall: Profit → Equity → Charges | Show allocation on API A success |
| NPA / one-time settlement: Principal → Profit → Charges | Different copy |
| API A (normal): excess → Excess Bucket; no schedule regen | “Credit QAR X applies next due” |
| API B (part pay): amount &gt; current due; **Reduce Tenure default** vs Reduce Installment; regen + **contract version++** | Refetch schedule; show version |
| Settlement quote = outstanding equity + pro-rata profit + charges; **no future profit; fee QAR 0; Ibra 100%**; match within **QAR 1** | Quote refresh if user delays |
| Overpay → **Overpaid** until refund → **Closed** | State, not an error |
| Title transfer after Closed | Manual next-steps; Blox-notified |
| Holiday: **Blox premium first** (LMS never checks); grey **within 15 days of due date** (#5 assume due date); profit accrues; EMI constant | Replace yearly-quota-only UX |
| **No late fees** | String-scan test; no SMA/NPA class names in customer copy |
| Fees: processing/admin/bureau informational; Physical Statement **QAR 100**; Liability Letter **QAR 100**; foreclosure/part-pay fee 0 | Paid letter request flow |
| Takaful | Informational card; renewal ops-side |
| Multiple contracts per customer | Dashboard list |
| SkipCash then LMS with gateway ref + `Blox-Idempotency-Key` | BFF owns `{Service}-{ApplicationID}-{AttemptN}` |
| Apple Pay / card / Blox credits; surcharge on card | Disclose before pay |
| Cheque / cash | **Not in customer UI** |

**Collect:** M2P back-office for collectors. Cases flow LMS → Collect at DPD 1. Customer app: overdue badge, Pay Now, WhatsApp/SMS notices. **Do not** build PTP, agency allocation, or SULH. A later customer-facing settlement offer is a change request against Collect **and** the app.

**Notifications:** LMS/LOS → Blox middleware → **Sala**: WhatsApp primary, SMS critical/overdue, Email formal docs, **in-app always**, **EN + AR**. In-app copy must match tipping-off (generic rejection).

---

## 9. Cross-cutting (Part D) and NFRs

### Session (LOS FSD §11 / Doc 04 §3)

- Idle **10 min** → logout, clear tokens, redirect to OTP with deep-link return  
- Warning **2 min before** (at minute 8) — countdown modal  
- Absolute **8 h** regardless of activity  
- **One** concurrent session; second login blocked; “signed in elsewhere”  
- Multi-tab: `BroadcastChannel` (web)  
- 401 → re-OTP; preserve return URL  

### PII

Mask by default: QID `XXXXXXX1234`, IBAN `QAXXXXXXXXXXXXXXXX1234`, phone `+974 XXXX X456`. No unmask in customer UI. Never log PII client-side. No PII in URLs or analytics.

### HTTP / resilience

| Case | FE |
|------|-----|
| 401 | Re-OTP; keep deep link |
| 403 `OTP_LOCKED` / forbidden | Countdown; no brute retry |
| 409 offer expired | Expired screen + reapply |
| 410 application expired | New application |
| 422 field / takaful under-coverage | Inline / gate message |
| 429 | Show wait time |
| 5xx GET | Backoff; support card with correlation id |
| LMS book fail | Stay on Finalizing; **no toast** |
| Payment webhook delayed | Pending; no second initiate |
| KYC timeout | ~30s progress then manual-verification copy |
| Bank-statement AI | Never block UI |

Skeletons after **300ms**. Disable submit on click + server idempotency. Offline upload retry queues on mobile; resumable chunking TBD with M2P.

### Language, a11y, performance

- Full EN + AR RTL; CSS logical properties; **Western digits for amounts** recommended (align SMS templates); Flutter currently has Eastern-digit helpers — **unify policy**  
- WCAG 2.1 AA; camera `capture` on mobile web  
- LCP &lt; 2.5s on 4G mid-range Android; wizard step &lt; 200ms  
- Volumes Year 1 ≈ 1,000 contracts — correctness over scale  
- API P95 &lt; 2s baseline / &lt; 3s peak; BRE &lt; 800ms (not called from FE)

### Data residency (PDPPL Law 13/2016)

All PII in **Qatar-hosted** cloud. Current Vercel frontends + Railway API + Sentry may conflict. **Confirm hosting and analytics posture before Phase 1 deploys with real PII.** UAT uses **synthetic data only**.

### Compliance copy (string-scan in CI)

- Rejections: *“We are unable to proceed with your application at this time.”* only  
- Never “loan” / “interest” → financing, profit rate, rent, ownership share  
- No late-fee / penalty lines in servicing  
- No cash-to-customer framing; LPO to dealer  
- No STP “instant approval” copy; set expectation **&lt; 24h** human review  

### Analytics and audit

PII-free, Qatar-compliant events. Every submit / offer accept / sign upload / payment has a **backend** audit trail. FE sends correlation / request IDs.

### Definition of done (per screen, Doc 04 §11)

Functional per Doc 02 · EN + AR (RTL) · all mapped statuses/error codes · masked PII · 360px → desktop · WCAG AA · unit + E2E · no compliance-string hits · PII-free analytics · reviewed against FSD test scenarios for that stage.

---

## 10. API mapping (Doc 03 → Nest BFF)

Keep Flutter paths stable where possible; implement **behind** them.

| Frontend continues to call | BFF does |
|----------------------------|----------|
| *(new)* `POST /api/auth/send-otp`, `verify-otp` | Proxy LOS; wrap CUST JWT |
| `POST /api/v1/auth/mobile/sign-in` | Phase out for customers; keep for transition |
| `POST /api/v1/mobile/applications` | Consents check → LOS create sequence → local pointer |
| `GET /api/v1/applications/:id` | Merge LOS status + Blox vehicle/membership |
| `GET /api/applications/:id/status` | Tracker heartbeat (cache) |
| `POST .../documents` | LOS `/api/documents/upload` |
| `POST .../kyc/session` | LOS `/api/dkyc/initiate` or blox-kyc fallback |
| `GET/POST .../offer` | LOS offer payload / `/api/offers/{id}/response` |
| `POST .../contract/signed` | LOS `/api/contracts/{id}/upload-signed` per doc code |
| `POST .../skipcash/*` | SkipCash then LMS API A/B |
| `GET /mobile/servicing/dashboard` | LMS schedule + register + excess |
| `POST .../schedules/:id/defer` | **Membership check first**, then LMS reschedule |
| Withdraw | Confirm endpoint with M2P (not in catalog) |

**FE must never call:** `/api/bre/*`, `/api/compliance/aml-screen`, `/api/bsa/*`, `/api/cases/*`, `/api/credit-file/*`, `/api/offers` (generate), `/api/contracts/generate`, `/api/ops/authorize-lpo`, `/api/lms/create-contract`, `/api/lpo/dispatch`.

**Blox-owned services the FE also needs (Doc 03 §3):** marketplace vehicle context (exists); membership catalog (partial); SkipCash (incomplete verify); notification middleware / Sala (partial inbox); dealer executive auth (dealer portal ≠ Assist); tenant theming (missing); bilingual legal/consent content (partial i18n).

---

## 11. Data model (Prisma reinterpretation)

Keep a local `Application` row:

```
losApplicationId
lmsContractId
productId, companyId, agentUserId
pricingSnapshot          -- indicative until OFFER
bloxMembership
consents[]               -- NEW: four purposes + timestamps
kycVendorRef
skipcash refs
statusSnapshot           -- last LOS status + fetchedAt
```

`PaymentSchedule` after disbursement: **upsert from LMS**, not `generate-schedule.ts`. Existing `IdempotencyRecord` stores LMS `Blox-Idempotency-Key`s.

---

## 12. Phased delivery (mapped to M2P gates)

Backend gates: **D-KYC creds → DEV**; AML / BSA / LMS contract / BRE / master data → **UAT**; Sharia board → **PROD**.

### Phase 0 — Foundations (now, no M2P)

Shared: typed status module + Doc 03 MSW fixtures; `DisclosureGate`, `ConsentBlock`, `GenericDecline`, `MaskedField`, `SessionGuard`; stop showing `rejectionReason`; persist four consents; implement SkipCash verify; stop treating local schedule as LMS after `active`.

Web: split apply into steps; port Flutter offer + pre-disbursal; idle/session shell; Playwright + MSW (OTP lock, Scenario B, 409/410, disclosure, consent, string-scan).

App: route OTP screens; delete v1; real SkipCash payer identity; idle timers.

**Exit:** happy path against mocks; compliance E2E green; web and app share one status enum.

### Phase 1 — Origination P0 (LOS DEV)

BFF: `LosAuthAdapter`, applications/documents/KYC/offer clients, status cache, consent store, pointer row.

Web: A1–A9 complete including 6-step tracker and offer gate.

App: rewire wizard/offer/KYC to LOS; collapse invented statuses.

Zoho Model B remains a parallel ops path.

**Exit:** submit → KYC → review → offer accept on LOS DEV with mock vendors.

### Phase 2 — Contract → disbursement

Six-doc wet-sign + rework; SkipCash DP; mandate; four-tick pre-disbursal; delivery; withdraw. Finance portal **must not** book LMS — M2P Disbursement Service does.

**Exit:** B2C UAT candidate; &lt;24h TAT measurable.

### Phase 3 — Servicing P0/P1 (needs LMS spec)

Dashboard + co-ownership from LMS; schedule table; API A; then API B, settlement, letters, takaful. Holiday after membership catalog.

**Exit:** pay installment on staging LMS; then part-pay both options + settlement.

### Phase 4 — Assisted + white-label

**Assist** portal (executive in customer journey + QR/hand-device for OTP/KYC/consents). QAuto tokens. Payment holiday.

**Do not start Phase 4 until Phase 2 UAT is green.**

### Workstreams in parallel

| Stream | Owner focus |
|--------|-------------|
| A — BFF | LOS/LMS clients, OTP, consents, SkipCash verify, status cache |
| B — Flutter | OTP routing, consents POST, disclosure, generic decline, mandate, LMS dashboard |
| C — Marketplace web | Catch up to Flutter then to spec |
| D — Ops shrink | Feature-flag Model A decisions off credit/finance; keep Zoho Model B |

---

## 13. Per-portal change list

| Portal | Keep doing | Stop doing |
|--------|------------|------------|
| **Marketplace (customer web)** | Browse, compare, quotes, help | Thin one-page apply as the whole LOS |
| **Flutter** | Tab shell, KYC capture, payments hub, FCM | v1 screens; email-primary; local LMS math |
| **Dealer** | Inventory, quotes, start Assist | Underwriting |
| **Admin** | Users, companies, listings, offer **catalog**, promotions | Model A approve/reject |
| **Credit** | Model B Zoho failures, PENDED_INFO coordination, CPV notes | `FINANCING_APPROVED` for Model A |
| **Finance** | Membership fees, credits, bank-transfer exceptions | Rebuild amortization / activate-as-LMS |
| **Super-admin** | Tenants, flags (`LOS_ENABLED`, `LMS_ENABLED`), audit, theming | — |

---

## 14. Extra portals and features (Blox-owned)

### New portals

| Portal | Audience | Why |
|--------|----------|-----|
| **Assist** | Sales executive | Spec Part C — operate customer journey; OTP/KYC/consents stay customer-performed |
| **Membership** | Customer + admin | Premium catalog, fee, holiday eligibility — **invisible to LMS** |
| **Comms / Sala ops** | Ops | EN/AR templates, delivery logs, tipping-off-safe rejection copy |
| **Partner desk** | NBFC (read-only) | Pipeline visibility + contract branding for Model B — **not** LOS maker-checker |
| **White-label admin** | QAuto / tenant ops | Logo, tokens, branch users |

### Features on existing surfaces

**P0:** co-ownership visual on **web**; Musharakah explainer; CPV unreachable callback; PENDED_INFO re-upload; generic decline + reapply; mandate.

**P1:** excess bucket + refund contact; takaful card; QAR 100 letters; part-pay and settlement on **web**; showroom KYC QR; inbox parity with WhatsApp events.

**P2 / differentiating:** ownership **chart** from LMS register; credits as first-class method (started); compare → LOS create; vehicle-care upsell after LPO; dealer conversion analytics (events already emitted); camera capture on mobile web.

---

## 15. Testing (FSD scenarios → suite)

**Unit / integration (MSW-mocked):** OTP lock after 5 attempts (403 + 15-min UI); 4th resend → 429; duplicate submit → same Application ID (Scenario B) → resume; expired offer accept → 409; expired application resume → 410; takaful under-coverage → 422; contract rework loop; part-payment default Reduce Tenure; settlement QAR 1 tolerance.

**E2E (Playwright staging):** B2C apply → disburse; Model B (identical UX, longer review); pay installment; part payment both options; early settlement.

**Compliance E2E (release-blocking):** Accept disabled pre-disclosure; consents block submit; decline screens contain **no** reason text for **any** rejection status; no penalty/late-fee strings (scan); Arabic RTL snapshot per P0 screen.

**Accessibility:** axe + manual per P0 screen.

Neither repo has frontend E2E today. API has ~60 Vitest files (lifecycle, Zoho, deferral, KYC webhook) — keep them; add LOS/LMS contract tests when spec lands.

---

## 16. Open questions (must be written answers)

### From Doc 01 §10

| # | Question | UI blocked |
|---|----------|------------|
| 1 | Motorcycle max QAR 15,000 vs 50,000 | Calculator + messaging |
| 2 | New-car Standard 50k vs Premium 70k vs LMS “New Car 70k” | Product limits |
| 3 | Monthly due date 2nd vs 5th | Reminders, holiday window, copy |
| 4 | Min DP 20% vs 15–20% range | Down-payment field |
| 5 | Holiday 15 days before **disbursement** vs **due date** | Grey-out — **assume due date** until confirmed |
| 6 | Tenure 12–72 vs expat 48/60 vs LMS min 3 months | Dropdown filter |
| 7 | Wet-sign vs e-sign in Phase 1 | Entire A10 UX |
| 8 | OTP SMS vs email fallback; WhatsApp out | A1 |
| 9 | KYC embed vs redirect + return params | A7 |
| 10 | `/leads` vs `/create-customer` vs `/applications` sequence | Wizard save/resume |
| 11 | Dealer staff auth; which steps stay customer | Assist portal |
| 12 | Membership catalog, price, opt-in point | A3 + B6 |
| 13 | Co-applicant/guarantor in Phase 1? | **Assume no** |
| 14 | Deferral months allowed / max | B6 form |

### From Doc 03 Pending Item #36

Full request/response schemas and status enum serialization; LMS paths + customer auth model (app → BFF → LMS, not browser → LMS); offer payload + schedule array + PDF URL; contract bundle metadata and link TTLs; document upload multipart vs base64 and virus-scan surfacing; LOS status **push** vs poll; **withdrawal endpoint**; KYC URL contract; machine-readable 4xx codes (`OTP_LOCKED`, `OFFER_EXPIRED`, …); D-KYC sandbox timeline for DEV.

### Hosting

Qatar-resident frontend + analytics before Phase 1 production-like deploys (Doc 04 risk #9).

---

## 17. Suggested near-term actions

**This week (Doc 04 §10):** formally request M2P API spec #36; KYC integration guide; working session on create-customer vs leads; SkipCash sandbox + Apple Pay domain; written resolution of product-limit discrepancies; wet-sign vs e-sign with Sharia board; dealer Assist auth with Blox backend; propose LOS→middleware status webhook; confirm PDPPL hosting; start membership catalog as an internal Blox service.

**Phase 0 engineering (no M2P blocker):** GenericDecline; consent persistence; SkipCash verify; session timers; QID/IBAN/phone masks; drop WebP; split web wizard; route Flutter OTP; delete Flutter v1; string-scan CI; shared `statuses` module + mocks.

---

## 18. Definition of done (product)

A customer can: OTP in → pick a listing → complete FSD fields + **four consents** + docs → KYC (retry/manual/fraud handled) → wait on a **6-step tracker** (generic decline if rejected; CPV/pend cards) → **accept offer only after full Musharakah disclosure** → wet-sign **six-document** bundle → pay down payment on SkipCash → **register mandate** → see **four** pre-disbursal ticks → pickup. After LMS booking they see **LMS** ownership %, pay **API A**, and (P1) part-pay / settle — with **no local amortization** and **no late-fee copy**. Dealer can assist without seeing underwriting. Credit **cannot** approve Model A inside Blox. Web and app share one status map, one consent schema, and one SkipCash session shape.

---

## Appendix A — Current codebase snapshot (2026-09-02)

**blox-marketplace (`drivemarket`)**  
API: NestJS 11, Prisma, Better Auth, `/api/v1`, SkipCash, Zoho, KYC bridge, jobs/cron.  
Portals: marketplace :5173, admin :5174, super-admin :5175, dealer :5176, credit :5177, finance :5179.  
Application statuses: `draft`, `under_review`, `resubmission_required`, `contract_signing_required`, `contracts_submitted`, `contract_under_review`, `down_payment_required`, `down_payment_submitted`, `pending_finance_activation`, `partner_processing`, `active`, `completed`, `rejected`, `submission_cancelled`.

**blox-app (`blox_customer` 1.0.2+6)**  
Talks to marketplace Nest (`API_BASE_URL`) + optional KYC platform (`KYC_API_BASE_URL`). Production login: `POST /api/v1/auth/mobile/sign-in`. OTP screens exist, **not routed**. Wizard: 5 steps (review, personal, identity, employment+KYC, legal). Offer / contract / pre-disbursal / payments hub / calendar / FCM present. Dual v1/v2 behind flags (v2 default).

---

## Appendix B — Related local documents

| File | Use |
|------|-----|
| `01-System-Overview-and-Backend-Understanding.md` | Boundaries and open questions |
| `02-Frontend-Functional-Specification.md` | Screen and field spec |
| `03-API-Integration-Map.md` | Endpoints and errors |
| `04-Frontend-Architecture-and-Build-Plan.md` | Phases and DoD |
| This document (`05-M2P-Frontend-Fit-Report.md`) | Gap analysis + change plan against real repos |

Cursor canvases (working maps, not source of truth): `m2p-fit-plan.canvas.tsx`, `m2p-coverage-deep-dive.canvas.tsx`.

---

*End of report.*
