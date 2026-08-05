# 04 — Technical Architecture

**Product:** DriveMarket  
**Related:** [`03_DOMAIN_MODEL.md`](03_DOMAIN_MODEL.md) · [`05_API_RPC_CONTRACT.md`](05_API_RPC_CONTRACT.md) · [`08_CURSOR_BOOTSTRAP.md`](08_CURSOR_BOOTSTRAP.md) · [`11_DESIGN_GUIDELINES.md`](11_DESIGN_GUIDELINES.md)

---

## 1. Monorepo map

```text
drivemarket/
  package.json                 # workspaces: packages/*
  packages/
    shared/                    # @drivemarket/shared
    marketplace/               # port 5173 — customer-facing
    dealer/                    # port 5176
    credit/                    # port 5177
    finance/                   # port 5179
    admin/                     # port 5174
    super-admin/               # port 5175
  supabase/
    config.toml
    migrations/
    functions/
      skipcash-payment/
      skipcash-verify/
      skipcash-webhook/
      payment-reminders/
      payment-monitor/
      _shared/
  docs/
    drivemarket/               # this pack (may live only in docs repo initially)
```

Workspace name: `drivemarket`. Package scope: `@drivemarket/*`.

---

## 2. Stack versions guidance

| Layer | Choice | Guidance |
|-------|--------|----------|
| UI | React 19 + TypeScript + Vite | One Vite app per package |
| Components | MUI + SCSS modules / CSS variables | Theme from `11`; MUI overrides in shared `theme.ts` |
| Routing | React Router 6 | Per-app route modules |
| Server state | **TanStack Query** | Fetch/cache Supabase reads |
| Client state | **Zustand** | Auth session mirror, UI chrome, compare tray |
| Backend | Supabase | Auth, Postgres, RLS, Storage, Edge Functions (Deno) |
| Payments | SkipCash via Edge Functions | Secrets server-side only |
| Currency | `Intl` QAR | Shared formatter |
| Unit tests | Vitest | Shared + critical RPCs mocked |
| E2E later | Playwright | Smoke: login + publish + apply |
| CI | lint + typecheck + migration dry-run | Block merge on fail |
| Mobile later | Flutter | Phase 5; same Supabase project |

**Locked:** Prefer TanStack Query + Zustand over Redux unless the implementing team insists on Blox Redux parity.

Auth storage key (namespaced): `drivemarket-supabase-auth`.

---

## 3. Shared package responsibilities

`packages/shared` should export:

| Area | Contents |
|------|----------|
| Supabase client factory | URL, anon key, storage key |
| Types / Zod schemas | Mirror domain enums and row shapes |
| Formatters | Money QAR, dates, phone |
| Brand tokens | `brand-tokens.ts`, `theme.ts`, `global.scss` per `11` |
| RPC wrappers | Typed callers for `05` RPCs |
| RBAC helpers | Role checks, scope helpers (UI gating only — server enforces) |
| Status config | Labels + semantic colors for chips (tokens from `11`) |
| Calculator | Pure functions: monthly from price, rate, tenure, down payment |

Apps import shared; apps must not duplicate status enums.

---

## 4. Supabase layout

### 4.1 Environments

| Env | Purpose |
|-----|---------|
| local | `supabase start` |
| staging | Shared QA project |
| production | Live Qatar market |

Separate SkipCash sandbox vs live keys per env.

### 4.2 Migrations

- All schema changes as numbered SQL under `supabase/migrations/`.
- Never hand-edit remote schema without a migration.
- Include: enums, tables, indexes, RLS policies, triggers, RPC functions.

### 4.3 Triggers (minimum)

| Trigger | Purpose |
|---------|---------|
| `set_updated_at` | All mutable tables |
| `enforce_application_transition` | BEFORE UPDATE OF status — validate matrix in `03` |
| `sync_listing_reservation` | AFTER INSERT/UPDATE applications — reserve / unreserve / sold |
| `protect_immutable_application_company` | Block `company_id` / `product_id` change after submit |

### 4.4 Storage buckets

| Bucket | Public read? | Who writes |
|--------|--------------|------------|
| `listing-images` | Yes | dealer, admin |
| `kyc-docs` | No | customer (own apps), credit/admin read |
| `contracts` | No | system/credit generate; customer upload signed; credit/admin read |

Path conventions:

