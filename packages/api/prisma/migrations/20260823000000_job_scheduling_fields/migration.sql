-- Zoho retry backoff tracking on applications
ALTER TABLE "applications" ADD COLUMN "zohoSyncAttempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "applications" ADD COLUMN "zohoNextRetryAt" TIMESTAMP(3);

-- Quote expiry persistence (belt-and-suspenders alongside computed expiresAt)
ALTER TABLE "dealer_quotes" ADD COLUMN "expiredAt" TIMESTAMP(3);

CREATE INDEX "dealer_quotes_expiresAt_expiredAt_idx" ON "dealer_quotes"("expiresAt", "expiredAt");
