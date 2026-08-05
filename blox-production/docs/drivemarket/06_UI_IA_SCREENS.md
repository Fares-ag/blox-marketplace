# 06 — UI Information Architecture & Screens

**Product:** DriveMarket  
**Related:** [`11_DESIGN_GUIDELINES.md`](11_DESIGN_GUIDELINES.md) (**mandatory before any UI**), [`02_USER_JOURNEYS.md`](02_USER_JOURNEYS.md), [`03_DOMAIN_MODEL.md`](03_DOMAIN_MODEL.md)

This file is **information architecture only**: routes, purpose, data hooks, empty/error states, CTAs. Visual rules, tokens, motion, and composition live in `11_DESIGN_GUIDELINES.md`. Do not invent a second visual language here.

---

## Global UI rules (IA)

1. Marketplace shell: **top navigation**. Ops shells (dealer/credit/finance/admin/super-admin): **side navigation**.
2. Money, rates, QID: numeric/tabular treatment per `11`.
3. Status chips: use semantic status colors from `11` mapped to `application_status` / `listing_status`.
4. Empty and error states are first-class — never blank white pages.
5. Guest can browse; Apply always routes through auth + verified email.

---

## A. Marketplace app (`packages/marketplace`)

### A.0 Shell

| Element | Behaviour |
|---------|-----------|
| Top nav | Logo/wordmark, Vehicles, Help, Compare (Phase 5), Auth (Login / Account) |
| Footer | Light links: Help, contact, legal placeholders |
| Notifications | Bell when authenticated |

---

### `/` — Home (public)

| | |
|--|--|
| **Purpose** | Marketplace-first first viewport: brand + one headline + one supporting line + one CTA group + one dominant full-bleed vehicle image. Not a dashboard. |
| **Data** | Optional featured listings (Phase 5); otherwise CTA only + soft secondary browse strip **below** the fold |
| **Primary CTA** | Browse vehicles / Search |
| **Empty** | N/A for hero; if featured empty, omit featured section |
| **Error** | Soft fail featured fetch; hero still renders |
| **Mobile** | Full-bleed hero stacks; CTAs full width |
| **Design** | Must pass `11` hero budget + brand test |

---

### `/vehicles` — Faceted browse (public)

| | |
|--|--|
| **Purpose** | Dense, scannable results of `published` listings |
| **Data** | `list_published_products` + count; facets from query string |
| **Key components** | Facet panel (make, year, price, condition, dealer); result grid of **listing cards** (allowed as selection containers); sort; pagination |
| **Empty** | “No vehicles match these filters” + clear filters CTA |
| **Error** | Retry banner |
| **Mobile** | Facets in bottom sheet; 1-column cards |

---

### `/vehicles/:slug` — Listing detail (public with reservation rules)

| | |
|--|--|
| **Purpose** | Vehicle story, gallery, price, calculator, Apply |
| **Data** | `get_listing_detail`; offer tenure options |
| **Key components** | Image gallery; spec list; price (numeric); installment calculator block; Apply CTA; Add to compare (Phase 5) |
| **Empty/unavailable** | Sold-style / not available message (reserved for others, sold, archived) |
| **Error** | Retry; 404 page |
| **CTAs** | Apply (auth gate); secondary contact/help |
| **Mobile** | Sticky Apply bar |

---

### `/compare` — Compare (Phase 5, public)

| | |
|--|--|
| **Purpose** | Side-by-side 2–3 selected listing ids |
| **Empty** | Prompt to add from browse |
| **Error** | Missing id → remove chip + toast |

---

### `/auth/login` · `/auth/signup` · `/auth/forgot-password` · `/auth/reset-password`

| | |
|--|--|
| **Purpose** | Guest auth; preserve `returnUrl` |
| **Empty** | N/A |
| **Error** | Inline auth errors; `?reason=` banners (e.g. not_customer) |
| **Design** | Brand-forward auth panel per `11`; not a generic purple form |

---

### `/app/dashboard` — Customer overview (auth customer)

| | |
|--|--|
| **Purpose** | Snapshot: active/in-flight application, next payment, shortcuts |
| **Data** | Own applications list (limit), notifications |
| **Empty** | CTA to browse vehicles |
| **Error** | Retry |

---

### `/app/applications` — Application list

| | |
|--|--|
| **Purpose** | All customer applications with status chips |
| **Empty** | “No applications yet” → browse |
| **Error** | Retry |

---

### `/app/applications/new` — Apply wizard

| | |
|--|--|
| **Purpose** | Create financing application for `?product=` slug/id |
| **Data** | Listing detail, offers, `has_blocking_application` precheck |
| **Steps** | Confirm vehicle → personal/QID → employment → offer/tenure/down payment → docs → review submit |
| **Empty** | Missing product param → redirect browse |
| **Error** | Blocking app; listing unavailable; validation; RPC errors mapped from `05` |
| **CTAs** | Submit application |

---

### `/app/applications/:id` — Application detail

| | |
|--|--|
| **Purpose** | Status, docs, contract download/upload, schedule (when active), cancel when allowed |
| **Data** | Application, documents, schedules, activity (customer-safe subset) |
| **Empty** | N/A |
| **Error** | 404 if not owner; retry |
| **CTAs** | Upload docs; download contract; upload signed; pay (Phase 3); cancel |

---

### `/app/applications/:id/payment` · `/payment/callback` · `/payment/result` (Phase 3)

