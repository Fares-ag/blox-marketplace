# 08 — Cursor Bootstrap (Empty Repo)

**Product:** DriveMarket  
**Related:** [`00_README.md`](00_README.md) · [`07_BUILD_PHASES.md`](07_BUILD_PHASES.md) · [`04_TECH_ARCHITECTURE.md`](04_TECH_ARCHITECTURE.md) · [`11_DESIGN_GUIDELINES.md`](11_DESIGN_GUIDELINES.md)

Use this document when starting from a **new empty git repository**. Paste or open the entire `docs/drivemarket/` pack as context. Another agent must not need any Blox repo.

---

## 1. Preconditions

- Node.js 20+ and npm or pnpm.
- Supabase CLI installed.
- This documentation pack available at `docs/drivemarket/` (copy these 12 files into the new repo first).

---

## 2. Folder creation commands

Run from the new repo root:

```bash
mkdir -p packages/shared/src/{config,styles,lib,types,rpc,hooks,components}
mkdir -p packages/marketplace
mkdir -p packages/dealer
mkdir -p packages/credit
mkdir -p packages/finance
mkdir -p packages/admin
mkdir -p packages/super-admin
mkdir -p supabase/migrations
mkdir -p supabase/functions/{skipcash-payment,skipcash-verify,skipcash-webhook,payment-reminders,payment-monitor,_shared}
mkdir -p docs/drivemarket
```

On Windows PowerShell:

```powershell
@(
  "packages/shared/src/config",
  "packages/shared/src/styles",
  "packages/shared/src/lib",
  "packages/shared/src/types",
  "packages/shared/src/rpc",
  "packages/shared/src/hooks",
  "packages/shared/src/components",
  "packages/marketplace",
  "packages/dealer",
  "packages/credit",
  "packages/finance",
  "packages/admin",
  "packages/super-admin",
  "supabase/migrations",
  "supabase/functions/skipcash-payment",
  "supabase/functions/skipcash-verify",
  "supabase/functions/skipcash-webhook",
  "supabase/functions/payment-reminders",
  "supabase/functions/payment-monitor",
  "supabase/functions/_shared",
  "docs/drivemarket"
) | ForEach-Object { New-Item -ItemType Directory -Force -Path $_ | Out-Null }
```

---

## 3. Root `package.json` sketch

```json
{
  "name": "drivemarket",
  "private": true,
  "workspaces": [
    "packages/*"
  ],
  "scripts": {
    "dev:marketplace": "npm -w @drivemarket/marketplace run dev",
    "dev:dealer": "npm -w @drivemarket/dealer run dev",
    "dev:credit": "npm -w @drivemarket/credit run dev",
    "dev:finance": "npm -w @drivemarket/finance run dev",
    "dev:admin": "npm -w @drivemarket/admin run dev",
    "dev:super-admin": "npm -w @drivemarket/super-admin run dev",
    "lint": "npm run lint --workspaces --if-present",
    "typecheck": "npm run typecheck --workspaces --if-present",
    "test": "npm run test --workspaces --if-present"
  },
  "engines": {
    "node": ">=20"
  }
}
```

Each app package name: `@drivemarket/marketplace`, `@drivemarket/dealer`, etc. Shared: `@drivemarket/shared`.

---

## 4. Naming conventions (enforce from day one)

| Concept | Name |
|---------|------|
| Vehicle listing status column | `listing_status` (never overload as lone `status` on products) |
| Application status column | `status` typed as `application_status` |
| Auth storage key | `drivemarket-supabase-auth` |
| CSS variables | `--dm-*` |
| Money class | `.dm-money` / `.dm-numeric` |
| Package scope | `@drivemarket/*` |

---

## 5. Ordered Cursor prompts

Run **one phase at a time**. After each phase, require the agent to tick `09_ACCEPTANCE_TEST_MATRIX.md` for that phase.

### Prompt 0 — Context lock

