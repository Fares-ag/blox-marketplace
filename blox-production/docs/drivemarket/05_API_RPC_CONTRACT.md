# 05 — API / RPC / Edge Contract

**Product:** DriveMarket  
**Related:** [`03_DOMAIN_MODEL.md`](03_DOMAIN_MODEL.md) · [`04_TECH_ARCHITECTURE.md`](04_TECH_ARCHITECTURE.md) · [`09_ACCEPTANCE_TEST_MATRIX.md`](09_ACCEPTANCE_TEST_MATRIX.md)

All mutations that change application status or listing reservation **must** go through RPCs (or triggers invoked by those RPCs). Direct table `UPDATE` of `applications.status` from the client is forbidden (revoke UPDATE of status for authenticated roles; allow only via SECURITY DEFINER functions).

---

## 1. Tables (quick index)

See full columns in `03_DOMAIN_MODEL.md`.

| Table | Primary consumers |
|-------|-------------------|
| companies | admin, dealer (read own), ops |
| users | all apps (profile) |
| credit_officer_companies | admin, credit |
| finance_officer_companies | admin, finance |
| offers | admin, calculator, apply |
| products | marketplace (public subset), dealer, admin |
| product_images | marketplace, dealer |
| applications | marketplace, dealer (limited), credit, finance, admin |
| application_documents | customer, credit, admin |
| payment_schedules | customer, finance, credit (read), admin |
| payment_transactions | Edge Functions, finance read |
| notifications | all authenticated |
| activity_logs | super-admin, admin; inserts via RPC |
| email_outbox | workers / Edge |
| device_tokens | Flutter later |

---

## 2. RLS summary

Policies are sketched; implement as migrations. Principle: **deny default**.

### 2.1 `users`

| Op | Who |
|----|-----|
| SELECT | self; admin/super_admin all; officers may select limited fields of customers on apps in scope |
| UPDATE | self (profile fields only); admin/super_admin for role/company/scope |
| INSERT | trigger on auth signup **or** admin invite RPC |

### 2.2 `companies`

| Op | Who |
|----|-----|
| SELECT | authenticated can read `active` companies’ public fields; dealer own; ops all/scoped |
| INSERT/UPDATE | admin, super_admin |

### 2.3 `products` / `product_images`

| Op | Who |
|----|-----|
| SELECT public | anon/auth: rows with `listing_status = published` (and images for those) — **exclude vin** via view or column privilege |
| SELECT dealer | own `company_id` all statuses |
| SELECT ops | admin all; credit/finance as needed for apps in scope |
| INSERT/UPDATE/DELETE | dealer own company; admin |

Prefer a view `published_products_public` without VIN for anon.

### 2.4 `applications`

| Op | Who |
|----|-----|
| SELECT | customer own; dealer same company_id (hide full PII if required — start with full for MVP dealer lead, tighten later); credit/finance by scope; admin all |
| INSERT/UPDATE | **via RPC only** |

### 2.5 `application_documents`

| Op | Who |
|----|-----|
| SELECT | customer own app; credit/admin/finance scoped |
| INSERT | customer own app in uploadable statuses; credit optional |

Storage policies must match paths.

### 2.6 `payment_schedules` / `payment_transactions`

| Op | Who |
|----|-----|
| SELECT | customer own app; finance/credit scoped; admin |
| INSERT/UPDATE | RPC / Edge service role |

### 2.7 `notifications`

| Op | Who |
|----|-----|
| SELECT/UPDATE read_at | own rows |
| INSERT | service role / RPC |

### 2.8 `activity_logs`

| Op | Who |
|----|-----|
| SELECT | admin, super_admin |
| INSERT | service role / RPC |

---

## 3. RPC signatures

Conventions:

- All RPCs: `SECURITY DEFINER`, `SET search_path = public`.
- Raise exceptions with stable error codes in `MESSAGE` / `ERRCODE` for UI mapping.
- Write `activity_logs` on success for status and listing changes.

### 3.1 `has_blocking_application(p_user_id uuid DEFAULT auth.uid()) → boolean`

**Who:** authenticated (self); ops may pass user id if admin.

**Logic:** exists application for user where `status NOT IN ('rejected','submission_cancelled','completed')`.

---

### 3.2 `list_published_products(...)

```text
list_published_products(
  p_make text DEFAULT NULL,
  p_model text DEFAULT NULL,
  p_year_min int DEFAULT NULL,
  p_year_max int DEFAULT NULL,
  p_price_min numeric DEFAULT NULL,
  p_price_max numeric DEFAULT NULL,
  p_condition vehicle_condition DEFAULT NULL,
  p_company_id uuid DEFAULT NULL,
  p_q text DEFAULT NULL,          -- search make/model/trim
  p_limit int DEFAULT 24,
  p_offset int DEFAULT 0
) → SETOF published_product_row
```

