# Ops Vercel Parity — Stack Mapping

Behavior spec: `blox-vercel/blox-production/packages/admin/src/modules/admin/features/`

Implementation: `blox-marketplace` (NestJS + Prisma + Vite + `@drivemarket/shared`).

## Do NOT adopt from vercel

| vercel | marketplace keeps |
|--------|-------------------|
| Supabase PostgREST / RPC from UI | NestJS REST + `apiFetch` |
| Edge Functions | NestJS services |
| `@admin-module` MUI pages | `ops-ui-v2` + `ops-applications` |
| Supabase Auth | Better Auth + MFA |
| Redux admin store | React Query + local state |

## RPC → REST equivalence

| vercel RPC / action | marketplace endpoint |
|---------------------|----------------------|
| `get_dashboard_stats` | `GET /api/ops/dashboard-stats` |
| `get_revenue_forecast` | `GET /api/ops/analytics/revenue-forecast` |
| `get_conversion_funnel` | `GET /api/ops/analytics/conversion-funnel` |
| `get_payment_collection_rates` | `GET /api/ops/analytics/payment-collection-rates` |
| `get_customer_lifetime_value` | `GET /api/ops/analytics/customer-lifetime-value` |
| `replacePaymentSchedulesFromInstallmentPlan` | `POST /api/ops/applications/:id/sync-schedules` (internal + lifecycle hooks) |
| Application list w/ payment health | `GET /api/ops/applications` (extended list DTO) |
| Credit queue deal column | queue DTO includes `pricing_snapshot`, `installment_plan`, product |
| Activity stats | `GET /api/ops/activity-stats` |

## Data model

| vercel | marketplace |
|--------|-------------|
| `applications.installment_plan` JSON | `Application.installmentPlan` (restored) |
| `pricing_snapshot` / hide-interest fields | `pricingSnapshot` + dual-write |
| `payment_schedules` table | `PaymentSchedule` (synced from plan on activate) |

## Schedule resolution (UI)

Pre-active: `installment_plan.schedule` via `resolveDisplaySchedule()`.  
Post-active: merge live `payment_schedules` with plan metadata for ownership columns.

## Portal mapping

| vercel | marketplace |
|--------|-------------|
| Admin | `packages/admin` |
| Credit | `packages/credit` (+ dashboard extra) |
| Dealer | `packages/dealer` (+ inventory/quotes) |
| Super-admin audit | `packages/super-admin` (+ governance) |
| Finance (in admin) | `packages/finance` + admin overlap |
