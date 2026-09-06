# KYC compliance check against `blox_brd_qatar_ekyc.docx` — 2026-09-07

Mode: READ / REPORT. No code was changed. Scope is the standalone KYC platform (`blox-kyc-module`:
`apps/api`, `apps/capture`, `apps/dashboard`, `apps/mobile`, `packages/shared`) plus the KYC
touchpoints inside `blox-marketplace` (`packages/api/src/kyc`, application document rules,
`KycVerificationPanel`). Every verdict cites the file it rests on.

## 1. Verdict

**Not fully compliant.** The platform meets the technical core the BRD asks for in Phase 1 and
most of Phase 2, but it does not satisfy the BRD as a whole. Counting the 12 business requirements
and 18 functional requirements:

| Status | BR (12) | FR (18) | Meaning |
|---|---|---|---|
| Met | 3 | 8 | Implemented and evidenced in code |
| Partial | 6 | 6 | Implemented in part, or only with sandbox providers that production refuses to boot with |
| Gap | 1 | 4 | Nothing in code implements it |
| Organisational | 2 | 0 | Governance, approvals, contracts — cannot be met by code alone |

Three things block a "compliant" statement regardless of anything else:

1. **Every verification provider is sandbox.** OCR, screening lists and biometrics accept only
   `sandbox`/`none` in config, and production refuses to start unless `PROVIDERS_ALLOW_SANDBOX=true`
   (`apps/api/src/config.ts:41-101`). Didit is the only production-grade path, and it is an
   outsourced e-KYC provider, which under BR-2 needs QCB approval before use.
2. **No geo-fencing, IP verification or device linking** exists anywhere; only the IP and user
   agent are stored on the session and consent rows (`modules/onboarding/routes.ts:86,160`).
3. **The marketplace still accepts a manually uploaded QID image as the identity document**, which
   bypasses consent-gated capture, OTP, liveness and authenticity checks
   (`packages/api/src/applications/application-documents.ts:30-31`).

## 2. Business requirements

