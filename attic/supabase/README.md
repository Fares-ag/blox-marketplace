# Archived Supabase schema (dead parallel path)

This directory is **not** the canonical database or backend for DriveMarket.

## Status

- **Archived:** moved from `/supabase` to `/attic/supabase` to eliminate schema drift.
- **Canonical schema:** `packages/api/prisma/schema.prisma` and numbered migrations under `packages/api/prisma/migrations/`.
- **Canonical API:** NestJS app at `packages/api` (Better Auth, Prisma, Postgres).

## Why this exists

Early design docs and prototypes assumed Supabase (Postgres + RLS + Edge Functions + Storage). The production monorepo migrated to a NestJS + Prisma stack. The SQL here was a parallel schema that was never wired to `packages/*` and had begun to diverge from the Prisma model.

Do **not** apply these migrations to production. Do **not** add new tables here. Refer to Prisma migrations for all schema changes.

## If you need historical context

The migrations capture Phase 1 marketplace tables, RLS policies, RPC stubs, and SkipCash edge-function placeholders from the original Supabase-first plan. They are kept for audit/reference only.
