# API response shape changelog (snake_case standardization)

All JSON **response** bodies now use **snake_case** field names and pass through explicit `toXxxDto()` mappers. Request DTOs are unchanged (camelCase).

## Convention

- **Mapper pattern:** explicit allow-list functions in `*-response.dto.ts` (not raw Prisma, not ClassSerializerInterceptor).
- **Shared offer shape:** `annual_rent_rate`, `tenure_options`, `min_down_payment_pct`, `finance_partner_id`.

## Endpoints whose response casing/shape changed

| Endpoint | Before | After |
|---|---|---|
| `GET/POST/PATCH /applications/*` (all application reads/writes) | camelCase (`customerUserId`, `contractGenerated`, `paymentSchedules`, …) | snake_case (`customer_user_id`, `contract_generated`, `payment_schedules`, …) |
| `GET /applications/blocking` | `applicationId` | `application_id` |
| `GET /offers` | raw Prisma camelCase | snake_case via `toPublicOfferDto` |
| `GET /finance-partners` | raw Prisma camelCase | snake_case (`crm_adapter`, …) |
| `GET/POST /dealer/quotes`, `GET /dealer/quotes` | camelCase inline maps | snake_case (`customer_email`, `negotiated_price`, `created_by`, …) |
| `GET /quotes/:token` | mixed camelCase + snake offer | all snake_case (`customer_email_masked`, `public_list_price`, `image_path`, …) |
| `GET/PATCH /dealer/inventory/*` | camelCase (`modelYear`, `listingStatus`, …) | snake_case |
| `GET /companies/all`, `POST/PATCH /companies`, `GET /companies/mine` | camelCase admin company | snake_case (`allow_direct_activate`, `can_pay`, `logo_url`, …) |
| `GET/PATCH /users` | raw / partial camelCase | snake_case (`company_id`, `is_active`, `email_verified`, …) |
| `GET /notifications` | camelCase | snake_case (`link_path`, `read_at`, `created_at`) |
| `POST /ops/applications/:id/compliance-check` | raw Prisma `ComplianceCheck` | allow-list snake_case (no raw `identityResult` JSON) |
| `POST /payments/skipcash/complete` (`already_completed`) | raw Prisma `transaction` | snake_case `toPaymentTransactionDto` |

## Unchanged (already snake_case)

- `GET/PATCH /me`
- `GET /products`, `GET /products/by-slug/:slug`
- `GET /companies`, `GET /companies/by-code/:code`
- `GET /ops/*`, payment schedule ops endpoints
- Error envelope `{ error: { code, message, requestId } }`

## Frontend types updated

Shared types in `packages/shared/src/types/domain.ts`: `ApplicationDetail`, `ApplicationListItem`, `DealerInventoryItem`, `DealerQuoteItem`, `NotificationItem`, `AdminUser`, `AdminCompany`, `PublicOffer`, `FinancePartner`.

Apps updated: `marketplace`, `credit`, `dealer`, `admin`, `super-admin`, `finance`.