```text
listing-images/{company_id}/{product_id}/{filename}
kyc-docs/{application_id}/{category}/{filename}
contracts/{application_id}/generated.pdf
contracts/{application_id}/signed/{filename}
```

---

## 5. Security architecture

1. **RLS on every user-facing table.** Deny by default; add explicit policies.
2. **Service role only in Edge Functions** (and local migration tooling) — never in Vite.
3. **SECURITY DEFINER RPCs** must:
   - Call `auth.uid()` and resolve role from `users`
   - Enforce transition matrix / tenancy
   - Avoid granting broader SELECT than needed
4. **CORS / return URLs** allowlisted per env (`VITE_APP_URL` variants for each app).
5. **No secrets in `VITE_*`** except Supabase URL + anon key + public app URL.
6. **PII:** KYC and contracts buckets authenticated; VIN excluded from public product views.
7. **Idempotency** on payment completion and activate (see `05`).

### Auth flows

- Email/password signup + login via Supabase Auth.
- Email verification required before apply (marketplace `AuthGuard`).
- Password reset via Supabase templates.
- Role from `public.users.role` — JWT custom claims optional later; MVP: fetch profile after session.

### Guard pattern (each app)

| App | Allowed role(s) |
|-----|-----------------|
| marketplace authenticated area | `customer` |
| dealer | `dealer_agent` |
| credit | `credit_officer` |
| finance | `finance_officer` |
| admin | `admin` |
| super-admin | `super_admin` |

Wrong role → redirect login with `?reason=not_<role>`.

---

## 6. Environment variables

### 6.1 All Vite apps

| Variable | Required | Notes |
|----------|----------|-------|
| `VITE_SUPABASE_URL` | Y | |
| `VITE_SUPABASE_ANON_KEY` | Y | |
| `VITE_APP_URL` | Y | This app’s public origin |
| `VITE_SENTRY_DSN` | N | Optional |

Marketplace may also need:

| Variable | Notes |
|----------|-------|
| `VITE_MARKETPLACE_NAME` | Display name override |

### 6.2 Edge Functions / Vault

| Variable | Notes |
|----------|-------|
| `SUPABASE_URL` | |
| `SUPABASE_SERVICE_ROLE_KEY` | **Never** to browsers |
| `SUPABASE_ANON_KEY` | If function acts as user |
| `SKIPCASH_API_KEY` | |
| `SKIPCASH_CLIENT_ID` | As required by SkipCash API |
| `SKIPCASH_WEBHOOK_SECRET` | |
| `SKIPCASH_BASE_URL` | Sandbox vs live |
| `PAYMENT_RETURN_URL_ALLOWLIST` | Comma-separated origins |
| `SENTRY_DSN` | Optional for functions |

Exact SkipCash field names may vary by API version — keep adapters in `functions/_shared/skipcash.ts`.

---

## 7. Observability

| Signal | Mechanism |
|--------|-----------|
| Domain transitions | `activity_logs` |
| Edge payments | Structured `console` JSON logs + gateway ids |
| Stuck payments | `payment-monitor` cron Edge Function |
| Frontend errors | Optional Sentry per app |
| Email | `email_outbox` status + attempts |

Log correlation: include `application_id`, `gateway_payment_id`, `request_id` when present.

---

## 8. App shell differences (same tokens)

| Surface | Shell | Density |
|---------|-------|---------|
| Marketplace | Top nav, marketing home | Comfortable; marketplace-first |
| Dealer / credit / finance / admin / super-admin | Side nav | Dense data UI OK |

All share one token set from `11`. Density differs by shell, not by palette fork.

---

## 9. CI checklist

1. `pnpm`/`npm` install workspaces  
2. ESLint + TypeScript project references  
3. Vitest unit  
4. `supabase db lint` / migration apply on ephemeral DB  
5. Optional: Playwright smoke on staging  

---

## 10. Local development ports

| App | Port |
|-----|------|
| marketplace | 5173 |
| admin | 5174 |
| super-admin | 5175 |
| dealer | 5176 |
| credit | 5177 |
| finance | 5179 |

Document these in each package `vite.config.ts` `server.port`.

---

## 11. What not to invent in architecture

- Second database for listings vs applications (keep one Postgres).
- Client-held payment secrets.
- Parallel status enums in frontend that diverge from DB.
- Blockchain nodes, wallets, or “integrity sidechains” in this version.
- Redux boilerplate unless team-mandated.
