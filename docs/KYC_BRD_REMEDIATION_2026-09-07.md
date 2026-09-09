# KYC BRD remediation — what shipped, what is still open

Companion to [`KYC_BRD_COMPLIANCE_2026-09-07.md`](./KYC_BRD_COMPLIANCE_2026-09-07.md), which stays
as the dated point-in-time assessment. This document records the code changes made against its
Phase 1 list (plus two Phase 2 items) and states plainly what they do **not** close.

Repos touched: `blox-kyc-module` (API, console, capture, mobile, shared) and `blox-marketplace`
(`packages/api` application document rules).

---

## 1. What is now implemented

| # | Remediation item | Status | Where |
|---|---|---|---|
| 1 | Manual-upload identity bypass | **Closed** | `blox-marketplace/packages/api/src/applications/application-documents.ts`, `submit-gates.ts`, `config/app-config.service.ts` |
| 2 | Real SMS provider for OTP delivery | **Closed (needs credentials)** | `apps/api/src/providers/notifications.ts`, `sms-templates.ts`, `workers/notifications.ts`, `config.ts` |
| 3 | Nationality eligibility rule (BR-3) | **Closed** | `apps/api/src/modules/risk/eligibility-rules.ts`, `db/seed.ts`, `db/draft-eligibility-rules.ts` |
| 4 | Scheduled re-screening | **Closed for scheduling; list source still sandbox** | `apps/api/src/workers/rescreen.ts`, `workers/screening.ts` |
| 5 | Fraud / security / KRI / biometric reports | **Closed** | `apps/api/src/modules/admin/reports.ts`, `apps/dashboard/src/pages/ReportsPage.tsx` |
| 6 | Retention enforcement + legal hold | **Closed** | `apps/api/src/workers/retention.ts`, `modules/cases/routes.ts`, migration `0005` |
| 8 | Geo-fencing + device linking (FR-7, Phase 2) | **Closed** | `apps/api/src/modules/onboarding/protections.ts`, `enforce.ts`, capture + mobile clients |
| 12 | Cross-session failure counters (FR-14, Phase 2) | **Closed** | `apps/api/src/modules/onboarding/routes.ts`, migration `0005` |

### 1.1 Identity bypass (BR-7 / BR-8 — report §5.1)

A customer-uploaded QID photo no longer satisfies the identity slot. `IdentityPolicy` on the
document rules distinguishes three sources:

* verified KYC-platform slots (`qid_front` / `qid_back` with `verificationStatus: 'verified'`) — always accepted;
* a **staff** upload — accepted while `KYC_ALLOW_STAFF_MANUAL_IDENTITY` is on, for the face-to-face
  branch procedure where an officer inspects the original card;
* a **customer** upload — rejected once e-KYC is required.

`KYC_EKYC_REQUIRED` defaults to **on whenever `KYC_API_KEY` is configured**, so an environment with
the KYC platform wired gets the strict rule without further configuration; environments without it
keep the legacy behaviour. Rejected manual uploads are also removed from the `uploaded` list in the
document-slots DTO, so the customer portal cannot show a slot as done that submit will refuse.

### 1.2 OTP delivery (FR-6)

`NOTIFICATION_PROVIDER` accepts `console` (dev), `twilio`, and `http` (any JSON gateway — Ooredoo,
Vodafone Qatar, Unifonic, Infobip). **Production now refuses to boot on `console`**, alongside the
existing sandbox-provider refusal. Recipients are decrypted from the customer record at send time,
so the outbox row never holds a plaintext number. 5xx failures retry with backoff; 4xx and unknown
recipients dead-letter immediately instead of looping.

The OTP echo in the API response (`demo_otp`) is already gated on `NOTIFICATION_PROVIDER === 'console'`,
so configuring a real provider removes it.

### 1.3 Eligibility (BR-3)

Jurisdiction policy is rule **data**, not code, so a change is drafted, reviewed and activated
through the Rules console with an audit trail, and past decisions stay reproducible against the
version that produced them.

* `nationality-prohibited` — FATF call-for-action list (PRK, IRN, MMR) → `PROHIBITED`, auto-reject.
* `nationality-high-risk` — ships **empty on purpose**; the FATF grey list changes at every plenary
  and a hardcoded copy becomes wrong policy silently. Compliance populates it, which is also the
  moment the decision gets an owner and a date. Populated, it adds score and demands EDD.
* `nationality-missing` — never auto-approve when nationality was not established.

Existing tenants adopt them with `npm run rules:eligibility`, which **drafts** the next version per
tenant (idempotent); activation stays a human act in the console.

### 1.4 Ongoing monitoring (BR-9 / FR-12)

A daily sweep re-screens approved customers older than `RESCREEN_INTERVAL_DAYS` (default 30). When a
re-screen surfaces open alerts on an approved case, the case moves to `REVERIFICATION_REQUIRED`,
emits `rekyc.triggered`, and notifies compliance — a sanctions hit on an approved customer no longer
sits unnoticed.

### 1.5 Reporting (BR-12 / FR-16)

Four tenant-scoped endpoints under `/api/v1/reports/` (`fraud`, `security`, `kri`, `biometrics`),
each carrying `generated_at` and the window it covers, all computed from the append-only trails so
every figure traces back to its evidence. A **Reports** page in the operator console renders them
(EN/AR) behind `reports:read`.

