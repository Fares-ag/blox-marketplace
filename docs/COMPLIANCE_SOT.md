# Compliance / KYC system of record

This is the runbook for who owns each decision in the Blox origination stack.
Flags that change behaviour default **off in production** (`MUSHARAKAH_REGISTER_ENABLED`,
`UNIT_OFFERS_ENABLED`, `LPO_GATE_ENABLED`, `PRE_DISBURSAL_GATE_ENABLED`,
`KYC_WEBHOOK_DRIVES_STATUS`). After enabling globally, run
`npm -w @drivemarket/api run db:enable-musharakah-rollout` so company-level
unit offers are not left at the schema default (`false`).

| Concern | System of record | Marketplace role |
|---------|------------------|------------------|
| Identity verification (OCR, liveness, face match) | `blox-kyc-module` | `kyc-bridge.service.ts` consumes signed webhooks and syncs document slots |
| Sanctions / AML screening decision | `blox-kyc-module` (`screening.completed`) | Marketplace `ComplianceService` is **not** the production AML path; do not enable a second screening stack |
| Credit / affordability / DBR | Marketplace `creditAssessment` | Unchanged |
| Application status (ops legal state) | Marketplace `ApplicationStatus` | KYC webhooks may *hint* transitions only when `KYC_WEBHOOK_DRIVES_STATUS=true` |
| Ownership units | Marketplace `OwnershipRegister` (when flag on) | Dual-write with computed `ownership.ts` until reconciliation passes |

## KYC webhook events (idempotent)

Marketplace stores `lastKycWebhookEventId` / `lastKycWebhookAt` on the application.
Duplicate `event_id` values are ignored.

| Event | Effect when `KYC_WEBHOOK_DRIVES_STATUS` is on |
|-------|-----------------------------------------------|
| `kyc.approved` | Documents + `kycStatus` sync only (credit still decides) |
| `kyc.rejected` | `under_review` → `resubmission_required` |
| `kyc.manual_review` | Customer notification |
| `screening.completed` | Event recorded; AML outcome stays in the KYC module |
| `rekyc.triggered` | Customer notification on `active` contracts |
| `document.expiring` | Customer notification |

## Partner path

`partner_processing` applications stay frozen. Admin-only exits:
`partner_processing → under_review | rejected`. No ownership register or LPO
on the partner path until those exits are used in production.

## Retention

KYC retention purge (`RETENTION_YEARS`, default 10) must not erase a case whose
`external_ref` is an **active** marketplace financing. Operators place a
**legal hold** on those cases. After `completed` / `rejected`, the KYC window
applies as usual.