| ID | Requirement (short) | Status | Evidence | Gap |
|---|---|---|---|---|
| BR-1 | Governance model, dedicated oversight function | Organisational | Roles `compliance_officer`, `compliance_manager`, `auditor` exist (`packages/shared/src/rbac.ts`); maker-checker in cases | No e-KYC policy document, no named oversight function; nothing code can prove |
| BR-2 | QCB approval before go-live; separate approval for outsourcing | Organisational | `docs/PRODUCTION_PROVIDERS.md` lists REG-003/007/031 as gates | Didit (`docs/DIDIT.md`) is an outsourced e-KYC provider and needs prior QCB approval plus a contract with audit and termination rights; none is evidenced |
| BR-3 | Eligibility criteria; restrict foreign nationals unless approved | Gap | Nationality is captured (`risk/signals.ts:82`) but no rule uses it; seeded rule sets have no nationality or residency rule (`db/seed.ts`) | Add an eligibility rule (Qatar ID holders only until exceptional approval) that hard-fails or routes to review |
| BR-4 | Purpose disclosure and consent before processing; data minimisation | Met | `consents` table stores purpose, granted, text version, text shown, IP, UA, timestamp, case link (`0001_init.sql:181-191`); purposes scale with required documents (`modules/consent/purposes.ts`); consent step precedes identity and documents (`apps/capture/src/pages/OnboardPage.tsx:20`) | Marketplace collects the applicant snapshot on its own form before the KYC consent (see §5) |
| BR-5 | Publish acceptable documents; QID and ICAO passport; scanning, optional NFC | Partial | `DOCUMENT_TYPES` limited to qid_front/back, passport and supporting docs (`packages/shared/src/types.ts:49-61`); MRZ parser (`packages/shared/src/mrz.ts`); eMRTD passive authentication (`modules/intelligence/emrtd.ts`) | No NFC read on mobile (no NFC plugin in `apps/mobile`); eMRTD verification needs a CSCA master list not yet provisioned; acceptable-document list is shown in-app but not published in terms and conditions |
| BR-6 | Approved channels; encrypted on-device temp data and wipe; geo-fencing; IP verification; OTP MFA | Partial | Web and Flutter channels; OTP to phone via SMS outbox with 5-attempt cap (`modules/onboarding/routes.ts:18-59`); web keeps only the session token in `sessionStorage` (`apps/capture/src/api.ts`) | No geo-fencing or IP verification logic; mobile camera plugin writes captures to the device file system with no encryption or explicit wipe (`camera_scanner.dart:373`); SMS provider is `console` unless a real one is configured |
| BR-7 | Randomised real-time liveness; block stills and edited video; anti-deepfake | Partial | Server-issued single-use randomised challenges with TTL and case binding (`modules/biometrics/challenge.ts`), consumed by the Flutter selfie step; liveness capture sanity checks (`file-security.ts`); device attestation header read (`biometrics/routes.ts:78`) | Native biometric provider is `none`/`sandbox` only; the Didit path uses **passive** liveness with no randomised actions; no PAD-certified engine, no injection/deepfake detection beyond optional attestation |
| BR-8 | Live document scan, identity data, onboarding form; live photo/video; trusted DB; visual authenticity; VIZ/MRZ or QR consistency | Partial | Camera capture (`CameraCapture.tsx`, `camera_scanner.dart`); declared identity form bound to case; quality gate (`intelligence/quality.ts`); authenticity rule set (`intelligence/authenticity`, `0003_authenticity_rules.sql`); MRZ vs VIZ cross-check via `mrz.ts`; duplicate QID and tamper fixtures | OCR provider is sandbox; no trusted third-party or government source (REG-007 open, `Qatar_KYC_Platform_SRS.md` §Regulatory grounding); no QR validation |
| BR-9 | Sanctions screening before and continuously; escalation, blocking, reporting, EDD | Partial | Matching engine with transliteration, DOB and nationality corroboration (`screening/matching.ts`); internal watchlist; adjudication with immutable history; `PROHIBITED` band blocks (`risk/engine.ts:74-136`); EDD flag forces senior review | List source is sandbox fixtures only; re-screening is manual (`POST /cases/:id/rescreen`), the hourly sweep handles document expiry not list updates (`workers/expiry.ts`); no STR/FIU reporting workflow |
| BR-10 | High-risk identification; re-registration and failed-attempt controls; manual continuation | Partial | Risk bands route to `manual_review`/`senior_review`/`reject` (`risk/engine.ts`); reviewer workspace; terminal cases block re-intake (`cases/intake.ts:27-41`); OTP capped at 5 attempts; duplicate QID signal | No configurable threshold for failed onboarding attempts across sessions, no device tagging, no cooling-off or block after repeated failures |
| BR-11 | Sector security regulation; encrypt personal and biometric data; OWASP validation; continuous monitoring | Partial | AES-256-GCM per-tenant envelope encryption for fields and stored documents (`lib/crypto.ts`, `documents/storage.ts`); append-only audit; rate limiting; malware scan and type sniffing on uploads | Master key is an env variable, KMS/vault pending (SEC-018); no OWASP or penetration test evidence in either repo; no security monitoring or incident pipeline |
| BR-12 | Audit logs, fraud and security violation reports, KRIs, annual biometric performance reporting | Partial | Append-only `audit_logs` and `data_access_logs` with triggers (`0001_init.sql:556-573`); audit page in dashboard; KPI endpoint (`admin/routes.ts:317`) | No fraud-attempt report, no security-violation report, no KRI set, no biometric performance reporting |

## 3. Functional requirements

