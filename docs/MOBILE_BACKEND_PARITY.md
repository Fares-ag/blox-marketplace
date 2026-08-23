# Mobile backend parity (blox-app ↔ blox-marketplace)

Single source of truth: NestJS + Prisma + Better Auth + S3 in `packages/api`.
blox-app must not talk to Supabase after cutover.

## Feature decisions (Phase 0.3)

| Feature | Decision | Rationale |
|---------|----------|-----------|
| `blox_membership` / payment deferrals | **Keep** | Used on dashboard/profile; add `PaymentDeferral` + `Application.bloxMembership` JSON |
| Offer accept screen | **UX remap** | Marketplace has no separate offer endpoint. Status `approved` / `contract_signing_required` is the offer. Mobile `GET …/offer` is a compatibility adapter over application + pricing snapshot |
| Pre-disbursal checklist | **UX remap** | Adapter over application status (`contract_signing_required`, `down_payment_required`, documents) — no extra lifecycle |
| Auth | **Email + password + Bearer tokens** | Marketplace has no customer OTP. Migrated Supabase users must set a new password |
| KYC identity OCR | **blox-kyc-module** | Marketplace owns the integrator bridge (`kycCaseId` on Application) |
| Credits | **Keep** | New `UserCredit` model + mobile pay/claim endpoints |
| Push tokens | **Keep** | New `DeviceToken` model |

## Status mapping (offer / pre-disbursal)

| blox-app screen | Marketplace status / data |
|-----------------|---------------------------|
| Offer | Application `status` + `pricingSnapshot` (adapter `GET /api/v1/mobile/applications/:id/offer`) |
| Accept offer | `POST /api/v1/applications/:id/submit` if draft, else no-op when already past review |
| Pre-disbursal | Derived: KYC verified + required docs + contract flags |
| Contract sign | `POST /api/v1/applications/:id/contract/signed` |
| Documents | Multipart to Nest; QID/passport via KYC bridge |

## API versioning

Canonical Nest paths are `/api/v1/...`. Mobile clients must use that prefix.
The web client’s unversioned `/api/...` calls are out of scope for this cutover.
