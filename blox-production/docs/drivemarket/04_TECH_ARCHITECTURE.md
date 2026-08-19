# 04 — Technical Architecture

**Product:** DriveMarket  
**Related:** [`03_DOMAIN_MODEL.md`](03_DOMAIN_MODEL.md) · [`05_API_RPC_CONTRACT.md`](05_API_RPC_CONTRACT.md) · [`08_CURSOR_BOOTSTRAP.md`](08_CURSOR_BOOTSTRAP.md) · [`11_DESIGN_GUIDELINES.md`](11_DESIGN_GUIDELINES.md)

---

## 1. Monorepo map

```text
drivemarket/
  package.json                 # workspaces: packages/*
  packages/
    api/                       # port 3010 — NestJS + Prisma (canonical backend)
    shared/                    # @drivemarket/shared
    marketplace/               # port 5173 — customer-facing
    dealer/                    # port 5176
    credit/                    # port 5177
    finance/                   # port 5179
    admin/                     # port 5174
    super-admin/               # port 5175
  packages/api/prisma/
    schema.prisma              # canonical domain model
    migrations/                # numbered SQL migrations (apply via Prisma)
  attic/
    supabase/                  # archived parallel schema — do not use
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
| Server state | **TanStack Query** | Fetch/cache REST reads from `@drivemarket/api` |
| Client state | **Zustand** | Auth session mirror, UI chrome, compare tray |
| Backend | **NestJS + Prisma + Postgres** | Better Auth, role guards, service layer |
| ORM / migrations | **Prisma** | `schema.prisma` is source of truth; SQL in `prisma/migrations/` |
| Object storage | S3-compatible (MinIO locally) | Listing images, KYC docs, contracts |
| Payments | SkipCash via API service | Secrets server-side only |
| Currency | `Intl` QAR | Shared formatter |
| Unit tests | Vitest | Shared + API service tests |
| E2E later | Playwright | Smoke: login + publish + apply |
| CI | lint + typecheck + test + build | Block merge on fail |
| Mobile later | Flutter | Phase 5; same REST API |

**Locked:** Prefer TanStack Query + Zustand over Redux unless the implementing team insists on Blox Redux parity.

Auth: Better Auth session cookies against `packages/api` (not Supabase Auth).

---

## 3. Shared package responsibilities

`packages/shared` should export:

| Area | Contents |
|------|----------|
| API client helpers | Typed fetch wrappers for REST endpoints |
| Types / Zod schemas | Mirror domain enums and DTO shapes |
| Formatters | Money QAR, dates, phone |
| Brand tokens | `brand-tokens.ts`, `theme.ts`, `global.scss` per `11` |
| RBAC helpers | Role checks, scope helpers (UI gating only — server enforces) |
| Status config | Labels + semantic colors for chips (tokens from `11`) |
| Calculator | Pure functions: monthly from price, rate, tenure, down payment |

Apps import shared; apps must not duplicate status enums.

---

## 4. Database and migration flow (Prisma)

### 4.1 Canonical schema

- **Single source of truth:** `packages/api/prisma/schema.prisma`
- **Never** hand-edit production Postgres without a matching migration file.
- Archived Supabase SQL lives under `attic/supabase/` for reference only — it is **not** applied.

### 4.2 Environments

| Env | Purpose |
|-----|---------|
| local | Docker Postgres + `npm -w @drivemarket/api run db:migrate` |
| staging | Managed Postgres; `prisma migrate deploy` in CI/CD |
| production | Live Qatar market; same deploy path as staging |

Separate SkipCash sandbox vs live keys per env.

### 4.3 Migration workflow

1. Edit `schema.prisma` to reflect domain changes in `03`.
2. Create a migration: `npm -w @drivemarket/api run db:migrate -- --name descriptive_name`
3. Review generated SQL under `packages/api/prisma/migrations/<timestamp>_descriptive_name/migration.sql`.
4. Commit both `schema.prisma` and the migration folder.
5. CI and deploy run `npm -w @drivemarket/api run db:deploy` (alias for `prisma migrate deploy`).

Rules:

- Migrations are **append-only** — do not rewrite applied migration history.
- Include enums, tables, indexes, foreign keys, and check constraints in migrations.
- Prefer Prisma relations + service-layer guards over database RLS for tenancy (API enforces company scope).

### 4.4 Application-level invariants (implemented in services)

| Concern | Where enforced |
|---------|----------------|
| Application status transitions | `packages/api` guarded transitions + transition matrix |
| Listing reservation / sold | Application lifecycle service on status change |
| Immutable snapshots after submit | Service writes; no client updates to `customerSnapshot` / `pricingSnapshot` |
| Payment ledger append-only | Prisma models + service rules |

### 4.5 Storage buckets (S3-compatible)

| Bucket | Public read? | Who writes |
|--------|--------------|------------|
| `listing-images` | Yes (via public base URL) | dealer, admin |
| `kyc-docs` | No | customer (own apps), credit/admin read |
| `contracts` | No | system/credit generate; customer upload signed; credit/admin read |

Path conventions:

```text
listing-images/{company_id}/{product_id}/{filename}
kyc-docs/{application_id}/{category}/{filename}
contracts/{application_id}/generated.pdf
contracts/{application_id}/signed/{filename}
```

Configure via `S3_*` env vars in `packages/api/.env.example`.

---

## 5. Security architecture

1. **Role guards on every ops route** in `packages/api` (`@Roles`, company scope helpers).
2. **Service role / DB credentials** live only in the API process — never in Vite bundles.
3. **Better Auth** handles sessions; email verification configurable per env.
4. **CORS** allowlisted per env (`CORS_ORIGINS`).
5. **No secrets in `VITE_*`** except public app URLs; API keys stay server-side.
6. **PII:** KYC and contracts buckets authenticated; VIN excluded from public product views.
7. **Idempotency** on payment completion and activate (see `05`).

### Auth flows

- Email/password signup + login via Better Auth (`packages/api`).
- Email verification required before apply when `REQUIRE_EMAIL_VERIFICATION=true` (default in production).
- Role from `users.role` — fetched after session establishment.

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

See `packages/api/.env.example` for the full API surface. Frontend apps use `VITE_*` for public origins only.

### 6.1 API (`packages/api`)

| Variable | Required | Notes |
|----------|----------|-------|
| `DATABASE_URL` | Y | Postgres connection string |
| `BETTER_AUTH_SECRET` | Y | Session signing secret |
| `BETTER_AUTH_URL` | Y | Public API origin |
| `CORS_ORIGINS` | Y | Comma-separated frontend origins |
| `S3_*` | N | Omit for local `.uploads/` fallback |
| `SKIPCASH_*` | N | Payment gateway |
| `SENTRY_DSN` | N | Optional error tracking |

### 6.2 Vite apps

| Variable | Required | Notes |
|----------|----------|-------|
| `VITE_API_URL` | Y | Points at `@drivemarket/api` |
| `VITE_APP_URL` | Y | This app’s public origin |
| `VITE_SENTRY_DSN` | N | Optional |

---

## 7. Observability

| Signal | Mechanism |
|--------|-----------|
| Domain transitions | `activity_logs` table |
| Payments | Structured logs + gateway ids in API |
| Scheduled jobs | NestJS `@nestjs/schedule` cron in `packages/api` |
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

1. `npm` install workspaces  
2. ESLint + TypeScript project references  
3. Vitest unit tests (`npm -w @drivemarket/api test`)  
4. `prisma migrate deploy` against ephemeral Postgres in CI  
5. Optional: Playwright smoke on staging  

---

## 10. Local development ports

| App | Port |
|-----|------|
| api | 3010 |
| marketplace | 5173 |
| admin | 5174 |
| super-admin | 5175 |
| dealer | 5176 |
| credit | 5177 |
| finance | 5179 |

Document these in each package config (`vite.config.ts` or `main.ts`).

---

## 11. What not to invent in architecture

- Second database for listings vs applications (keep one Postgres).
- Client-held payment secrets.
- Parallel status enums in frontend that diverge from DB.
- New schema under `attic/supabase` or ad-hoc SQL outside Prisma migrations.
- Blockchain nodes, wallets, or “integrity sidechains” in this version.
- Redux boilerplate unless team-mandated.