**Who:** anon + authenticated.  
**Filter:** `listing_status = 'published'` only.  
**Returns:** public columns + primary image URL + company name/logo. No VIN.

Also provide `count_published_products` with same filters for pagination.

---

### 3.3 `get_listing_detail(p_slug text) → jsonb`

**Who:** anon + authenticated.

**Logic:**

1. Load product by slug.
2. If `published` → return public detail + images + default offer summary.
3. If `reserved` → if `auth.uid()` has blocking app on this product, return detail with `availability: 'pending_financing'`; else return null / raise `P0001` not available.
4. If `sold`/`archived`/`draft` → not available to public (dealer/ops use separate RPCs).

---

### 3.4 `customer_create_application(...)

```text
customer_create_application(
  p_product_id uuid,
  p_offer_id uuid,
  p_customer_snapshot jsonb,
  p_pricing_snapshot jsonb,
  p_installment_plan jsonb DEFAULT NULL
) → applications
```

**Who:** `customer`, email verified.

**Validations:**

1. No blocking application for `auth.uid()`.
2. Product `listing_status = published` AND `finance_eligible = true`.
3. Offer active and allowed for product/company.
4. Pricing snapshot server-recomputed or validated within tolerance (reject client-only monthly if mismatch).
5. Required snapshot fields: name, phone, qid (and employment/income if required by config).

**Effects:**

- Insert application `status = under_review`, `company_id` from product, `submitted_at = now()`.
- Set product `listing_status = reserved` if was `published`.
- Notify credit officers (in-app + outbox stub).
- Notify dealer users of company.
- Activity log.

**Idempotency:** optional client `Idempotency-Key` header not native to PostgREST — use unique partial index or return existing if duplicate submit within short window. Minimum: blocking check prevents second app.

---

### 3.5 `customer_upload_application_document(...)

```text
customer_upload_application_document(
  p_application_id uuid,
  p_category document_category,
  p_storage_path text,
  p_mime_type text
) → application_documents
```

**Who:** customer owner; status in `under_review`, `resubmission_required`, `draft`.

Alternatively: Storage RLS + AFTER INSERT trigger validating path prefix `kyc-docs/{application_id}/`.

---

### 3.6 `customer_cancel_application(p_application_id uuid, p_reason text DEFAULT NULL) → applications`

**Who:** customer owner.

**Allowed from:** `draft`, `under_review`, `resubmission_required`.

**Effects:** status → `submission_cancelled`; unreserve if no other blocking apps on product; notify ops; activity log.

---

### 3.7 `customer_submit_signed_contract(p_application_id uuid, p_signed_path text) → applications`

**Who:** customer owner; status `contract_signing_required`.

**Effects:** set `signed_contract_path`; status → `contracts_submitted`; notify credit; activity log.

---

### 3.8 `customer_resubmit_application(p_application_id uuid) → applications`

**Who:** customer owner; status `resubmission_required`.

**Effects:** → `under_review`; clear or retain resubmission_comment per policy (retain for audit); notify credit.

---

### 3.9 `ops_transition_application(...)

```text
ops_transition_application(
  p_application_id uuid,
  p_to_status application_status,
  p_reason text DEFAULT NULL
) → applications
```

**Who:** credit_officer, admin, super_admin (finance only for explicitly allowed payment-adjacent transitions in matrix).

**Logic:** validate role + scope + allowed edge in transition matrix; require reason for `rejected` and `resubmission_required`; apply listing reservation side effects via trigger.

---

### 3.10 `credit_approve_with_contract(...)

```text
credit_approve_with_contract(
  p_application_id uuid,
  p_contract_data jsonb DEFAULT NULL
) → applications
```

**Who:** credit_officer (scoped), admin, super_admin.

**From:** `under_review` (and optionally `contract_under_review` re-issue).

**Effects:**

- Build/store `contract_data` (merge pricing_snapshot + customer_snapshot + vehicle).
- Generate PDF path (Edge or server job — MVP may store JSON and generate client-side print; prefer server PDF path stub).
- `contract_generated = true`
- status → `contract_signing_required`
- notify customer

---

### 3.11 `credit_activate_application(p_application_id uuid, p_direct boolean DEFAULT false) → applications`

**Who:** credit_officer (scoped), admin, super_admin. **Not** finance_officer.

**From:**

- Normal: `pending_finance_activation` (or `contract_under_review` if matrix allows)
- Direct: `under_review` only if `p_direct` and company/platform `allow_direct_activate`

**Effects (idempotent):**

- If already `active` → return row unchanged (no duplicate schedules).
- Else set `active`, `activated_at = now()`.
- Insert `payment_schedules` from installment_plan if none exist.
- Set product `listing_status = sold`.
- Notify customer; activity log.

**Idempotency key:** application id — second call no-ops.