| | |
|--|--|
| **Purpose** | Initiate SkipCash; handle return; show receipt/failure |
| **Error** | `company_cannot_pay`; verify failure with support path |
| **Empty** | No payable schedule → explain |

---

### `/app/profile`

| | |
|--|--|
| **Purpose** | Name, phone, QID, email (read-only), password change link |
| **Error** | Validation on QID/phone |

---

### `/help`

| | |
|--|--|
| **Purpose** | FAQ, contact |
| **Empty** | Static content OK |

---

## B. Dealer app (`packages/dealer`)

### Shell

Side nav: Dashboard, Inventory, Applications, Company, Notifications.

### `/` or `/dashboard`

| | |
|--|--|
| **Purpose** | Counts: draft/published/reserved/sold; open applications on stock |
| **Empty** | Invite to create first listing |
| **Error** | Retry |

### `/inventory`

| | |
|--|--|
| **Purpose** | Table/grid of company products all listing statuses |
| **Empty** | Create listing CTA |
| **CTAs** | New listing |

### `/inventory/new` · `/inventory/:id`

| | |
|--|--|
| **Purpose** | CRUD specs, images, finance_eligible, offer; publish/unpublish |
| **Validation** | make, model, year, price, ≥1 image for publish |
| **Error** | `listing_has_active_financing` on unpublish |
| **Empty images** | Upload prompt |

### `/applications` · `/applications/:id`

| | |
|--|--|
| **Purpose** | Leads on own stock; **read-only** financing status; optional notes (Phase 4) |
| **Empty** | No applications yet |
| **Forbidden** | Status transition controls |

### `/company`

| | |
|--|--|
| **Purpose** | Profile, logo, branding primary color (Phase 5 soft white-label) |
| **Error** | Contrast warning if primary fails AA with text (per `11`) |

---

## C. Credit app (`packages/credit`)

### Shell

Side nav: Queue, Applications, (optional Vehicles read), Notifications.

### `/queue` or `/applications`

| | |
|--|--|
| **Purpose** | Filterable queue by status, company (scope), date |
| **Data** | Applications in credit scope |
| **Empty** | “Queue clear” |
| **CTAs** | Open detail |

### `/applications/:id`

| | |
|--|--|
| **Purpose** | Underwrite: docs viewer, snapshot, vehicle, pricing; actions per status matrix |
| **CTAs** | Request resubmission; Reject; Approve+contract; Move contract states; Activate; Direct activate if policy |
| **Error** | `invalid_status_transition`; `forbidden_role` |
| **Empty docs** | Warn before approve |

---

## D. Finance app (`packages/finance`) — Phase 3–4

### Shell

Side nav: Schedules / Applications, Settlements (optional), Notifications.

### `/applications` · `/applications/:id`

| | |
|--|--|
| **Purpose** | View active deals in finance scope; schedules; mark paid; bank transfer confirm |
| **Forbidden** | Activate button must not appear |
| **Empty** | No schedules due |
| **CTAs** | Mark paid; record reference |

---

## E. Admin app (`packages/admin`)

### Shell

Side nav: Companies, Users, Offers, Products (override), Applications, Settings.

### Key screens

| Route | Purpose | Empty | CTAs |
|-------|---------|-------|------|
| `/companies` | List/create companies; can_pay; allow_direct_activate | Create company | Invite dealer |
| `/companies/:id` | Edit company + branding fields | — | Save |
| `/users` | Invite/assign roles/company/scopes | Invite | |
| `/offers` | CRUD offers | Create offer | |
| `/products` | Cross-tenant inventory override | — | Publish/archive override |
| `/applications` · `/:id` | Full ops power (credit-like + admin) | — | Same transitions as credit |
| `/settings` | Platform flags | — | Save |

---

## F. Super-admin app (`packages/super-admin`)

| Route | Purpose |
|-------|---------|
| `/users` | Role assignment including super_admin |
| `/activity-logs` | Audit trail export |
| `/companies` | Cross-tenant oversight |
| `/system` | Feature flags, monitoring links |

Empty: “No log entries”. Error: export failure toast.

---

## Shared component inventory (logical)

| Component | Used in | Notes |
|-----------|---------|-------|
| `ListingCard` | marketplace browse | Image, title, price, year, CTA |
| `ListingGallery` | detail | Aspect ratios per `11` |
| `InstallmentCalculator` | detail, apply | Numeric font |
| `StatusChip` | all apps | Tokenized colors |
| `ApplicationTimeline` | application detail | |
| `DocumentUploader` | apply, resubmit, contract | |
| `ScheduleTable` | customer, finance, credit | |
| `FacetPanel` | browse | |
| `EmptyState` | all | Illustration optional; no emoji spam |
| `ErrorBanner` | all | Retry |
| `ConfirmDialog` | destructive actions | |
| `AppTopNav` / `AppSideNav` | shells | |
| `MoneyText` | all money | `.dm-money` |

---

## Auth & error query params

| Param | Meaning |
|-------|---------|
| `reason=not_customer` | Wrong role for marketplace app area |
| `reason=not_dealer` | Wrong role for dealer |
| `reason=unverified` | Email not verified |
| `returnUrl=` | Post-login redirect |

---

## Mobile notes (web responsive)

- Marketplace: priority — home, browse, detail sticky Apply, wizard step full screens.
- Ops: tables become card lists under 768px; actions in overflow menus.
- Never rely on hover-only affordances for primary actions.
