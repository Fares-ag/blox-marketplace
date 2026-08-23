-- Client idempotency keys (scoped per user + route) for money-moving POSTs.
CREATE TABLE "idempotency_records" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "statusCode" INTEGER NOT NULL DEFAULT 201,
    "responseBody" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "idempotency_records_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "idempotency_records_userId_scope_idempotencyKey_key"
    ON "idempotency_records"("userId", "scope", "idempotencyKey");

CREATE INDEX "idempotency_records_createdAt_idx" ON "idempotency_records"("createdAt");

ALTER TABLE "idempotency_records"
    ADD CONSTRAINT "idempotency_records_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