---

### 3.12 `current_user_can_pay_for_application(p_application_id uuid) → boolean`

**Who:** authenticated.

**True when:**

- caller owns application OR is finance/admin (ops tools)
- application status = `active` (or `down_payment_required` for DP pay)
- company.can_pay = true
- target schedule exists and is payable

---

### 3.13 `finance_mark_schedule_paid(...)

```text
finance_mark_schedule_paid(
  p_schedule_id uuid,
  p_method text,
  p_reference text DEFAULT NULL,
  p_amount numeric DEFAULT NULL
) → payment_schedules
```

**Who:** finance_officer (scoped), admin.

**Effects:** update paid/remaining/status; activity log; optionally complete application when all schedules paid.

---

### 3.14 `complete_skipcash_payment_atomic(...)

```text
complete_skipcash_payment_atomic(
  p_idempotency_key text,
  p_gateway_payment_id text,
  p_application_id uuid,
  p_schedule_id uuid,
  p_amount numeric,
  p_raw_payload_ref text DEFAULT NULL
) → payment_transactions
```

**Who:** service role only (Edge Functions).

**Logic:**

1. If transaction with `idempotency_key` already `completed` → return it.
2. Else mark transaction completed, apply amount to schedule, set schedule paid if remaining ≤ 0.
3. Lock rows (`SELECT … FOR UPDATE`) to avoid races.

---

### 3.15 Admin helpers (sketch)

| RPC | Purpose |
|-----|---------|
| `admin_create_company_with_dealer` | Create company + invite dealer user |
| `admin_set_company_can_pay` | Toggle can_pay |
| `admin_upsert_offer` | Offers CRUD |
| `dealer_publish_product` / `dealer_unpublish_product` | Validates publish rules; enforces J10 |

---

## 4. Edge Functions

### 4.1 `skipcash-payment`

**Input (JSON):** `{ applicationId, scheduleId, returnUrl, amount? }`  
**Auth:** user JWT.  
**Steps:**

1. Validate `current_user_can_pay_for_application`.
2. Validate returnUrl against allowlist.
3. Create `payment_transactions` row `pending` with idempotency key.
4. Call SkipCash create payment API.
5. Store gateway id; return redirect URL.

### 4.2 `skipcash-verify`

**Input:** gateway payment id / transaction id from return query.  
**Auth:** user JWT.  
**Steps:** verify with SkipCash; if paid, call `complete_skipcash_payment_atomic`; return status for UI.

### 4.3 `skipcash-webhook`

**Auth:** webhook signature secret.  
**Steps:** verify signature → complete atomic → always respond in a way that stops harmful retries on success; log failures.

### 4.4 `payment-reminders`

**Cron:** daily.  
**Steps:** find schedules due in N days / overdue; enqueue `email_outbox` + in-app notifications; skip if `can_pay` false optional.

### 4.5 `payment-monitor`

**Cron:** hourly.  
**Steps:** flag `payment_transactions` stuck `pending` > threshold; structured log / notify admin.

### 4.6 `_shared/`

SkipCash client, Supabase service client, allowlist helper, signature verify, logging helpers.

---

## 5. Idempotency keys

| Operation | Key | Behaviour on replay |
|-----------|-----|---------------------|
| SkipCash complete | gateway payment id | Return completed txn; do not double-pay schedule |
| Activate | application id | No-op if already active |
| Create application | blocking constraint | Second create fails |

---

## 6. Error code catalog (stable strings)

| Code | Meaning |
|------|---------|
| `blocking_application_exists` | Customer already has in-flight/active app |
| `listing_not_available` | Not published / not finance eligible |
| `listing_has_active_financing` | Cannot unpublish/archive |
| `invalid_status_transition` | Matrix violation |
| `forbidden_role` | Caller role cannot perform action |
| `company_cannot_pay` | can_pay false |
| `email_unverified` | Apply gate |
| `direct_activate_disabled` | Policy flag false |
| `payment_already_completed` | Idempotent hit (may be success path) |
| `validation_failed` | Field/docs validation |

UI maps these to human copy; do not rely on English exception text alone.

---

## 7. Notification events (minimum)

| Event | Recipients |
|-------|------------|
| application_submitted | credit (scope), dealer company |
| resubmission_required | customer |
| contract_ready | customer |
| contracts_submitted | credit |
| application_rejected | customer, dealer |
| application_activated | customer, dealer |
| payment_completed | customer |
| payment_reminder | customer |

---

## 8. Contract PDF note

MVP acceptable path:

1. `contract_data` JSON stored.
2. Credit/customer generate printable PDF in browser **or** Edge renders PDF to `contracts` bucket.
3. Customer uploads signed PDF to `signed_contract_path`.

Do not block Phase 2 on perfect server-side PDF if print template + upload loop works and paths are durable.
