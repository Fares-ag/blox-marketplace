# 01 — Product Specification

**Product:** DriveMarket  
**Related:** [`00_README.md`](00_README.md) · [`02_USER_JOURNEYS.md`](02_USER_JOURNEYS.md) · [`03_DOMAIN_MODEL.md`](03_DOMAIN_MODEL.md) · [`11_DESIGN_GUIDELINES.md`](11_DESIGN_GUIDELINES.md)

---

## 1. Vision

DriveMarket is Qatar’s hybrid vehicle financing marketplace: shoppers discover dealer inventory in a public catalog, calculate installments in QAR, and apply for financing on a specific listing. Dealers manage and publish stock in their own portal. Platform credit, finance, and admin teams run one shared underwriting and servicing pipeline from application submit through activation and installment collection.

The product thesis is simple: **listing is discovery; application is financing; Postgres is truth.**

DriveMarket is not a peer-to-peer loan marketplace, not a crypto wallet product, and not a multi-country platform in v1. Financing is underwritten by the platform or its licensed partner; dealers fulfill vehicles; customers borrow against a concrete car.

---

## 2. Problem and opportunity

| Stakeholder | Problem today | DriveMarket answer |
|-------------|---------------|--------------------|
| Shopper | Fragmented dealer sites; opaque installment math; paper-heavy finance | One marketplace, calculator on every listing, guided apply + contract upload |
| Dealer | Inventory not finance-ready; leads leak across tools | Portal inventory CRUD → published listings that feed a shared credit queue |
| Credit / finance | Spreadsheet or siloed dealer pipelines | One application status machine, schedules, payments, activity log |
| Platform | Hard to scale dealers without white-label chaos | Shared pipeline + light dealer branding on portal only |

---

## 3. Product principles

1. **Listing is the unit of discovery; application is the unit of financing.** Apply always starts from a `published` + `finance_eligible` listing.
2. **Postgres is system of record.** UI never invents authoritative state; RPCs and triggers own transitions.
3. **Company tenancy everywhere.** Inventory and applications are scoped to `company_id`; ops roles use `all` or `assigned` scopes.
4. **Secrets stay server-side.** SkipCash (and future QPay) keys live only in Edge Functions / Vault.
5. **Status transitions are server-enforced.** No “hope the admin UI is correct.”
6. **PII stays private.** QID, KYC docs, employment data use Storage + RLS; never appear in public listing payloads.
7. **Marketplace honesty.** Reserved and sold vehicles must not look freely available to other shoppers (server-side `listing_status`).
8. **Marketplace-first IA.** Home and search beat “ops dashboard” for customers. Visual rules: [`11_DESIGN_GUIDELINES.md`](11_DESIGN_GUIDELINES.md).

---

## 4. Personas and apps

| Persona | App package | Auth role | Primary goals |
|---------|-------------|-----------|---------------|
| Shopper / borrower | `marketplace` | `customer` | Browse, compare, calculate, apply, sign, pay |
| Dealer staff | `dealer` | `dealer_agent` | Publish inventory, manage media, see apps on stock |
| Dealer principal | `dealer` | `dealer_agent` (+ flags later) | Company profile, users invite (Phase 4+) |
| Credit officer | `credit` | `credit_officer` | Underwrite, request docs, approve contract path, activate |
| Finance officer | `finance` | `finance_officer` | Schedules, mark paid, settlements; **cannot activate** |
| Platform ops admin | `admin` | `admin` | Companies, offers, all inventory override, users, settings |
| Platform operator | `super-admin` | `super_admin` | Roles, audit logs, cross-tenant oversight |

**Guest (unauthenticated):** home, search, listing detail, calculator preview, help.  
**Apply gate:** login + verified email required.

Capability matrix (authoritative): [`03_DOMAIN_MODEL.md`](03_DOMAIN_MODEL.md) §RBAC.

---

## 5. Design deltas vs typical financing-ops platforms

| Area | Typical ops-first platform | DriveMarket |
|------|----------------------------|-------------|
| Lead UX | Financing ops + catalog | Marketplace discovery first |
| Inventory visibility | `active` / `inactive` product flag | Separate `listing_status`: `draft` / `published` / `reserved` / `sold` / `archived` |
| Reservation | Client hide rules | Server: blocking application → listing `reserved` |
| Dealers | Company-scoped portal | Same + onboarding + branding fields |
| Credits / membership | Often first-class | Deferred post-MVP |
| Docs on apply | Often weak | Durable Supabase Storage from Phase 1 |
| Status enforcement | UI + later triggers | RPC + trigger from Phase 1 |
| Apps | Customer + ops suite | Same six apps (`customer` renamed → `marketplace`) |
| Blockchain | Sometimes scoped in | Explicitly out of scope |

---

## 6. Feature matrix

### 6.1 MVP (Phases 0–2) — must ship

