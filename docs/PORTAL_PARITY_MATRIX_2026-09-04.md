# Staff Portal Parity Audit — blox-marketplace vs blox-vercel (Phase A)

**Date:** 2026-09-04
**Reference (source of truth):** `C:\Users\TS\Downloads\blox-vercel\blox-production\` — `packages/shared/src/utils/application-status-transitions.ts`, `docs/FINANCE_PORTAL.md`, `docs/QA_PORTAL_SCALE_ALIGNMENT_2026-07-24.md`, `supabase/migrations/20260803180000_credit_activates_finance_views.sql` (DB trigger — identical to the TS matrix)
**Target:** `C:\Users\TS\Downloads\blox-marketplace\` @ `6f603a4`
**Scope:** admin, super-admin, dealer, credit, finance + `packages/shared/src/ops-applications`, `packages/api` guards. Customer portal untouched.

Abbreviations: UR `under_review` · RS `resubmission_required` · CSR `contract_signing_required` · CS `contracts_submitted` · CUR `contract_under_review` · DPR `down_payment_required` · DPS `down_payment_submitted` · PFA `pending_finance_activation` · ACT `active` · REJ `rejected` · CXL `submission_cancelled`.

---

## 0. Headline

The two codebases agree on the **pipeline shape**, on **who activates** (credit/admin — finance is refused at the API: `activate()` throws `forbidden_role` for `finance_officer`, verified live on prod), on **company/officer scoping**, on **role resolution from the server**, and on **reserved-vehicle statuses**. Dealer, super-admin and admin **navigation** are already at or above vercel parity.

Parity breaks in three places:

1. **Finance is a read-mostly role in marketplace.** In vercel, finance = "credit decision parity without activation" (`FINANCE_OFFICER_ALLOWED` mirrors `CREDIT_OFFICER_ALLOWED` minus every `active`). In marketplace, finance holds **three** transition edges (all down-payment related), cannot approve/reject/resubmit/reopen, and cannot generate contracts. The UI hides every decision button from finance (`canCreditDecide` excludes it).
2. **Finance portal has 3 of vercel's 6 surfaces.** No Queue (Activation/Review), Book, Settlements, Credits, Exports. The settlements domain does not exist at all (no Prisma model). Credits adjustment is admin-only in the API.
3. **The status matrix diverges on the spine.** Marketplace has **no `under_review → pending_finance_activation` edge** ("Approve for Finance"), no reject/reopen from `pending_finance_activation`, no ops-side cancel, and a narrower admin override. One credit button ("Request resubmission" at CSR) is rendered for an edge that does not exist in the API.

---

## 1. Portal Parity Matrix

Severity: **P0** wrong-role transition possible/forbidden transition missing on the spine, or a required surface absent · **P1** flow works but a documented capability is missing or UI≠API · **P2** IA/UX/labels.

### 1.1 Cross-cutting — Auth, RBAC, scoping

| Area | blox-vercel behaviour | blox-marketplace today | Gap | Files to change |
|---|---|---|---|---|
| Roles | `admin, super_admin, dealer_agent, credit_officer, finance_officer` (+`customer`, `viewer`) | Same five + `customer`, **`group_admin`** (holding-level admin, not in vercel) | none (superset) | — |
| Role resolution | Client reads `users.role` from DB after Supabase login; guards redirect; RLS is real enforcement | `auth-store.init()` → `GET /api/me` (DB); `SessionAuthGuard` loads the Prisma user per request; `@Roles()` per endpoint | none — fail-closed on server | — |
| Portal guards | `AuthGuard` per portal → `/…/auth/login?reason=not_<portal>` | `AuthGuard allowedRole reasonParam` → `/auth/login?reason=not_<portal>`; **also signs out server-side** on mismatch | none (marketplace stricter) | — |
| MFA/TOTP | **None** in vercel (0 references) | `/auth/mfa-setup`, `/auth/two-factor` on all 5 portals; `MFA_REQUIRED_ROLES` = admin, super_admin, credit, finance; `MFA_ENFORCE` flag | none (marketplace exceeds; keep) | — |
| Dealer company scope | RLS + client `eq('company_id')` | `companyId` from user row on every `/dealer/*` endpoint; dealer without company → 403 (verified) | none | — |
| Credit/finance scope | `credit_scope`/`finance_scope` = `all` \| `assigned` + `credit_officer_companies` / `finance_officer_companies`; assigned on **Partner Hub detail** | Same columns + M2M tables; `opsCompanyFilter`/`assertCompanyScope` (`packages/api/src/applications/company-scope.ts`) incl. holding→children expansion; assigned via **Users detail** (`creditCompanyIds`/`financeCompanyIds`) | **P1** — no Partner Hub detail page with officer assignment (`/main/companies/:id` absent) | `packages/admin/src/main.tsx`, new `CompanyDetailPage`; API already has `PATCH /users/:id` |
| Portal-aware links | `PortalBasePathProvider` + `withPortalBase(base, path)` used by every list/detail (`/applications/view/:id`) | `ops-ui-v2/PortalBasePath.tsx` exists and is exported but **used nowhere**; links built from per-component props (`basePath`, `detailBase`, `backTo`); detail route is `/applications/:id` (credit/dealer/finance) and `/main/applications/:id` (admin) | **P0 (per brief) / P1 functionally** — no shared helper → cross-portal deep links (notifications, settlements→app) cannot be generated centrally | `packages/shared/src/ops-ui-v2/PortalBasePath.tsx`, `ops-applications/{ApplicationsList,CreditQueue,ApplicationWorkspace,PendingBankTransfers}.tsx`, all 5 `main.tsx` |
| Enforcement layer | DB trigger `enforce_application_status_transition()` + client matrix | `application-transitions.ts` RULES + dedicated endpoints + `transitionApplication()` guarded `updateMany` (stale-transition safe) | none structurally — **content** differs (§1.2) | — |
| Reserved vehicle | `getReservedVehicleIds`: ACT, UR, CSR, CS, CUR, DPR, DPS, PFA | Listing → `reserved` on submit, `sold` on activate, `published` on reject/cancel; `BLOCKING_APPLICATION_STATUSES` includes PFA, DPS, `partner_processing` | none | — |
| Queue paging | Load-more, page 100 | Server `limit/offset` + `Table page=` (`DEFAULT_PAGE_SIZE`) | none | — |
| Separation of duties | Not modelled (same credit officer approves and activates in the smoke recipe) | `assertSeparationOfDutiesForApplication` on **mark-paid / confirm-bank** in `payments.service.ts:321,529,586` (credit approver may not record money); `SEPARATION_OF_DUTIES` env + company flag | **P1 design decision** — will block "credit marks paid" (§1.2 #7) for the approving officer unless disabled per company | `packages/api/src/payments/payments.service.ts`, `separation-of-duties.ts` |

### 1.2 Application status machine — role × edge

Vercel matrix = `application-status-transitions.ts` (client) ≡ DB trigger. Marketplace = `packages/api/src/applications/application-transitions.ts` RULES + endpoints in `applications-lifecycle.service.ts`. "A" = admin/super_admin.

| Edge | vercel actors | marketplace actors | Gap | Notes |
|---|---|---|---|---|
| draft → UR | dealer, A, customer | dealer, A, customer | ✓ | |
| draft → ACT | A ("Activate draft") | — | **P1** | admin override missing |
| draft → PFA | A | — | P2 | |
| draft → REJ / CXL | A; dealer CXL; customer CXL | A REJ; A+dealer CXL; customer? (cancel endpoint requires UR) | P2 | customer draft cancel: verify |
| **UR → PFA (Approve for Finance)** | **credit, finance, A** | **—** | **P0** | spine step 2 in FINANCE_PORTAL; marketplace forces contract path |
| UR → CSR (Generate Contract) | credit, **finance**, A | credit, A (`approveWithContract`, `OPS_ROLES`) | **P0** | finance excluded |
| UR → RS | credit, finance, A | credit, A | **P0** | finance excluded |
| UR → REJ | credit, finance, A | credit, A | **P0** | finance excluded |
| UR → ACT | A ("Activate (Admin)"); credit only via **direct** | credit/A via `activate(direct)` **iff** `company.allowDirectActivate` | **P1** | no unconditional admin activate |
| UR → CXL | credit, finance, A, customer | customer only | **P1** | no ops cancel |
| RS → UR (resubmit) | dealer, credit, finance, A, customer | dealer, credit, A, customer | **P0** | finance excluded |
| RS → REJ | credit, finance, A | credit, A | **P0** | |
| RS → CXL | credit, finance, A | — | P1 | |
| CSR → CS | customer; credit/finance/A (ops upload signed) | customer; credit/A (`POST ops/…/contract/signed`) | **P0** | finance excluded |
| CSR → RS | credit, finance, A | **—** | **P1 bug** | marketplace UI **renders** "Request resubmission" at CSR (`requestResubmission` includes CSR) but no RULE → `400 invalid_status_transition` |
| CSR → REJ | credit, finance, A | credit, A | P0 (finance) | |
| CSR → UR | credit, finance, A | — | P2 | |
| CS → CUR (Review Contract) | credit, finance, A | credit, A | **P0** | finance excluded |
| CS → PFA | credit, finance, A | — | P1 | vercel review "approve" skips CUR |
| CS → ACT | credit, A | — | P1 | activate shortcut (vercel QA: tolerated, prefer queue path) |
| CS → CSR / REJ / RS | credit, finance, A | credit, A (CSR, REJ); RS — | P0 (finance) / P2 | |
| CUR → PFA (contract approve) | credit, finance, A | credit, A | **P0** | finance excluded |
| CUR → ACT | credit, A | — | P1 | shortcut |
| CUR → CSR / REJ / DPR | credit, finance, A | credit, A | P0 (finance) | |
| DPR → DPS | credit, finance, A | credit, **finance**, A via `POST …/down-payment` | ✓ API / **P1 UI** | UI `recordDownPayment` gated `canFinanceAct` → **credit cannot see it** although API + RULES allow |
| DPR → PFA / REJ | credit, finance, A | REJ credit, A; PFA — | P1 | |
| DPS → PFA | credit, finance, A | credit, finance, A | ✓ | |
| DPS → ACT | credit, A | — | P1 | shortcut |
| DPS → REJ / DPR | credit, finance, A | DPR ✓; REJ — | P1 | |
| **PFA → ACT (Activate Financing)** | **credit, A** (finance refused) | **credit, A** (`activate()`: finance → 403) | ✓ | verified on prod |
| **PFA → REJ** | credit, finance, A | **—** | **P0** | vercel detail shows Reject at PFA |
| **PFA → UR (reopen)** | credit, finance, A | — | **P0** | |
| PFA → CXL | A, customer | — | P1 | |
| PFA → DPR | — | credit, finance, A (67fa0f1 recovery) | marketplace extra — keep | |
| ACT → completed | A | A | ✓ | |
| ACT → CXL | A | — | P1 | |
| REJ → UR (reopen) | credit, finance, A | credit, A | **P0** | finance excluded |
| CXL → UR (reopen) | A (UI: canCreditDecide) | — | P1 | |
| `partner_processing` | n/a | dealer/A submit → read-only (`partner_application_readonly`) | marketplace-specific — keep, document | Zoho path |

**UI-vs-API drift inside marketplace (independent of vercel):**
- `reject` UI: UR/RS/CSR only — API also allows CS, CUR, DPR → hidden valid actions (P2).
- `requestResubmission` UI includes CSR — API has no edge → **broken button** (P1).
- `recordDownPayment` UI finance/admin — API credit/finance/admin (P1).
- `markInstallmentPaid` UI finance/admin — API finance/admin — **vercel: credit too** (§1.5).

### 1.3 Admin (`packages/admin`) vs vercel `/admin/*`

| Route / screen | vercel | marketplace | Gap | Files |
|---|---|---|---|---|
| Dashboard | `/admin/dashboard` | `/main/dashboard` ✓ | — | |
| Applications list | `/admin/applications` (tabs; `contracts` tab includes PFA) | `/main/applications` (tabs All/In progress/Contracts/Active/Rejected/Completed/Cancelled/Partner) | P2 verify `Contracts` tab `statusIn` includes PFA | `shared/src/ops-applications/ApplicationsList.tsx` |
| Add application | `/admin/applications/add` | `/main/applications/new` (6-step wizard) ✓ | — | |
| Application detail | `/admin/applications/view/:id` — tabs Overview/Transactions/Installment Schedule/Logs/Comments/Docs | `/main/applications/:id` — tabs overview/transactions/schedule/logs/comments/docs ✓ | P2 route shape | |
| Admin actions on detail | Activate draft; Activate (Admin) from UR; all credit actions; Reopen from REJ/CXL; Delete; Download contract; mark-paid; edit | Delete; convert daily; edit installments; all credit actions; reopen REJ; direct activate iff company flag; waive (dual control); compliance check | **P1** admin override narrower (§1.2) | `useApplicationActions.ts`, `application-transitions.ts`, `applications-lifecycle.service.ts` |
| Bank transfers | `/admin/payments/pending-bank` | `/main/bank-transfers` ✓ | — | |
| Users | `/admin/users`, `/users/:email` | `/main/users`, `/main/users/:id` ✓ (create user with role, scopes, company ids) | — | |
| Companies / Partner Hub | `/admin/companies`, **`/companies/:id`** (flags `can_pay`, `allow_direct_activate`; assigned credit & finance officers) | `/main/companies` list only (flags in list); officer assignment on Users detail | **P1** | `packages/admin/src/main.tsx`, `pages/CompaniesPage.tsx` |
| Vehicles | `/admin/vehicles` (+add/:id/edit) | `/main/vehicles` (+add/:id) ✓ | — | |
| Offers / Promotions / Insurance & Rates / Packages | CRUD | CRUD ✓ (API 500 on prod — missing migrations, see QA_PRODUCTION) | ops issue, not parity | |
| Ledgers | `/admin/ledgers` (`ledgers` table) | `/main/ledgers` = installment ledger (payment_schedules) | P2 semantics | |
| Settings | `/admin/settings/settlement-discounts` | `/main/settings/settlement-discounts` ✓ | — | |
| Guard | `?reason=not_admin` | `?reason=not_admin`; allows `group_admin` | — | |

### 1.4 Super-admin (`packages/super-admin`)

| vercel | marketplace | Gap |
|---|---|---|
| Dashboard · Users (`/users/:email`) · Activity Logs (export) | Dashboard · Users (`/users/:id`) · Companies · Activity logs (ExportButton) · System | none — superset; keep |
| `?reason=not_super_admin` | same | — |

### 1.5 Dealer (`packages/dealer`)

| vercel | marketplace | Gap |
|---|---|---|
| My Applications · New Application · Vehicles (+add/:id/edit) | Dashboard · Applications · New application · Inventory (+new/:id) · Quotes · Company | none — superset (quotes/company marketplace-specific) |
| Detail: Submit to Credit / Resubmit to Credit only; read-only status | `submitToCredit` (draft, RS); `uploadDocs`; `comment`; no transition controls ✓ | — |
| Company scope via RLS | `companyId` server-side on `/dealer/*` ✓ | — |
| draft→UR may route to `partner_processing` | Zoho partner path | marketplace-specific; document |
| `/company` page | n/a | raw i18n key `ops.common.back` (QA_PRODUCTION PROD-11) | P2 |

### 1.6 Credit (`packages/credit`)

| Route / capability | vercel | marketplace | Gap | Files |
|---|---|---|---|---|
| Nav | Credit Queue | Dashboard · Queue · Zoho failures | none (Zoho extra, keep) | |
| Queue | `/credit/queue` tabs Pipeline / Rejected; statuses `CREDIT_QUEUE_STATUSES` (pipeline + PFA + rejected); load-more | `/queue` tabs pipeline/rejected; `CREDIT_PIPELINE_STATUSES` incl. PFA + rejected; server paging ✓ | — | |
| Detail route | `/credit/applications/view/:id` | `/applications/:id` | P2 | |
| Approve for Finance | ✓ UR→PFA | **✗** | **P0** | `useApplicationActions.ts`, RULES |
| Generate Contract | ✓ | ✓ (`approveContract`, gated by compliance check) | — | |
| Activate Financing | PFA, CS, CUR, DPS → ACT | PFA → ACT only | P1 | |
| Direct activate | Admin only ("Activate (Admin)") | credit/A iff `allowDirectActivate` | — (marketplace policy) | |
| Reject | UR, RS, CSR, CS, CUR, DPR, DPS, **PFA** | UI: UR, RS, CSR; API: + CS, CUR, DPR; **not PFA** | **P0** (PFA) / P2 (UI hides CS/CUR/DPR) | |
| Request resubmission | UR, RS, CSR, CS | UI: UR, RS, CSR; API: UR only (RS→RS n/a) | **P1 bug** at CSR | |
| Contract review | CS/CUR → PFA / REJ / CSR | CS→CUR, CUR→PFA/CSR/REJ/DPR ✓ | — | |
| Reopen | REJ, CXL → UR | REJ → UR | P1 (CXL) | |
| Cancel | UR, RS → CXL | ✗ | P1 | |
| Mark paid | ✓ (`canMarkPaid` incl. credit) | ✗ UI + API (`/pay` finance/admin) | **P0** | `payments.controller.ts:@Roles`, `useApplicationActions.ts` |
| Record down payment | ✓ | API ✓, UI ✗ (finance-gated) | P1 | `useApplicationActions.ts` |
| Compliance check | n/a | ✓ (gates approval) | marketplace extra | |
| Cannot settle / adjust credits | ✓ | ✓ (no such surfaces) | — | |

### 1.7 Finance (`packages/finance`)

| Route / capability | vercel | marketplace | Gap | Files |
|---|---|---|---|---|
| Nav | Queue · Active Book · Payments · Settlements · Credits · Exports | Dashboard · Schedules · Applications · Bank Transfers | **P0** — 5 surfaces missing | `packages/finance/src/main.tsx` |
| `/queue` Activation tab (default, **view-only**) | `FINANCE_ACTIVATION_QUEUE_STATUSES` = PFA, CS, CUR, DPS; empty copy "Activate is on the credit portal" | ✗ (Applications list has "In progress"/"Contracts" tabs across all statuses) | **P0** | new `FinanceQueue.tsx` in `shared/src/ops-applications` |
| `/queue` Review tab (Pipeline / Rejected) with decisions | `FINANCE_REVIEW_QUEUE_STATUSES` = pipeline + rejected; actions per §1.2 | ✗ | **P0** | same + RULES |
| `/book` Active book | `payment_schedules` for `active`: remaining principal, next installment | ✗ (`/schedules` is a flat ledger) | **P0** (brief) / P1 | new page; API `GET /ops/applications?statusIn=active` + schedules |
| `/payments` | Schedules + Transactions tabs | `/schedules` (schedules only) + `/bank-transfers` | P1 | add transactions tab (`payment_transactions`) |
| `/settlements` | `application_settlements` pending → Approve / Reject | **✗ — no model, no API, no UI** | **P0** | `schema.prisma`, new module `api/src/settlements`, page |
| `/credits` | `user_credits` list; add / subtract / set via `admin_*_user_credits` RPC | ✗ UI; API `GET/POST /ops/users/:id/credits` **admin/super only** (`credits.controller.ts`) | **P0** | `credits.controller.ts` @Roles, new page |
| `/exports` | CSV: schedules, ledgers (client-side from Supabase) | ✗ (only `ExportButton` in admin catalog/super logs) | **P0** (brief) / P1 | reuse `ops-ui-v2/export.ts`; API list endpoints already exist |
| Detail `/applications/view/:id` | Shared page; **no Activate**; decisions + mark-paid | `/applications/:id` shared workspace; no Activate ✓; **no decisions** (P0 §1.2); mark-paid ✓; record/confirm DP ✓ | **P0** decisions | `useApplicationActions.ts` |
| Bank transfers | (inside payments) | `/bank-transfers` ✓ | — | |
| Applications list Company filter | n/a | 403 on `/companies/all` → empty filter | P2 (QA_PRODUCTION PROD-10) | `ApplicationsList.tsx:81` |
| Guard | `?reason=not_finance` | same ✓ | — | |

---

## 2. Top 10 P0 gaps (exact files)

| # | Gap | blox-vercel reference | blox-marketplace files to change | Layer |
|---|---|---|---|---|
| 1 | **Finance has no credit-parity decisions** (Generate Contract, Resubmit, Reject, Reopen, Contract Review, Approve for Finance) | `packages/shared/src/utils/application-status-transitions.ts` `FINANCE_OFFICER_ALLOWED`; `packages/admin/src/modules/admin/features/applications/pages/ApplicationDetailPage/ApplicationDetailPage.tsx:98` (`canCreditDecide = credit \|\| finance \|\| admin`); `docs/FINANCE_PORTAL.md` §Capabilities | `packages/api/src/applications/application-transitions.ts` (add `finance` actor to every credit edge except →`active`), `applications-lifecycle.service.ts:45` (`OPS_ROLES` → add finance for `approveWithContract`, `opsTransition`), `applications.controller.ts` `@Roles` on `approve-contract`, `ops/…/contract/signed`, `compliance-check`; `packages/shared/src/ops-applications/useApplicationActions.ts` (`canCreditDecide` → include finance; keep `activate`/`directActivate` on `canActivateFinancing` = credit/admin) | API → UI |
| 2 | **No "Approve for Finance"** edge `under_review → pending_finance_activation` | `CREDIT_OFFICER_ALLOWED.under_review` includes `pending_finance_activation`; `ApplicationDetailPage.tsx:909 handleApproveForFinance` | `application-transitions.ts` RULES (`{from:'under_review', to:'pending_finance_activation', actors:['credit','finance','admin']}`); `useApplicationActions.ts` (`approveForFinance`); `ApplicationWorkspace.tsx` button + `locales.ts` EN/AR; decide whether `compliance.assertPassedForApproval` gates it (recommend yes) | API → UI |
| 3 | **No Reject / Reopen from `pending_finance_activation`** | `…_ALLOWED.pending_finance_activation: ['active'\|—, 'rejected', 'under_review']`; detail shows Reject at PFA (`:1484`) | `application-transitions.ts` add `PFA → rejected` (credit, finance, admin, reasonRequired) and `PFA → under_review` (credit, finance, admin); `useApplicationActions.ts` `reject`/`reopen` status lists | API → UI |
| 4 | **Finance Queue surface missing** (Activation view-only tab + Review tab with Pipeline/Rejected) | `packages/finance/src/modules/finance/features/queue/FinanceQueuePage.tsx`; constants `FINANCE_ACTIVATION_QUEUE_STATUSES`, `FINANCE_REVIEW_QUEUE_STATUSES` | new `packages/shared/src/ops-applications/FinanceQueue.tsx` (reuse `CreditQueue` pattern, `OpsTabs`); add the two status constants to `shared/src/ops-applications/constants.ts`; route `/queue` in `packages/finance/src/main.tsx`; make `/` redirect to `/queue` | UI (API `GET /ops/applications?statusIn=` suffices) |
| 5 | **Settlements do not exist** (request → finance approve/reject) | `SettlementsOverviewPage.tsx` (`application_settlements`: `status`, `settlement_amount`, `remaining_principal`, `forgiven_rent`, `requested_at`, `approved_at`); settlement discount settings already exist in both | `packages/api/prisma/schema.prisma` new `ApplicationSettlement` (+ **migration** — note prod drift), `packages/api/src/settlements/` module (`GET /ops/settlements`, `POST /ops/settlements/:id/approve\|reject` @Roles finance/admin/super; customer `POST /applications/:id/settlement-request` out of scope here), `packages/finance/src/pages/SettlementsPage.tsx`, nav | API → UI |
| 6 | **Blox credits adjust is admin-only; no finance UI** | `CreditsOverviewPage.tsx` + RPCs `admin_add/subtract/set_user_credits`; FINANCE_PORTAL "Credits: finance/admin" | `packages/api/src/credits/credits.controller.ts` `@Roles` on `GET/POST ops/users/:id/credits` → add `finance_officer`; add `GET /ops/credits` list; `packages/finance/src/pages/CreditsPage.tsx`; nav. (Prod: `credit_transactions` table has **no migration** — must ship one) | API → UI |
| 7 | **Credit cannot mark installments paid** | `ApplicationDetailPage.tsx:100` `canMarkPaid = finance \|\| admin \|\| credit`; FINANCE_PORTAL "Mark-paid shared by credit, finance, admin" | `packages/api/src/payments/payments.controller.ts` `@Roles` on `ops/payment-schedules/:id/pay`, `bank-pending`, `payments/:id/confirm-bank`, `pending-bank` → add `credit_officer`; `useApplicationActions.ts` `markInstallmentPaid` → `credit \|\| finance`; **decide** SoD: `payments.service.ts:321/529/586` will still refuse the *approving* credit officer unless `SEPARATION_OF_DUTIES=false` or company flag off | API → UI |
| 8 | **UI renders actions the API rejects / hides actions it allows** — "Request resubmission" at `contract_signing_required` → `400 invalid_status_transition`; "Record down payment" hidden from credit | `CREDIT_OFFICER_ALLOWED.contract_signing_required` includes `resubmission_required`; DP handled by credit+finance | `application-transitions.ts` add `CSR → resubmission_required` (credit, finance, admin, reasonRequired); `useApplicationActions.ts` `recordDownPayment: (credit \|\| finance) && …`; add a unit test asserting every `visibleWorkspaceActions` edge exists in RULES | API + UI |
| 9 | **Admin override narrower than vercel** — no `draft → active`, no unconditional `under_review → active` ("Activate (Admin)"), no `active → submission_cancelled`, no `submission_cancelled → under_review` reopen, no ops cancel from UR/RS | `ADMIN_ALLOWED`; detail `:1401 isFullAdmin && draft → Activate`, `:1054 Activate (Admin)`, `:1538 Reopen from submission_cancelled` | `application-transitions.ts` (admin edges); `applications-lifecycle.service.ts` `activate()` — allow admin without `allowDirectActivate` and from `draft`; `useApplicationActions.ts` (`activateAdmin`, `cancel`, `reopen` incl. CXL) | API → UI |
| 10 | **Portal base-path helper not wired** (brief lists base-path bugs as P0) | `packages/shared/src/contexts/portal-base-path.tsx` + every list uses `withPortalBase(portalBase, '/applications/view/:id')` | wrap each portal in `PortalBasePathProvider` (`admin` `/main`, others `''`) in the 5 `main.tsx`; replace `basePath`/`detailBase`/`backTo` props with `withPortalBase(usePortalBasePath(), '/applications/:id')` in `ApplicationsList.tsx:128`, `CreditQueue.tsx:82`, `ApplicationWorkspace.tsx:344`, `PendingBankTransfers.tsx`; align `withPortalBase` signature (`(base, path)`) with vercel; fix `backToQueue` label for dealer/finance | UI |

## 3. P1 / P2 list

| Sev | Gap | Files |
|---|---|---|
| P1 | Activate shortcuts from CS / CUR / DPS (vercel credit/admin) — decide: adopt or document "queue path only" | `applications-lifecycle.service.ts` `activate()` status check |
| P1 | Ops cancel edges (UR/RS → CXL for credit/finance/admin; PFA/ACT → CXL admin) | RULES, `useApplicationActions.ts` |
| P1 | Partner Hub detail page (`/main/companies/:id`) with flags + assigned credit/finance officers | `packages/admin/src/main.tsx`, new page; API `PATCH /users/:id` |
| P1 | Finance `/payments` transactions tab; `/book` if not treated as P0 | `packages/finance` |
| P1 | Separation-of-duties vs credit mark-paid (product decision; keep company flag) | `payments.service.ts` |
| P1 | Finance `/applications` Company filter 403 | `ApplicationsList.tsx:81` gate on role |
| P2 | Detail route shape `/applications/view/:id` vs `/applications/:id`; admin `/main/…` | portal `main.tsx` (add redirect aliases) |
| P2 | `reject` UI hides CS/CUR/DPR edges API allows | `useApplicationActions.ts` |
| P2 | Admin Applications "Contracts" tab must include PFA (vercel fix 2026-07-24) | `ApplicationsList.tsx` tab `statusIn` |
| P2 | "Partner Hub" vs "Companies" label; "Installments" vs "Ledgers" | `locales.ts` |
| P2 | `ops.common.back` undefined (dealer `/company`) | `locales.ts` |
| P2 | Document `partner_processing` (Zoho) as marketplace-only terminal state excluded from finance/credit queues | docs |

## 4. Smoke test checklist (adapted from FINANCE_PORTAL.md + QA_PORTAL_SCALE_ALIGNMENT)

Accounts: `dealer@`, `credit@`, `finance@`, `admin@drivemarket.local` / `Password123!`. API prefix `/api/v1`.

| # | Step | Actor | Call / screen | Expected |
|---|---|---|---|---|
| 1 | Submit walk-in application | dealer | `POST /ops/applications` → `POST /ops/applications/:id/submit` | `under_review`; listing `reserved`; appears in credit `/queue` **and** finance `/queue` Review |
| 2 | Approve for Finance | credit **or** finance | `POST /ops/applications/:id/transition {toStatus:'pending_finance_activation'}` | 200 → `pending_finance_activation`; appears in finance `/queue` Activation tab (view-only) |
| 3 | Activate Financing | credit | `POST /ops/applications/:id/activate` | 200 → `active`; N `payment_schedules`; listing `sold`; in finance `/book` |
| 4 | Finance cannot activate | finance | same call; UI: no Activate button on `/applications/:id` | `403 forbidden_role`; button absent |
| 5 | Finance review parity | finance | Generate Contract (`approve-contract`), Resubmit, Reject (reason), Reopen (`rejected → under_review`), Contract Review (`contracts_submitted → contract_under_review → pending_finance_activation`) | each 200 with the target status |
| 6 | Mark paid | credit **and** finance | `POST /ops/payment-schedules/:id/pay` | 200; `paidAmount` = amount; idempotent on repeat |
| 7 | Settlements | finance | `GET /ops/settlements` → approve one, reject one | statuses `approved` / `rejected`; app schedule reflects settlement |
| 8 | Credits | finance | `POST /ops/users/:id/credits {delta:+100}` then `{delta:-50}` | balance 50; transactions listed |
| 9 | Credit cannot settle / adjust credits | credit | steps 7–8 calls | `403 forbidden_role` |
| 10 | Admin override | admin | Activate from `under_review` without company flag; `active → submission_cancelled`; `submission_cancelled → under_review` | all 200 |
| 11 | Dealer negatives | dealer | `activate`, `transition {toStatus:'pending_finance_activation'}` | `403 forbidden_role` |
| 12 | Wrong portal | customer session on dealer/credit/finance/admin | UI | redirect `?reason=not_<portal>` |
| 13 | Scope | credit with `credit_scope=assigned` and no companies | `GET /ops/applications` | empty; direct `GET /ops/applications/:id` of other company → `403 out_of_scope` |
| 14 | Dead-end guard | credit | `contract_under_review → pending_finance_activation` with DP owed → `activate` | `down_payment_incomplete`; `PFA → down_payment_required` recovery 200 |
| 15 | Exports | finance | `/exports` download schedules + ledgers CSV | files non-empty; no secrets |

## 6. Phase C — implemented (same day, uncommitted)

| PR | What changed | Files |
|---|---|---|
| **PR-1 matrix + roles** | RULES rewritten to vercel's matrix: `DECISION = credit \| finance \| admin` on every review edge; new edges `under_review → pending_finance_activation` (Approve for Finance), `pending_finance_activation → rejected / under_review`, `contract_signing_required → resubmission_required / under_review`, `contracts_submitted → pending_finance_activation / resubmission_required`, `down_payment_required → pending_finance_activation`, `down_payment_submitted → rejected`, ops cancel (`under_review`/`resubmission_required` → `submission_cancelled`; admin from `pending_finance_activation`/`active`), admin reopen from `submission_cancelled`, admin `draft → pending_finance_activation`. `→ active` is never generic. New `ACTIVATE_FROM_STATUSES`, `ADMIN_ACTIVATE_FROM_STATUSES`, `FINANCE_ACTIVATION_QUEUE_STATUSES`, `allowedTargets()`. | `packages/api/src/applications/application-transitions.ts` |
| | `DECISION_ROLES` for `approveWithContract`, `opsTransition`, `submitSignedContractOps`; `activate()` now accepts `contracts_submitted`/`contract_under_review`/`down_payment_submitted`/`pending_finance_activation` for credit/admin and `draft`/`under_review` for admin (`admin_override` audit metadata), still refuses finance and still enforces the down-payment and compliance gates; `opsTransition` runs the compliance gate on Approve-for-Finance, releases the listing on cancel, re-reserves on reopen (409 `vehicle_unavailable` if sold), and notifies "Application approved / cancelled / reopened". | `applications-lifecycle.service.ts` |
| | `@Roles` widened to finance on `approve-contract`, `compliance-check`, `ops/…/contract/signed`; to credit on `payment-schedules/:id/pay`, `bank-pending`, `payments/:id/confirm-bank`, `payments/pending-bank`; `PAYMENT_ROLES` + compliance `OPS_ROLES` updated. | `applications.controller.ts`, `payments.controller.ts`, `payments.service.ts`, `compliance/compliance.service.ts` |
| **PR-2 finance surfaces (API)** | `ApplicationSettlement` model + `SettlementStatus` enum + **migration** `20260904000000_add_application_settlements`; `SettlementsModule`: `POST /applications/:id/settlement-request` (customer), `GET /ops/settlements`, `POST /ops/settlements/:id/approve\|reject` (finance/admin, company-scoped, activity-logged). Credits: `GET/POST /ops/users/:id/credits` now finance/admin; new `GET /ops/credits` list. New `GET /ops/finance/book` (remaining principal, next installment) and `GET /ops/payment-transactions`. | `prisma/schema.prisma`, `prisma/migrations/…`, `src/settlements/*`, `src/credits/*`, `src/payments/*`, `app.module.ts` |
| **PR-3 shared UI** | `visibleWorkspaceActions` mirrors vercel: `canCreditDecide` includes finance, `canActivateFinancing` = credit/admin, `canMarkPaid` = credit/finance/admin; new `approveForFinance`, `activateAdmin`, `cancel`, reopen from cancelled (admin), reject through `pending_finance_activation`, `recordDownPayment` for credit; workspace buttons + EN/AR copy; `FinanceQueue` (Activation view-only / Review pipeline-rejected); finance constants; `ConfirmDialog` accepts `children`. | `packages/shared/src/ops-applications/{useApplicationActions,ApplicationWorkspace,FinanceQueue,constants,index}.ts(x)`, `i18n/locales.ts`, `ops-core/shared/ConfirmDialog/ConfirmDialog.tsx`, `index.ts` |
| **PR-4 portal shells** | Finance nav: Dashboard · **Queue** · **Active book** · **Payments** (schedules / transactions / bank tabs) · **Settlements** · **Credits** · **Exports** · Applications; `/` → `/queue`; `/applications/view/:id` alias; legacy `/schedules`, `/bank-transfers` redirect. `PortalBasePathProvider` wired for admin (`/main`); `ApplicationsList`, `CreditQueue`, `FinanceQueue`, `ApplicationWorkspace` derive links from `usePortalBasePath()` (props remain as overrides); back label is audience-aware. | `packages/finance/src/main.tsx`, `packages/finance/src/pages/Finance{Book,Payments,Settlements,Credits,Exports}Page.tsx`, `packages/admin/src/main.tsx` |
| **Schema drift repair** | The parity integration spec exposed QA_PRODUCTION PROD-02 locally: `credit_transactions`, `insurance_rates`, `promotions`, `packages`, `settlement_discount_settings` had no migration, so `migrate deploy` DBs 500 on credits and catalog. Added `20260904000001_add_missing_catalog_credit_tables` generated with `prisma migrate diff --from-migrations --to-schema-datamodel` (additive; one `DROP INDEX IF EXISTS` for an index the schema no longer declares). Deploying it fixes the five prod 500s. | `packages/api/prisma/migrations/20260904000001_add_missing_catalog_credit_tables/migration.sql` |
| **PR-5 tests** | `application-transitions.spec.ts` rewritten (finance ≡ credit parity, no generic → active, spine edges, cancel/reopen, dealer scope); new `ui-actions-match-rules.spec.ts` (every rendered action exists in RULES for that actor; finance never sees Activate); new `finance-parity.integration.spec.ts` (approve-for-finance, finance activate 403, credit activate + schedules + listing sold, finance contract/resubmit/reject/reopen, reject from pending, dealer 403, shared mark-paid, settlements + credits finance-only, admin override + late cancel). Pre-existing lint error in `generate-schedule.ts` removed. | `packages/api/src/applications/*.spec.ts`, `packages/api/test/integration/finance-parity.integration.spec.ts` |

**Deliberately not done (P1/P2, see §3):** Partner Hub detail page with officer assignment (assignment still on Users detail); activate shortcuts from `contracts_submitted`/`contract_under_review`/`down_payment_submitted` are **enabled** for credit/admin per vercel but the down-payment gate still applies; separation-of-duties is unchanged (the approving credit officer is still refused on mark-paid while enabled); `partner_processing` remains marketplace-only; customer-portal settlement request UI is out of scope (API only).

## 5. Phase B — implementation order (as executed)

1. **PR-1 shared+api matrix** (#1, #2, #3, #8, #9 edges): `application-transitions.ts` RULES, lifecycle role gates, controller `@Roles`; extend `application-transitions.spec.ts` + `separation-of-duties.spec.ts`; add "every UI action has a RULE" test.
2. **PR-2 api finance surfaces** (#5, #6, #7 API): `ApplicationSettlement` model + migration, settlements module, credits roles + list endpoint, mark-paid roles, CSV export endpoints (or reuse list endpoints).
3. **PR-3 shared UI** (#1, #2, #3, #7, #8 UI): `useApplicationActions.ts`, `ApplicationWorkspace.tsx` buttons + i18n, `FinanceQueue.tsx`, constants.
4. **PR-4 portal shells** (#4, #10, P1 partner detail): finance routes/nav (`/queue`, `/book`, `/payments`, `/settlements`, `/credits`, `/exports`), base-path provider wiring in 5 portals, admin company detail.
5. **PR-5 tests/docs**: integration specs for the smoke table above; update `06_UI_IA_SCREENS.md` §C–E and `09_ACCEPTANCE_TEST_MATRIX.md` (P2-06, P4-03).

Nothing in this plan touches `packages/marketplace`.
