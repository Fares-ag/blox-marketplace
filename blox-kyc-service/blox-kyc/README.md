# Blox KYC Service

Standalone KYC/onboarding platform for DriveMarket/Blox — the durable core from
`Blox_KYC_Build_Plan.md` (WS-B). Separate service, separate database. NestJS +
Prisma + Postgres.

## What this is (and is not)

**Built (the durable core):**
- **Case engine** — a guarded, atomic state machine (`src/kyc/case-engine/case-state-machine.ts`) and pure decisioning (`decisioning.service.ts`). Every transition is explicit; illegal moves and concurrent races are rejected (`updateMany` guarded on current status).
- **Check framework** — a `KycCheckPort` interface (`src/kyc/checks/check.types.ts`) and a registry that runs checks and records one append-only `KycCheck` row each. Real checks plug in without touching the engine.
- **Consent** — granular per-purpose consent capture.
- **Immutable audit trail** — every state change and sensitive read is recorded; the table is append-only (no update/delete in code, plus a DB trigger to add in the first migration).
- **Field encryption** — AES-256-GCM for sensitive data at rest (`FieldCryptoService`), key from KMS in prod.
- **Service auth** — the marketplace API is the only caller; it authenticates the human and forwards identity via `x-actor-*` headers behind a shared service key (`ServiceAuthGuard`). TODO(P1): move to signed JWT / mTLS.
- **Data model** — `prisma/schema.prisma` implements §8 of the plan (minus biometrics). Financial/identity relations are `onDelete: Restrict` — records are never cascade-deleted.

**Stubbed (plug in per the plan's workstreams):** the check *adapters* in
`src/kyc/checks/adapters/` return `manual_review` (the safe default — routes to a
human, never silently passes) until their real logic lands:
- `qid` / `passport` — OCR + MRZ + NFC (WS-C)
- `doc_authenticity` — in-house tamper/authenticity (WS-C)
- `bank_statement` — multi-bank OCR + affordability (WS-E)
- `aml_screen` — bought sanctions/PEP provider (WS-F)
- `bureau` — Qatar Credit Bureau (Phase 3, gated on QFC licensing)
- `identity_binding` — **already real**: passes only when an agent/video attestation is recorded (the compensating control that replaces face scan).

## Quick start

```bash
# 1. Database (separate from the marketplace)
docker compose up -d postgres        # Postgres on host port 55433

# 2. Env
cp .env.example .env                 # set KYC_SERVICE_API_KEY + KYC_FIELD_ENCRYPTION_KEY

# 3. Install + generate + migrate
npm install
npm run db:generate                  # needs network to Prisma's binary CDN
npx prisma migrate dev --name init   # creates the schema + (add) the audit-immutability trigger

# 4. Run
npm run start:dev                    # http://localhost:3020/api
```

> Note: `prisma generate` / `migrate` download Prisma's engine binaries. This repo
> was authored in a sandbox where that CDN was blocked, so the client was not
> generated here — run the two commands above in your environment. The pure logic
> (state machine + decisioning) is unit-tested and passing (`npm test`), and the
> TypeScript typechecks clean against the generated client's types.

## API (all under `/api`, all require `x-kyc-service-key`; caller identity via `x-actor-id/-role/-company`)

| Method | Path | Purpose |
|---|---|---|
| POST | `/kyc/cases` | Create (idempotent per applicationId) |
| GET | `/kyc/cases` | Ops review queue (company-scoped) |
| GET | `/kyc/cases/:id` | Case + all evidence (company-scoped, 404 cross-tenant) |
| POST | `/kyc/cases/:id/consent` | Record per-purpose consent |
| POST | `/kyc/cases/:id/documents` | Register an uploaded ID document |
| POST | `/kyc/cases/:id/identity-binding` | Agent/video attestation (ops role) |
| POST | `/kyc/cases/:id/run` | Run all v1 checks → route the case |
| POST | `/kyc/cases/:id/decision` | Ops approve/reject (reason required) |
| GET | `/health`, `/health/ready` | Liveness / DB-readiness |

## First migration — add the audit-immutability trigger

After `prisma migrate dev --name init`, add a raw-SQL migration so the audit trail
is append-only at the DB level:

```sql
CREATE OR REPLACE FUNCTION kyc_audit_immutable() RETURNS trigger AS $$
BEGIN RAISE EXCEPTION 'kyc_audit_events is append-only'; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER kyc_audit_no_update BEFORE UPDATE OR DELETE ON kyc_audit_events
FOR EACH ROW EXECUTE FUNCTION kyc_audit_immutable();
```

## How it plugs into the marketplace

The marketplace API calls this service at the KYC touchpoints of the application
flow: create a case when an application starts, record consent, register uploaded
docs, run checks, and gate the financing state machine on the KYC case reaching
`approved`. Wire it as an HTTP client in the marketplace's applications module.
