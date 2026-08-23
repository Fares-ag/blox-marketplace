# Supabase → Prisma entity mapping

Authoritative ID strategy: `migration_id_map` (`entity` + `source_id` → `target_id`).
All FKs must be rewritten through this table. Re-runs are idempotent.

## Identity

| Source | Target | Notes |
|--------|--------|-------|
| `auth.users.id` (uuid) | `users.id` (cuid) | Email unique key; password hashes **not** imported |
| `auth.users.email` | `users.email` | Lowercased |
| `auth.users.email_confirmed_at` | `users.emailVerified` | Confirmed → true |
| `auth.users.raw_user_meta_data` | `users.name`, `phone`, `qid` | first/last → `name` |
| `public.users.role` | `users.role` | Default `customer` if missing |
| — | `accounts` | No credential row until password reset |

## Catalog

| Source | Target |
|--------|--------|
| `products.id` | `products.id` via map |
| `products.make/model/trim/model_year` | same Prisma fields |
| `products.condition` (`old`) | `used` |
| `products.status` (`active`) | `listingStatus = published` |
| `products.images[]` / storage URLs | `product_images.storagePath` after copy to `listing-images` |
| Missing `company_id` | Seed/default company from `MIGRATION_DEFAULT_COMPANY_ID` |
| Missing `slug` | `slugify(make-model-year-sourceId)` |

## Applications

| Source column | Target |
|---------------|--------|
| `id` | mapped cuid |
| `customer_email` | `customerEmail` + resolve `customerUserId` |
| `customer_name`, `customer_phone`, `customer_info` | `customerSnapshot` JSON (`full_name`, `firstName`, `lastName`, `phone`, `qid`/`nationalId`, `nationality`, `gender`, `employment`, `income`) |
| `vehicle_id` | `productId` via product map |
| `offer_id` | `offerId` or product `defaultOfferId` |
| `loan_amount`, `down_payment`, rates, `installment_plan` | `pricingSnapshot` |
| `status` | `ApplicationStatus` (same 13 values) |
| `resubmission_comments` | `resubmissionComment` |
| `contract_*` | `contractPdfPath` / `signedContractPath` |
| `blox_membership` | `bloxMembership` JSON |
| `kyc_case_id`, `kyc_status` | `kycCaseId`, `kycStatus` |
| `documents[]` JSON | `application_documents` rows |

### Document category map

| blox-app `category` / `kycDocumentType` | Prisma `DocumentCategory` |
|----------------------------------------|---------------------------|
| `id`, `qatar-id`, `qid_front`, `qid_back` | `qid` |
| `passport` | `passport` |
| `bank`, `bank-statement` | `bank` |
| `salary`, `salary-certificate` | `salary` |
| `license`, `driving-license` | `license` |
| `other`, `additional` | `other` |

## Payments / other

| Source | Target |
|--------|--------|
| `payment_schedules` | `payment_schedules` (sequence assigned by due date order if missing) |
| `payment_transactions` | `payment_transactions` (`gateway=skipcash` unless method says otherwise) |
| `notifications.user_email` | `notifications.userId` via email map |
| `user_credits.user_email` + `balance` | `user_credits` |
| `device_tokens` | `device_tokens` |
| `payment_deferrals` | `payment_deferrals` |

## Storage copy

| Supabase | S3 bucket |
|----------|-----------|
| `documents/application-documents/{appId}/*` | `kyc-docs` |
| `documents/signed-contracts/{appId}/*` | `contracts` |
| Product public images | `listing-images` |