| ID | Requirement (short) | Status | Evidence | Gap |
|---|---|---|---|---|
| FR-1 | Consent language before capture, time-stamped and session-linked | Met | Consent step before identity/documents; `consents` row per purpose with `created_at`, `case_id`, `text_version`, `text_shown` | — |
| FR-2 | Show acceptable types, reject unsupported | Partial | Slots rendered per case requirements; server rejects unknown types and sniffs file content (`documents/file-security.ts`) | Web `accept` attribute allows `application/json` and `image/*` broadly (`DocumentsStep.tsx:186,212`); terms page does not list the accepted documents |
| FR-3 | Live scan, OCR, NFC where applicable | Partial | Camera capture on web and mobile; OCR pipeline with field routing and confidence (`intelligence/routing.ts`); eMRTD hash and SOD verification on the API | OCR provider sandbox only; no NFC capture on device |
| FR-4 | Arabic and English; text identification; text-to-speech | Partial | Full AR/EN with RTL in capture, dashboard and Flutter (`i18n.tsx`, `l10n.dart`); Arabic normalisation and transliteration in shared | No text-to-speech anywhere; "text identification" only as OCR |
| FR-5 | Form data bound to identity session | Met | Declared identity saved on the case and compared with OCR (`cases/identity-routes.ts`, `identity-bundle.ts`) | — |
| FR-6 | OTP MFA to registered phone | Met (code) | 6-digit OTP, hashed, TTL, 5 attempts, SMS channel through the notification outbox | Production SMS provider must be configured; dev returns the OTP in the response when `NOTIFICATION_PROVIDER=console` |
| FR-7 | Geo-fencing and IP verification | Gap | IP stored only | Implement country allow-list, VPN/proxy detection and device linking at registration and at each step |
| FR-8 | Randomised liveness; reject stills and edited video | Partial | Randomised challenge issued and redeemed once per case (`challenge.ts`); reasons recorded | Only the native path uses it and its provider is sandbox; Didit path is passive liveness |
| FR-9 | Selfie or video verified against the document | Partial | Face-match score recorded with liveness (`biometrics/routes.ts:150-194`); Didit face match ingested (`didit/ingest.ts`) | Native provider sandbox; Didit needs QCB outsourcing approval |
| FR-10 | Authenticity: photo replacement, data integrity | Partial | Authenticity rule set with tunable weights, quality assessment, MRZ checksum and VIZ consistency, tamper fixtures pass the pipeline | Photo-replacement detection depends on the document-AI provider, which is sandbox |
| FR-11 | Cross-verify with trusted third-party or regulated sources | Gap | Provider seam exists (`providers/document-ai.ts`, `providers/ocr.ts`) | No integration; REG-007 unresolved |
| FR-12 | Sanctions screening before and continuously | Partial | Pre-decision screening job (`workers/screening.ts`), manual rescreen | No scheduled rescreen against refreshed lists; sandbox lists |
| FR-13 | Route high-risk, failed, suspicious cases to review | Met | Risk engine actions, `MANUAL_REVIEW` state, reviewer queue with maker-checker | — |
| FR-14 | Limit re-registration; block after configurable failures | Partial | Terminal-state re-intake block, OTP attempt cap, duplicate QID flag | No cross-session failure counter, no configurable threshold, no device or identity block list |
| FR-15 | Encrypted transmission and storage of personal and biometric data | Met (code) | AES-256-GCM envelope for fields and document blobs; selfie/liveness files go through the same storage | TLS is a deployment property; key management is env-based until KMS |
| FR-16 | Reports on fraud attempts, incidents, KRIs, biometric performance | Gap | KPI endpoint and audit page only | Build the four reports; define KRIs |
| FR-17 | Certificate authority and digital signature repositories where required | Gap (conditional) | None | Only needed if e-signature is in scope; not addressed |
| FR-18 | Complete audit trail of decisions, checks, alerts, user actions | Met | Append-only audit and data-access logs, screening adjudication history immutable, webhook deliveries logged | — |

## 4. Non-functional, process and risk items

| Area | Status | Note |
|---|---|---|
| Security: encryption at rest and in transit | Met (code) | Per-tenant AES-256-GCM; RLS with `FORCE ROW LEVEL SECURITY`; least-privilege DB role documented |
| Security: OWASP validation before deployment | Gap | No test report, no pipeline gate, no record in either repo |
| Security: continuous monitoring and violation reports | Gap | Rate limiter is in-memory per replica; no SIEM, alerting or violation reporting |
| Privacy: PDPPL data minimisation | Partial | Consent purposes are scoped to required documents; `organizations.settings` reserves retention windows but nothing enforces retention or deletion |
| Privacy: third-party processing under consent | Partial | Didit processes biometrics; consent text does not name the processor; the SRS flags biometric data as "special data" needing a permit (REG-003) |
| Performance: annual biometric performance review | Gap | No metrics captured for FAR/FRR or PAD outcomes |
| Audit: external assessment support and evidence retention | Partial | Immutable logs exist; retention period is not enforced (SRS cites up to 10 years) |
| Target journey step 6: authenticity, consistency, geo-fencing, IP, device linking | Partial | First two done; last three missing |
| Target journey step 8: auto-approve / review / reject per thresholds | Met | Rule sets with band thresholds and per-band actions, editable in the dashboard (`RulesPage.tsx`) |
| Outsourcing requirements | Organisational | Didit contract must carry confidentiality, QCB audit rights over Didit and subcontractors, and termination rights; due diligence pack not evidenced |
| Risk: repeat fraud attempts, device tagging, alert triggers | Gap | See FR-14 |

## 5. Marketplace integration findings

These are outside the KYC module but decide whether the *lending journey* complies.

1. **Manual upload bypass (P1).** `hasQidRequirement` accepts any document in category `qid` or `id`
   as satisfying the identity requirement, with no verification status
   (`application-documents.ts:30-31`). A customer or dealer can upload a photo of an ID and skip
   OTP, liveness and authenticity entirely. Under BR-7/BR-8 this must not count as e-KYC.
