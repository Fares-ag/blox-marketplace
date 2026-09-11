# BLX-TPL-004 — KYC/AML field map (v1.2)

Credit Appraisal Memorandum merge fields populated from **blox-kyc-module** (system of record for identity, screening, and AML risk). Marketplace credit/affordability fields stay on `Credit.*`, `Bureau.*`, `Deal.*`.

## Section 1 — Facility summary (identity keys)

| Merge field | KYC source | Notes |
|-------------|------------|-------|
| `{{KYC.FullNameEN}}` | `extracted_identity.full_name` or declared identity | Replaces `Customer.FullNameEN` |
| `{{KYC.QID}}` | `extracted_identity.qid_number` | Replaces `Customer.QID` |

## Section 4 — Compliance & screening (all `KYC.*`)

| Merge field | KYC API / event | Value rule |
|-------------|-----------------|------------|
| `{{KYC.CaseId}}` | `GET /cases/:id` → `id` | Link via `Application.kycCaseId` |
| `{{KYC.CaseStatus}}` | case `status` | e.g. APPROVED, MANUAL_REVIEW, REJECTED |
| `{{KYC.CaseOpenedAt}}` | case `created_at` | |
| `{{KYC.CaseUpdatedAt}}` | case `updated_at` | |
| `{{KYC.Provider}}` | verification summary | `didit` or `native` |
| `{{KYC.ProviderStatus}}` | `didit_session_status` / overall_status | |
| `{{KYC.ProviderVerifiedAt}}` | `didit_verified_at` | |
| `{{KYC.IdentityVerifiedAt}}` | latest id doc processed_at | Pass if all QID slots verified |
| `{{KYC.IdentityResult}}` | `checks.id_document.status` | passed / failed / processing |
| `{{KYC.BiometricsVerifiedAt}}` | liveness result timestamp | |
| `{{KYC.LivenessResult}}` | `checks.liveness.status` | |
| `{{KYC.FaceMatchResult}}` | `checks.face_match.status` | |
| `{{KYC.SanctionsScreenedAt}}` | `aml_screenings.completed_at` | From `screening.completed` webhook |
| `{{KYC.SanctionsResult}}` | `screening.sanctions_true_match`, `hard_sanctions_hit` | Clear / Potential / True match |
| `{{KYC.PEPScreenedAt}}` | same screening run | |
| `{{KYC.PEPResult}}` | `screening.pep_confirmed` | Clear / Confirmed PEP |
| `{{KYC.PEPRelationReviewedAt}}` | MLRO adjudication timestamp | Manual if declared |
| `{{KYC.PEPRelationResult}}` | case notes / alert disposition | |
| `{{KYC.AdverseMediaScreenedAt}}` | screening run | |
| `{{KYC.AdverseMediaResult}}` | `open_adverse_media_score` | Clear if score = 0 |
| `{{KYC.FinancialProfileDate}}` | `financial_profiles.updated_at` | |
| `{{KYC.IncomeSourceClassification}}` | `derived.income_source_classification` | salary / business / mixed / unknown |
| `{{KYC.RiskAssessedAt}}` | latest risk assessment | |
| `{{KYC.RiskBand}}` | risk engine `band` | LOW / MEDIUM / HIGH / PROHIBITED |
| `{{KYC.RiskScore}}` | risk engine `score` | |
| `{{KYC.RiskDecision}}` | risk engine `action` | auto_approve / manual_review / senior_review / reject |
| `{{KYC.EDDRequired}}` | `eddRequired` flag | Yes / No |
| `{{KYC.SeniorReviewAt}}` | senior review completed_at | When action = senior_review |

**Blocking:** CAM must not approve when `RiskBand = PROHIBITED`, `SanctionsResult = True match`, or open screening alerts without MLRO disposition (see template blocking rule).

## Section 5 — Applicant profile (KYC-backed)

| Merge field | KYC source |
|-------------|------------|
| `{{KYC.Nationality}}` | declared identity `nationality` (ISO-3) |
| `{{KYC.Age}}` | computed from declared / extracted DOB |
| `{{KYC.EmployerName}}` | declared employment + OCR cross-check |
| `{{KYC.VerifiedMonthlyIncome}}` | `financial.derived.avg_monthly_income_minor` |
| `{{KYC.IncomeVerificationSource}}` | salary cert + bank OCR reconciliation |

Fields still owned by **marketplace application snapshot** (not KYC): `ResidencyStatus`, `YearsInQatar`, `HousingStatus`, `Employment.EmployerCategory`, `ServiceYears`, `ContractType`.

## Section 2 — Affordability overlap

KYC financial profile feeds verified income; marketplace still computes DBR against bureau obligations:

- `{{KYC.VerifiedMonthlyIncome}}` → was `{{Income.TotalMonthly}}`
- `{{KYC.IncomeVerificationSource}}` → was `{{Income.VerificationSource}}`

## Implementation note

CAM PDF generation should call:

1. Marketplace application + credit assessment DTOs
2. KYC case detail (`GET /v1/cases/:id`) and verification summary
3. Latest risk assessment + screening dispositions

Webhook `screening.completed` triggers marketplace to refresh cached KYC snapshot on the application before CAM render.