```text
You are building DriveMarket from the docs in docs/drivemarket/.
Read 00_README.md, 03_DOMAIN_MODEL.md, 04_TECH_ARCHITECTURE.md, 07_BUILD_PHASES.md, and 11_DESIGN_GUIDELINES.md.
Locked: Model C hybrid marketplace; Stack A Supabase + React/Vite monorepo; TanStack Query + Zustand;
Qatar/QAR; no blockchain; no credits/membership; listing_status separate from application status;
server-enforced transitions; design must follow 11 (no purple-on-white, no Inter/Roboto defaults).
Do not scaffold payments Edge Functions until Phase 3.
Confirm understanding of enums and RBAC before coding.
```

### Prompt 1 — Phase 0 only

```text
Execute Phase 0 per docs/drivemarket/07_BUILD_PHASES.md and 04_TECH_ARCHITECTURE.md.
Apply 11_DESIGN_GUIDELINES.md for brand-tokens.ts, theme.ts, and global.scss.
Create workspace apps and shared package; Supabase init + first migrations for companies/users/RLS;
role guards; marketplace home hero matching composition rules in 11.
Stop when Phase 0 acceptance criteria are met. Do not implement inventory or apply yet.
Then run through Phase 0 cases in 09_ACCEPTANCE_TEST_MATRIX.md and report pass/fail.
```

### Prompt 2 — Phase 1 only

```text
Execute Phase 1 only per 07_BUILD_PHASES.md.
Implement products/product_images/offers/applications/documents, RPCs in 05_API_RPC_CONTRACT.md
needed for publish/browse/apply/reserve/block, dealer inventory UI, marketplace browse/detail/calculator/apply,
credit/admin queues for under_review/reject/resubmit.
Migrations required for every schema change.
Follow 11 for UI. Forbid blockchain, credits, membership, SkipCash.
Stop at Phase 1 exit criteria; verify with 09.
```

### Prompt 3 — Phase 2 only

```text
Execute Phase 2 only: full status matrix, contract upload loop, activate + payment_schedules,
listing sold, cancel/unreserve, direct-activate policy, dealer unpublish guard.
No SkipCash yet. Verify happy path manually per 09 Phase 2.
```

### Prompt 4 — Phase 3 only

```text
Execute Phase 3 payments per 05 and 07: Edge Functions skipcash-*, can_pay gate,
idempotent complete_skipcash_payment_atomic, reminders, monitor.
Secrets only in Edge/Vault. Verify webhook replay idempotency.
```

### Prompt 5 — Phase 4

```text
Execute Phase 4: finance portal parity, officer company M2M scopes, dealer notes,
email outbox reliability. Finance must not activate.
```

### Prompt 6 — Phase 5

```text
Execute Phase 5: compare, favorites/saved searches, featured, SEO/OG, soft white-label,
Flutter customer parity spec + app. Keep public marketplace chrome DriveMarket-branded.
```

---

## 6. Scaffold checklist (Phase 0)

- [ ] Docs copied to `docs/drivemarket/`
- [ ] Workspaces resolve; shared package importable
- [ ] Vite ports: 5173, 5174, 5175, 5176, 5177, 5179
- [ ] Supabase `config.toml` present
- [ ] Migration creates enums + companies + users + RLS
- [ ] Auth storage key namespaced
- [ ] Tokens `--dm-*` + fonts from `11` loaded
- [ ] Marketplace home is one composition (not dashboard)
- [ ] `.env.example` lists Vite vars only (no service role)
- [ ] Seed users documented for local QA

---

## 7. Hard forbids (agent guardrails)

Include in every phase prompt if the agent drifts:

1. Do not add blockchain, wallets, smart contracts, credits, membership, multi-currency.
2. Do not put SkipCash secrets in the client.
3. Do not allow client UPDATE of `applications.status`.
4. Do not use `status` alone on products — use `listing_status`.
5. Do not skip `11_DESIGN_GUIDELINES.md` for UI.
6. Do not mark a phase complete without `09` checks.

---

## 8. Suggested first migration filename

```text
supabase/migrations/20260805000000_init_enums_companies_users.sql
supabase/migrations/20260805000001_rls_companies_users.sql
```

Phase 1 continues with products/applications migrations — never squash without team agreement.

---

## 9. After scaffold

Point humans and agents to:

1. `00_README.md` — entry  
2. `07_BUILD_PHASES.md` — what to build next  
3. `09_ACCEPTANCE_TEST_MATRIX.md` — done definition  
4. `11_DESIGN_GUIDELINES.md` — before UI PRs  