| Feature | Notes |
|---------|-------|
| Dealer invite / onboarding | Admin creates company + dealer user |
| Inventory CRUD + image upload | Publish / unpublish |
| Public home, faceted search, listing detail | Marketplace-first composition per `11` |
| Installment calculator | Preview as guest; apply gated |
| Customer signup / login | Email verification; profile (name, phone, QID field) |
| Apply wizard → `under_review` | KYC docs in Storage |
| Blocking second application | Server RPC |
| Listing auto-reserved | When application enters blocking / in-flight status |
| Admin + Credit queues | Detail, reject, resubmit, approve → contract path |
| Contract PDF generate | Customer uploads signed PDF |
| Activate → `active` | Generate `payment_schedules`; listing → `sold` |
| In-app notifications | Basic email or outbox stub |
| Activity log | Key transitions |
| RLS | All user-facing tables |

### 6.2 Phase 3 — payments

| Feature | Notes |
|---------|-------|
| SkipCash create / verify / webhook | Card redirect |
| Pay installment + receipt | Idempotent completion |
| `companies.can_pay` gate | Enforced server-side |
| Payment reminders cron | Edge Function |
| Bank transfer reference | Ops confirm path |

### 6.3 Phase 4 — ops scale

| Feature | Notes |
|---------|-------|
| Dedicated finance portal parity | Mark paid, settlements |
| Credit / finance company scope M2M | `*_officer_companies` |
| Dealer application notes / limited messaging | Not full chat |
| Email outbox reliability | Indexes, monitoring |
| Settlement discount settings | Optional |

### 6.4 Phase 5 — marketplace polish + mobile

| Feature | Notes |
|---------|-------|
| Compare 2–3 vehicles | |
| Saved searches / favorites | |
| Featured / boosted listings | `featured_until` |
| SEO slugs, sitemap, Open Graph | |
| Soft white-label | Logo + primary color on dealer portal |
| Flutter customer parity | Spec + app mirroring Flutter customer spec structure |

---

## 7. Explicit non-goals (v1 / Phases 0–5)

- Blockchain, smart contracts, wallets, on-chain escrow
- Credits / membership / deferral product
- Multi-country / multi-currency
- Full autonomous Islamic finance engine (offers may carry rate/profit fields only)
- Consumer-to-consumer private sellers (dealers/companies only unless later expanded)
- In-app chat with AI underwriting as sole decision maker
- QPay as a Phase 0–3 requirement (optional later)
- Full dealer user-management RBAC beyond principal flags until Phase 4+

---

## 8. Success metrics

Define instrumentation early (event names suggested). Targets are directional until business sets SLAs.

| Metric | Definition | Suggested target (MVP) | Phase available |
|--------|------------|------------------------|-----------------|
| Time-to-first-published-listing | From dealer invite accepted → first `listing_status = published` | < 1 business day | 1 |
| Search → detail → apply start | Sessions with `/vehicles` → detail → `/app/applications/new` | Track baseline; improve +20% QoQ | 1 |
| Apply submit → under_review | Wizard complete rate among started applies | ≥ 70% | 1 |
| Activation cycle time | `under_review` created_at → `active` | Median < 5 business days | 2 |
| On-time installment rate | Schedules paid by due_date / due schedules | ≥ 90% | 3+ |
| Dealer NPS / ticket rate | Survey + support tickets on inventory tools | NPS > 30; tickets ↓ | 1+ |

Analytics events (minimum): `listing_view`, `calc_run`, `apply_start`, `apply_submit`, `contract_upload`, `activation`, `payment_initiated`, `payment_completed`.

---

## 9. Market and localization

| Concern | v1 rule |
|---------|---------|
| Country | Qatar only |
| Currency | QAR only; `Intl` formatting |
| UI language | English first |
| RTL / Arabic | Hooks in design tokens and logical CSS properties from day one; Arabic copy deferred |
| Phone | Qatar formats; store E.164 where possible |
| ID | QID field on profile / application snapshot |

---

## 10. Compliance posture (product-level)

Assumptions are listed in [`10_RISKS_AND_OPEN_QUESTIONS.md`](10_RISKS_AND_OPEN_QUESTIONS.md). Product requirements that follow regardless:

- KYC documents stored privately; access audited via activity logs where possible.
- Contract PDFs retained with application.
- Customer can see only their own PII and applications.
- Ops access is role- and scope-gated.
- Payment gateway secrets never in browsers.
- Marketplace must not advertise a reserved/sold car as freely available.

---

## 11. Release philosophy

Ship vertical slices by phase (`07_BUILD_PHASES.md`). Do not open Phase 3 payments until Phase 2 happy path (submit → contract → activate → schedules) is green on acceptance tests (`09_ACCEPTANCE_TEST_MATRIX.md`). Design tokens and marketplace home composition are Phase 0/1 acceptance items, not polish-later.