The KRI report deliberately surfaces the two controls that decay silently: re-screening coverage
(how many approved customers are overdue) and retention backlog (how many cases are past the window).

### 1.6 Retention + legal hold (PDPPL retention — report §4)

A daily purge erases document bytes, extracted field values, declared identities, bank transaction
detail and the customer's encrypted contact record for cases past `RETENTION_YEARS`. The
append-only evidence trail — audit logs, consents, decisions, screening runs, and the case row with
its masked display name — survives, which is what the AML record-keeping obligation needs.

Two rails, because a purge cannot be undone: a per-case `legal_hold` (set via
`POST /api/v1/cases/:id/legal-hold`, audited) suspends it indefinitely, and `RETENTION_ENFORCE` must
be set explicitly — until then the sweep only audits what it *would* erase.

### 1.7 Geo-fencing, device linking, lockout (FR-7 / FR-14, BR-6 / BR-10)

* **Geo** — `ALLOWED_COUNTRIES` checked against the edge country header on every customer request.
  Empty disables it (dev). `GEO_REQUIRE_HEADER` refuses requests that arrive without the header, so
  a direct-to-origin request cannot bypass the fence once the edge is mandatory.
* **Device** — the OTP-verified session is bound to a hash of the client's `x-device-id`; the token
  carries the hash and every later request must present the same device. A stolen token on another
  device is refused. Clients that send no device id stay unbound, so older clients keep working.
* **Lockout** — failed OTP attempts are counted on the **case**, not the session, so requesting a
  fresh invite link does not hand out a new budget of guesses. `OTP_MAX_ATTEMPTS` (default 5) locks
  for `OTP_LOCKOUT_HOURS` (default 24); a locked case is also refused a new OTP.

**Bug found and fixed while building this:** `withTenant` rolls its transaction back when the
handler throws, so the pre-existing `otp_attempts` increment was being undone on every wrong code —
the session counter never actually worked. The verify handler now returns an outcome, commits, and
raises the error afterwards.

---

## 2. What this does NOT close

These remain exactly as the compliance report described them:

1. **Providers are still sandbox.** OCR, screening lists and biometrics accept only `sandbox`/`none`.
   Scheduled re-screening now runs on a cadence, but against synthetic list fixtures until a
   licensed list source is wired through `providers/screening-lists.ts`. The SMS seam is real, but
   needs carrier credentials.
2. **Organisational items (BR-1, BR-2).** e-KYC policy, oversight function, QCB approval, the Didit
   outsourcing contract and approval, OWASP/penetration-test evidence. Code cannot close these.
3. **Phase 2 remainder** — licensed document-AI (photo replacement, font/layout checks), active
   liveness challenges on the Didit path or a PAD-certified engine for the native path, NFC with
   CSCA master-list provisioning.
4. **Phase 3** — text-to-speech in capture (FR-4), injection/deepfake detection, annual biometric
   performance review.
5. **KMS.** `FIELD_ENCRYPTION_MASTER_KEY` is still an env value; envelope encryption with a managed
   KMS is unchanged.
6. **Residency proof for eligibility (BR-3).** The rule covers nationality; a residency signal is not
   collected as structured data, so the residency half of BR-3 is still open.

---

## 3. Configuration to set before a regulated deployment

```bash
# Identity (marketplace)
KYC_EKYC_REQUIRED=true              # default when KYC_API_KEY is set
KYC_ALLOW_STAFF_MANUAL_IDENTITY=false   # only if branch intake is not used

# OTP delivery (KYC platform)
NOTIFICATION_PROVIDER=twilio        # or http
TWILIO_ACCOUNT_SID=... TWILIO_AUTH_TOKEN=... TWILIO_MESSAGING_SERVICE_SID=...
SMS_SENDER_ID=BLOX

# Session protections
ALLOWED_COUNTRIES=QA
GEO_REQUIRE_HEADER=true             # once traffic only arrives through the edge
OTP_MAX_ATTEMPTS=5
OTP_LOCKOUT_HOURS=24

# Monitoring + retention
RESCREEN_INTERVAL_DAYS=30
RETENTION_YEARS=10
RETENTION_ENFORCE=true              # only after the retention policy is approved
```

Then: `npm run migrate` (adds migration `0005_brd_compliance.sql`) and
`npm run rules:eligibility`, followed by activating the drafted rule version in the Rules console.

---

## 4. Verification performed

* `blox-kyc-module`: shared 34 tests, API 112 tests (26 new across session protections, SMS
  delivery and eligibility rules) — all passing. TypeScript clean for API, shared, console and
  capture; `flutter analyze` clean (3 pre-existing info lints).
* `blox-marketplace`: `application-documents` and `submit-gates` suites, 31 tests including 7 new
  e-KYC policy cases — passing; API TypeScript clean.
* Migration `0005` applied to a live database; both sweeps executed against real data (the
  retention purge was exercised end-to-end with `RETENTION_YEARS=0` on the local dev database).
* **19/19 live checks** against a running API: geo block/allow, lockout including survival across a
  new invite link, device binding accept/refuse/stolen-token, legal hold set/lift, all four reports
  including their authentication requirement, and the fraud report counting the blocked attempts
  from the audit trail.
