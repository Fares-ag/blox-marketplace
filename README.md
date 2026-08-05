# DriveMarket

Hybrid vehicle financing marketplace (Qatar · QAR).

## Stack (locked)

- **API:** NestJS (`packages/api`)
- **DB:** PostgreSQL + **Prisma**
- **Auth:** **Better Auth** (email/password)
- **Files:** S3-compatible (MinIO local / R2 or S3 in prod)
- **Web:** React 19 + Vite monorepo apps + TanStack Query + Zustand
- **Design:** `blox-production/docs/drivemarket/11_DESIGN_GUIDELINES.md`

Docs: [`blox-production/docs/drivemarket/`](blox-production/docs/drivemarket/00_README.md)

## Quick start

```bash
# 1. Database (+ optional MinIO)
docker compose up -d postgres
# Postgres is on host port 55432 (avoids conflict with local Postgres on 5432/5433)

# 2. API
cp packages/api/.env.example packages/api/.env
npm install
npm run db:push -w @drivemarket/api
npm run db:seed -w @drivemarket/api
npm run dev:api

# 3. Marketplace (and other apps)
cp packages/marketplace/.env.example packages/marketplace/.env
npm run dev:marketplace
```

| App | Port |
|-----|------|
| API | 3010 |
| marketplace | 5173 |
| admin | 5174 |
| super-admin | 5175 |
| dealer | 5176 |
| credit | 5177 |
| finance | 5179 |

Seed logins (after `db:seed`): see `packages/api/prisma/seed.ts` (password `Password123!`).

## Phase status

- Phase 0 UI scaffold exists; backend moved from Supabase → Nest/Prisma/Better Auth.
- Phase 1 domain APIs + dealer/marketplace flows in progress.
