# Architecture addendum — NestJS stack (locked)

Supersedes Supabase references in older sections of `04_TECH_ARCHITECTURE.md` / `05_API_RPC_CONTRACT.md` until those files are fully rewritten.

## Stack

| Layer | Choice |
|-------|--------|
| API | NestJS (`packages/api`) on port **3010** |
| DB | PostgreSQL via Docker Compose host port **55432** |
| ORM | Prisma (`packages/api/prisma/schema.prisma`) |
| Auth | Better Auth email/password at `/api/auth/*` |
| Files | S3/R2 when configured; otherwise local `.uploads/` |
| Web | Vite apps call `VITE_API_URL` with `credentials: 'include'` |

## Authz

- Global `SessionAuthGuard` + `@Public()` / `@Roles(...)`
- Domain rules in services (same matrices as former RPCs in `03` / `05`)
- No Postgres RLS — authorization is application-layer

## Key routes

| Method | Path | Notes |
|--------|------|-------|
| * | `/api/auth/*` | Better Auth |
| GET | `/api/health` | Health |
| GET | `/api/me` | Current profile |
| GET | `/api/products` | Published list |
| GET | `/api/products/by-slug/:slug` | Detail (VIN omitted) |
| CRUD | `/api/dealer/inventory*` | Dealer listings + publish |
| POST | `/api/applications` | Customer create → `under_review` + reserve |
| GET | `/api/ops/applications` | Credit/admin queue |
| POST | `/api/ops/applications/:id/transition` | reject / resubmission_required |

## Local

```bash
docker compose up -d postgres
cp packages/api/.env.example packages/api/.env
npm run db:push -w @drivemarket/api
npm run db:seed -w @drivemarket/api
npm run dev:api
```

Seed password: `Password123!` for `*@drivemarket.local` users.
