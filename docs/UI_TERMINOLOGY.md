# UI Terminology Glossary

DriveMarket uses **different vocabulary** on customer-facing surfaces versus internal ops portals. Same domain concepts — different words. When building UI, copy, or API labels, pick the column that matches the audience.

## Core mapping

| Customer-facing (marketplace) | Ops-facing (credit / finance / admin) | Meaning |
|------------------------------|---------------------------------------|---------|
| **Ownership plan** | **Financing application** | A customer's request to co-own a vehicle on agreed terms. Stored as `Application` in the API. |
| **Start your ownership plan** / **Apply** | **Submit application** | Customer begins or ops receives the financing request. |
| **My ownership plans** | **Application queue** | List of in-progress or completed customer requests. |
| **Stake** | **Equity / financed share** (informal) | The customer's growing share in the vehicle as they pay. |
| **Initial contribution** | **Down payment** | Up-front amount due before or at activation (`pricingSnapshot.down_payment`). |
| **Contribution** (noun) | **Installment payment** | A scheduled payment toward the plan (`PaymentSchedule`, `PaymentEvent` type `installment`). |
| **Est. contribution** / **Est. monthly contribution** | **Monthly installment** | Calculator estimate for recurring payment amount. |
| **Contribution due** | **Installment due** | A schedule line awaiting payment. |
| **Building your stake** | **Active financing** / **Active application** | Post-activation state (`ApplicationStatus.active`). |
| **Withdraw this plan** | **Cancel / reject application** | Customer cancellation or ops rejection. |
| **Plan length** / **Tenure** (customer copy) | **Tenor** / **Term (months)** | Number of months in the payment schedule. |

## Status labels (examples)

| API status | Customer label (approx.) | Ops label |
|------------|--------------------------|-----------|
| `draft` | Draft plan | Draft application |
| `under_review` | Under review | Under credit review |
| `contract_signing_required` | Contract ready to sign | Awaiting signed contract |
| `down_payment_required` | Initial contribution due | Down payment required |
| `active` | Building your stake | Active / financed |
| `rejected` | Plan not approved | Rejected |

Customer strings live primarily in `packages/shared/src/i18n/locales.ts`. Ops portals often use plain English field labels (e.g. "Monthly installment", "Require down payment") in `packages/credit`, `packages/finance`, etc.

## Rules for contributors

1. **Never expose ops jargon on the marketplace** — say "ownership plan" and "contribution", not "financing application" and "installment".
2. **Never expose customer marketing terms in ops workflows** — credit officers need precise labels: application, down payment, installment, waive, activate.
3. **API and database names stay neutral** — `Application`, `PaymentSchedule`, `down_payment` events; UI layers translate.
4. **Calculator output** — customer UI shows "Est. contribution"; ops tools may show "Monthly installment" for the same computed value.
5. **Arabic copy** — follow the same split in `locales.ts` (`ar` block mirrors customer vocabulary).

## Related docs

- [`DATA_FLOW_SNAPSHOTS.md`](DATA_FLOW_SNAPSHOTS.md) — `pricingSnapshot` fields (`monthly`, `down_payment`, etc.)
- [`blox-production/docs/drivemarket/03_DOMAIN_MODEL.md`](blox-production/docs/drivemarket/03_DOMAIN_MODEL.md) — canonical domain entities
