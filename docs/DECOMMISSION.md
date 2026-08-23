# Decommission after unified-backend cutover

Run only after the 30-day rollback window in [CUTOVER.md](./CUTOVER.md).

## blox-app

- `blox-app/server` (legacy KYC BFF) is removed. KYC is owned by marketplace `KycModule` + blox-kyc-module.
- Flutter env is `API_BASE_URL` (Nest :3010). Do not ship `SUPABASE_URL` / `SUPABASE_ANON_KEY` in release.
- Archive leftover Supabase CI secrets after T+30d.

## Supabase project

- Confirm no production traffic (PostgREST, Auth, Storage, Edge Functions).
- Export a final snapshot for records, then pause/delete the project.
- Revoke service-role and anon keys.

## Single env source

Marketplace [`packages/api/.env.example`](../packages/api/.env.example) is the backend env template (Postgres, Better Auth, S3/MinIO, Redis, KYC HMAC, SkipCash).
