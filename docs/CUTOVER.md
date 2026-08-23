# Production cutover: blox-app → blox-marketplace

Hard cutover. Do **not** dual-write to Supabase and marketplace. After T-0, Supabase is read-only for 30 days.

Marketplace API: NestJS `packages/api` on port **3010**. Flutter talks only to `/api/v1/*` with Bearer tokens.

## Staging QA (T-7 to T-1)

- [ ] Deploy marketplace API with mobile auth, KYC bridge, SkipCash, and migration scripts
- [ ] `npx prisma migrate deploy` on staging Postgres
- [ ] Dry-run ETL against a Supabase **read replica** or snapshot (`packages/api/scripts/migration/supabase-to-prisma/`)
- [ ] Run `validate.ts` gates; abort if counts or checksums fail
- [ ] Point blox-app at staging: `API_BASE_URL=https://staging-api.example`
- [ ] Device QA: sign-up, sign-in, apply, document upload (bank/salary + KYC QID), contract sign, SkipCash initiate/verify, credits, push token register
- [ ] Load-test create application + multipart upload + payment initiate
- [ ] Confirm blox-kyc-module webhooks hit `POST /api/v1/webhooks/kyc`

## Cutover window (T-0)

```text
T-0:00  Set Supabase to read-only (dashboard / RLS — no writes)
T-0:30  Run migration orchestrator against production marketplace DB
T-1:00  Run validation gates; abort if any fail
T-1:30  Send password-reset emails (`send-password-resets.ts`) — hashes are not portable
T-2:00  Release blox-app with API_BASE_URL only (no Supabase keys)
T+24h   Watch error rates, payment completions, KYC webhooks
T+30d   Decommission Supabase (see docs/DECOMMISSION.md)
```

1. Freeze writes on the live Supabase project.
2. Export + load users, products, applications, documents, schedules, credits, device tokens, membership/deferrals.
3. Copy Storage objects to S3/MinIO (`copy-supabase-storage.ts`).
4. Validate `MigrationIdMap` coverage and row counts.
5. Trigger Better Auth password-reset campaign.
6. Ship the Flutter build that uses Nest `:3010` only.

## Rollback (30-day window)

- Keep the Supabase snapshot **read-only**.
- Store a last-known Flutter build that still has Supabase env in an unpublished release channel.
- If rollback: re-enable Supabase writes, revert the store build, and accept drift for any post-cutover marketplace writes.

Old application UUIDs: look up `MigrationIdMap` for 90 days before treating unknown IDs as 404.

## Success checks

- Login, apply, documents, contract, payments work against marketplace
- Web marketplace and mobile share one Postgres `User` table
- KYC QID/passport status lands on `ApplicationDocument` via webhook
- Zero `supabase_flutter` in the release app
