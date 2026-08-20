# Backup & disaster recovery (blox.market)

Operational runbook for Postgres, the financial ledger, and KYC/contract object storage. Complements [DEPLOY.md](./DEPLOY.md).

## Scope

| Asset | Location | RPO target | RTO target |
|-------|----------|------------|------------|
| Postgres (users, applications, `payment_events`, schedules) | Railway managed Postgres | ≤ 24 h (daily backup) + PITR window | ≤ 4 h (restore drill) |
| KYC PDFs / images | S3-compatible (`S3_BUCKET_KYC`) | Same as bucket versioning | ≤ 4 h |
| Generated/signed contracts | S3-compatible (`S3_BUCKET_CONTRACTS`) | Same as bucket versioning | ≤ 4 h |
| Listing images | S3-compatible (`S3_BUCKET_LISTINGS`) | Best effort | ≤ 24 h |

**Never** rely on Railway container ephemeral disk (`.uploads/`) in production — see DEPLOY.md S3 requirements.

---

## 1. Managed Postgres (Railway)

### Backup cadence

- **Automated daily snapshots** — enable in Railway → Postgres service → Backups. Confirm retention (minimum **7 days**; prefer **14–30 days** for finance workloads).
- **Point-in-time recovery (PITR)** — when available on your Railway plan, enable continuous WAL archiving. Document the **PITR window** (e.g. “restore to any second in the last 7 days”) in your internal ops calendar after verifying in the Railway dashboard.
- **Before risky migrations** — take a manual snapshot or run `pg_dump` against a read replica / staging clone:

```bash
railway run --service postgres pg_dump "$DATABASE_URL" -Fc -f blox-pre-migrate-$(date +%Y%m%d).dump
```

Store dumps in encrypted object storage (not the app repo).

### Restore drill (quarterly)

Perform at least once per quarter on a **disposable staging project**, not production:

1. Note current migration head: `cd packages/api && npx prisma migrate status`
2. Create a fresh Railway Postgres instance (or local Docker Postgres).
3. Restore the latest automated snapshot **or** PITR target into that instance.
4. Point a staging API at the restored `DATABASE_URL` and run:

```bash
npm run db:deploy -w @drivemarket/api
npx prisma migrate diff \
  --from-migrations prisma/migrations \
  --to-schema-datamodel prisma/schema.prisma \
  --shadow-database-url "$SHADOW_DATABASE_URL"
# Expected: empty output (no drift)
```

5. Smoke test: sign-in, list one application, read one `payment_events` row, confirm schedule counts match expectations.
6. Record elapsed time, issues, and the restored timestamp in your incident log.

### Ledger integrity after restore

The append-only **`payment_events`** table is the source of truth for installment and waive amounts. After any restore:

```sql
-- Schedules must satisfy paid + remaining = amount (cache columns)
SELECT id, amount, "paidAmount", "remainingAmount"
FROM payment_schedules
WHERE ("paidAmount" + "remainingAmount") <> amount;
-- Expected: 0 rows
```

If rows appear, stop cutover and reconcile from `payment_events` before serving traffic.

---

## 2. Object storage (KYC & contracts)

### Configuration

Production buckets (Cloudflare R2 or AWS S3):

- `S3_BUCKET_KYC` — customer identity documents (PDF/images)
- `S3_BUCKET_CONTRACTS` — generated and signed agreements
- `S3_BUCKET_LISTINGS` — dealer listing photos

Enable **versioning** and **lifecycle rules** on KYC and contracts buckets:

| Bucket | Versioning | Retention |
|--------|------------|-----------|
| KYC | On | **7 years** minimum (regulatory; adjust per legal counsel) |
| Contracts | On | Life of financing + **7 years** |
| Listings | Optional | 90 days after listing archived/sold |

### Backup cadence

- R2/S3 versioning covers accidental overwrite/delete.
- For cross-region resilience, enable **replication** to a secondary bucket/region (monthly verification that replication lag < 1 h).
- Do **not** export KYC to developer laptops. Access only via presigned URLs or ops tooling with audit logging.

### Restore drill (semi-annual)

1. Pick one archived application id from staging.
2. Restore a deleted object version from the KYC bucket console/CLI.
3. Confirm the API `readKyc` path returns the document and the application document row still references the key.

---

## 3. Application & config backups

- **Infrastructure as code** — this git repository + Railway/Vercel dashboard exports.
- **Secrets** — `BETTER_AUTH_SECRET`, S3 keys, SMTP, Zoho tokens live in Railway/Vercel secret stores only (see DEPLOY.md secrets hygiene).
- **Migration history** — `packages/api/prisma/migrations/` is canonical; never `db push` on production.

---

## 4. Incident response checklist

When Postgres or object storage is suspect:

1. **Stop writes** — pause deploys; optionally enable maintenance mode on portals.
2. **Capture request ids** — grep API logs / Sentry for `request_id` tags (see request-id middleware).
3. **Identify blast radius** — time window, affected `applicationId`s / `scheduleId`s.
4. **Restore or PITR** — follow §1 drill; do not partial-restore single tables without finance sign-off.
5. **Reconcile ledger** — run SQL invariant check above; rerun integration tests against restored DB:

```bash
npm -w @drivemarket/api run test:integration
```

6. **Post-mortem** — document root cause, backup gap, and runbook updates.

---

## 5. Related automation

CI runs P1 regression integration tests on every PR:

- `waive.integration.spec.ts` — dual-control waive + balance invariant
- `down-payment.integration.spec.ts` — record → activate / insufficient blocks
- `jobs.integration.spec.ts` — overdue sweep + payment reminder dedup (system actor FK)

See `.github/workflows/ci.yml`.
