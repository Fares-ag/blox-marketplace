# Data flow — JSON snapshots and portal visibility

Authoritative domain rules live in [blox-production/docs/drivemarket/03_DOMAIN_MODEL.md](../blox-production/docs/drivemarket/03_DOMAIN_MODEL.md). This note documents the **runtime JSON blobs** and who reads/writes them.

## customerSnapshot (Application.customerSnapshot)

Set at apply (draft create). Immutable after submit except via resubmission flows that replace docs, not the snapshot itself.

| Field | Required | Written by | Read by |
|-------|----------|------------|---------|
| `full_name` | yes | Marketplace apply wizard | Credit UI, contract PDF, Zoho lead |
| `phone` | yes | Apply wizard | Dealer lead list, contract PDF, Zoho |
| `qid` | yes | Apply wizard | Contract PDF, compliance |
| `employment`, `income` | optional | Apply wizard | Credit review (when captured) |

Side effect: copies name/phone/qid onto `users` when empty.

## pricingSnapshot (Application.pricingSnapshot)

Built server-side from list price, offer rates, and customer tenure/down payment selections ([quote-pricing.ts](../packages/api/src/quotes/quote-pricing.ts)).

| Field | Meaning |
|-------|---------|
| `list_price` | Vehicle price in QAR (or quote negotiated price) |
| `down_payment_pct` | Selected % (clamped to offer minimum) |
| `down_payment` | QAR amount |
| `tenor` | Months |
| `rate` | Annual rate from offer |
| `monthly` | Rounded installment used for schedules |

Consumed by: installment calculator UI, contract PDF, `buildScheduleDrafts()` on activate.

## contractData (Application.contractData)

Written on `approveWithContract`. Frozen copy of customer + pricing + vehicle + dealer metadata for PDF generation and audit.

## Status co-movement

| Event | Application | Product.listingStatus |
|-------|-------------|------------------------|
| Submit (from draft) | `under_review` | `reserved` |
| Reject / cancel (no other blocking app) | terminal | `published` |
| Activate | `active` | `sold` |

## Document categories

Required before submit: `qid`, `salary`, `bank`, `other` ([application-documents.ts](../packages/api/src/applications/application-documents.ts)).

Storage key pattern: `{applicationId}/{category}/{uuid}-filename` in `S3_BUCKET_KYC`.

## Payment schedules

Created on activate — one row per `pricingSnapshot.tenor` month. Finance marks paid via `POST /api/ops/payment-schedules/:id/pay` or customer sandbox SkipCash via `POST /api/applications/:id/schedules/:scheduleId/skipcash`.

## Portal visibility (summary)

| Data | Customer | Dealer | Credit | Finance | Admin |
|------|----------|--------|--------|---------|-------|
| KYC bytes | own | hidden | view | hidden | hidden |
| Contract PDF | download | hidden | hidden | hidden | hidden |
| Schedules | read when active | hidden | read | manage | read |
| VIN | hidden | own stock | ops | ops | ops |