2. **Data before consent (P2).** The marketplace application form collects name, QID, phone,
   income and employment into `customer_snapshot` before the KYC consent step runs
   (`applications.service.ts:create`). The marketplace's own privacy notice and consent at sign-up
   need to cover this, or the snapshot should be collected after KYC consent.
3. **Case creation is server-to-server (fine).** The bridge creates the case and an invite, and the
   customer completes OTP, consent and capture inside the KYC platform
   (`kyc-bridge.service.ts:64-103`). Documents and verification status sync back by webhook.
4. **Corporate applicants.** The marketplace supports corporate applications; the BRD scopes the
   regulation to individuals. Corporate KYC (CR, signatory ID) has no e-KYC path and should be
   marked as manual CDD, not e-KYC.
5. **Staff-uploaded identity documents.** Ops can upload KYC documents on behalf of the customer
   (`ops/applications/:id/documents`), which is a walk-in channel the BRD does not contemplate as
   e-KYC; it needs a documented face-to-face verification procedure.

## 6. Remediation, ordered by the BRD's own phases

**Phase 1 — Compliance foundation (blocks any regulated deployment)**
1. Close the manual-upload bypass: identity is satisfied only by verified KYC slots.
2. Configure a real SMS provider and remove the OTP echo outside development.
3. Add the eligibility rule for nationality and residency (BR-3) as a hard-fail rule in the seeded rule set.
4. Add scheduled re-screening (daily) against refreshed lists and an STR escalation state; wire a licensed list provider through `providers/screening-lists.ts`.
5. Build the reporting set: fraud attempts (authenticity fails, duplicate QID, liveness fails), security violations (rate-limit hits, auth lockouts, attestation failures), KRIs, and biometric outcomes. Expose them beside `/reports/kpis`.
6. Enforce retention: per-tenant retention windows with a purge worker and a legal-hold flag.
7. Governance pack: e-KYC policy, oversight function, QCB approval submission, Didit outsourcing approval and contract terms, OWASP or penetration test report.

**Phase 2 — Verification enhancement**
8. Geo-fencing, IP reputation and device linking at registration and per step; persist device identifiers for tagging.
9. Licensed OCR and document-AI provider (photo replacement, font and layout checks) through the existing seams; QR validation where the document carries one.
10. Liveness: either enable randomised challenges on the Didit flow (active mode) or move to a PAD-certified engine for the native path; capture and store liveness outcomes for performance reporting.
11. NFC on mobile with CSCA master list provisioning so `emrtd.ts` can run passive authentication.
12. Cross-session failure counters with configurable thresholds, cooling-off and block lists (FR-14).

**Phase 3 — Scale**
13. Text-to-speech in the capture flow (FR-4), KRI dashboards, injection and deepfake detection, annual biometric performance review.

## 7. Evidence index

- Consent: `blox-kyc-module/apps/api/src/db/migrations/0001_init.sql:181`, `apps/api/src/modules/consent/purposes.ts`, `apps/capture/src/steps/ConsentStep.tsx`
- OTP and session: `apps/api/src/modules/onboarding/routes.ts`, `apps/api/src/auth/*`
- Liveness and face: `apps/api/src/modules/biometrics/*`, `apps/api/src/modules/didit/*`, `apps/mobile/lib/kyc_capture/screens/selfie_step.dart`
- Documents and authenticity: `apps/api/src/modules/documents/*`, `apps/api/src/modules/intelligence/*`, `apps/api/src/db/migrations/0003_authenticity_rules.sql`, `packages/shared/src/mrz.ts`
- Screening and risk: `apps/api/src/modules/screening/*`, `apps/api/src/workers/screening.ts`, `apps/api/src/modules/risk/*`
- Security: `apps/api/src/lib/crypto.ts`, `apps/api/src/modules/documents/storage.ts`, `apps/api/src/auth/guard.ts`, `apps/api/src/config.ts`
- Audit and reports: `apps/api/src/db/migrations/0001_init.sql:556`, `apps/api/src/modules/admin/routes.ts:317`
- Marketplace: `blox-marketplace/packages/api/src/kyc/*`, `packages/api/src/applications/application-documents.ts`
- Provider and regulatory status: `blox-kyc-module/docs/PRODUCTION_PROVIDERS.md`, `docs/DIDIT.md`, `blox-marketplace/docs/Qatar_KYC_Platform_SRS.md` (Regulatory grounding)
