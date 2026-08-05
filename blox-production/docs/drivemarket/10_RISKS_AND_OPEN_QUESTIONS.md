# 10 — Risks, Assumptions, Open Questions

**Product:** DriveMarket  
**Related:** [`00_README.md`](00_README.md) · [`03_DOMAIN_MODEL.md`](03_DOMAIN_MODEL.md) · [`05_API_RPC_CONTRACT.md`](05_API_RPC_CONTRACT.md)

---

## 1. Risks

| ID | Risk | Impact | Likelihood | Mitigation |
|----|------|--------|------------|------------|
| R1 | Dual-write drift between `listing_status` and application state | Shoppers see wrong availability; trust loss | M | Single trigger `sync_listing_reservation`; no client listing status writes on apply path; acceptance tests P1-10, P2-04 |
| R2 | SkipCash webhook races / retries | Double pay or stuck pending | M | `complete_skipcash_payment_atomic` + idempotency key; payment-monitor |
| R3 | Dealer deletes/unpublishes car under offer | Broken customer journey | M | Forbid unpublish when blocking apps; soft-archive only via admin with audit |
| R4 | PII leakage via loose RLS or public views | Regulatory / trust | M | Views without VIN; Storage policies; automated P1-16 |
| R5 | Status matrix bugs in UI or RPC | Illegal states, stuck apps | H early | DB trigger enforces matrix; unit test all edges; UI only exposes allowed actions |
| R6 | SEO duplicate / colliding slugs | Wrong listing, SEO damage | L | Unique slug constraint; regenerate on conflict |
| R7 | UI drift / generic AI aesthetics | Brand inconsistency | H if agents skip docs | Phase 0/1 acceptance includes `11`; PR checklist cites design QA |
| R8 | One-loan rule races (double submit) | Two under_review apps | M | RPC re-check + optional unique partial index / advisory lock |
| R9 | Email deliverability | Missed contract/pay notices | M | Outbox + retries Phase 4; in-app notifications as primary MVP |
| R10 | Scope misconfiguration for officers | Data bleed across dealers | M | Default `assigned` with empty M2M = see nothing; admin must assign |
| R11 | PDF contract quality | Legal ambiguity | M | Store contract_data snapshot; version templates; human credit review before activate |
| R12 | `can_pay` left false in prod | Customers cannot pay | L | Admin checklist; payment-monitor alerts |

---

## 2. Assumptions (confirm with business — not engineering blockers)

Documented as assumptions so build can proceed; change control via product owner.

| ID | Assumption |
|----|------------|
| A1 | Financing license is held by the platform **or** a named licensed partner who appears on the customer contract. |
| A2 | Contract party names and logos will be supplied before production contracts (template placeholders OK in Phase 2). |
| A3 | VIN is **not** shown on public marketplace pages; visible to dealer/ops/credit only. |
| A4 | Down-payment policy is optional in MVP path; statuses exist for later enablement. Exact % rules come from offers.`min_down_payment_pct`. |
| A5 | Final legal brand name and palette sign-off may rename DriveMarket; tokens in `11` update without schema rename. |
| A6 | English UI ships first; Arabic copy and full RTL QA follow without blocking Phases 0–3. |
| A7 | Bank transfer remains an ops-confirmed path alongside SkipCash; not a full open-banking integration. |
| A8 | Dealers are companies only — no C2C private sellers in Phases 0–5. |
| A9 | Finance officers never activate financing — credit/admin only. |
| A10 | At most one in-flight or active loan per customer is acceptable product policy for v1. |

---

## 3. Open questions

| ID | Question | Default until decided |
|----|----------|-------------------------|
| Q1 | Who is the legal lender of record on the PDF? | Platform placeholder + partner field in `contract_data` |
| Q2 | Is insurance mandatory in calculator? | Optional line item; `insurance_rate_id` nullable |
| Q3 | Should `completed` applications free the vehicle listing for resale? | No — listing stays `sold`; new inventory row if needed |
| Q4 | Exact SkipCash field names / webhook signature scheme for Qatar account | Adapter in `_shared/skipcash.ts` |
| Q5 | Retention period for KYC docs | Follow compliance policy TBD; do not auto-delete in MVP |
| Q6 | Dealer visibility of full customer QID | MVP: yes for lead fulfillment; tighten if compliance requires masking |
| Q7 | Auto-move `contracts_submitted` → `contract_under_review` | Default: credit manual move |
| Q8 | Featured listing commercial rules (paid boost?) | Phase 5: time-boxed `featured_until` only |
| Q9 | QPay priority vs SkipCash-only | SkipCash first; QPay optional later |
| Q10 | Multi-offer per listing beyond default_offer_id | MVP: one selected offer at apply; expand later |

---

## 4. Deferred backlog (explicitly not Phases 0–5 core)

- Blox-style credits / membership / deferrals  
- Full Islamic finance engine / Sharia workflow automation  
- In-app AI underwriting as decision maker  
- Multi-country / multi-currency  
- C2C private sellers  
- Rich dealer↔customer chat  
- Advanced collections / delinquency workflows beyond overdue flag  
- Native dealer mobile apps  

---

## 5. Blockchain — future note only

Blockchain integrity anchoring, on-chain escrow, wallets, and smart-contract settlement are **out of scope** for this product version. Any future exploration belongs in a separate regulated-settlement design epic **after** off-chain underwriting, payments, and compliance operations are stable in production. Do not add chain dependencies, wallet SDKs, or token models to the DriveMarket monorepo during Phases 0–5.

---

## 6. Doc maintenance

When open questions resolve, update:

1. This file (move Q → A or locked decision)  
2. `00_README.md` locked decisions table if behaviour changes  
3. `03` / `05` if schema or RPC contracts change  
4. `11` if brand name/palette is signed off under a new name  
