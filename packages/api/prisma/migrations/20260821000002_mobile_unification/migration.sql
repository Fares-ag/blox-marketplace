-- Mobile unification: KYC linkage, credits, device tokens, deferrals, ID map.

ALTER TYPE "DocumentCategory" ADD VALUE IF NOT EXISTS 'passport';
ALTER TYPE "DocumentCategory" ADD VALUE IF NOT EXISTS 'license';

ALTER TABLE "applications"
  ADD COLUMN IF NOT EXISTS "kyc_case_id" TEXT,
  ADD COLUMN IF NOT EXISTS "kyc_status" TEXT,
  ADD COLUMN IF NOT EXISTS "blox_membership" JSONB;

CREATE INDEX IF NOT EXISTS "applications_kyc_case_id_idx" ON "applications"("kyc_case_id");

ALTER TABLE "application_documents"
  ADD COLUMN IF NOT EXISTS "kyc_document_id" TEXT,
  ADD COLUMN IF NOT EXISTS "kyc_document_type" TEXT,
  ADD COLUMN IF NOT EXISTS "verification_status" TEXT,
  ADD COLUMN IF NOT EXISTS "quality" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "authenticity" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "review_status" TEXT,
  ADD COLUMN IF NOT EXISTS "original_name" TEXT;

CREATE INDEX IF NOT EXISTS "application_documents_applicationId_category_idx"
  ON "application_documents"("applicationId", "category");

CREATE TABLE IF NOT EXISTS "user_credits" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "balance" DECIMAL(18,3) NOT NULL DEFAULT 0,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "user_credits_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "user_credits_user_id_key" ON "user_credits"("user_id");

CREATE TABLE IF NOT EXISTS "device_tokens" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "platform" TEXT NOT NULL,
  "fcm_token" TEXT NOT NULL,
  "app_version" TEXT,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "device_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "device_tokens_fcm_token_key" ON "device_tokens"("fcm_token");
CREATE INDEX IF NOT EXISTS "device_tokens_user_id_idx" ON "device_tokens"("user_id");

CREATE TABLE IF NOT EXISTS "payment_deferrals" (
  "id" TEXT NOT NULL,
  "application_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "payment_id" TEXT,
  "original_due_date" DATE NOT NULL,
  "deferred_to_date" DATE NOT NULL,
  "reason" TEXT,
  "year" INTEGER,
  "deferred_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "original_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payment_deferrals_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "payment_deferrals_application_id_idx" ON "payment_deferrals"("application_id");
CREATE INDEX IF NOT EXISTS "payment_deferrals_user_id_idx" ON "payment_deferrals"("user_id");

CREATE TABLE IF NOT EXISTS "mobile_refresh_tokens" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "token_hash" TEXT NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "revoked_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "mobile_refresh_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "mobile_refresh_tokens_token_hash_key" ON "mobile_refresh_tokens"("token_hash");
CREATE INDEX IF NOT EXISTS "mobile_refresh_tokens_user_id_expires_at_idx"
  ON "mobile_refresh_tokens"("user_id", "expires_at");

CREATE TABLE IF NOT EXISTS "migration_id_map" (
  "id" TEXT NOT NULL,
  "entity" TEXT NOT NULL,
  "source_id" TEXT NOT NULL,
  "target_id" TEXT NOT NULL,
  "migrated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "migration_id_map_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "migration_id_map_entity_source_id_key" ON "migration_id_map"("entity", "source_id");
CREATE INDEX IF NOT EXISTS "migration_id_map_entity_target_id_idx" ON "migration_id_map"("entity", "target_id");

CREATE TABLE IF NOT EXISTS "migration_errors" (
  "id" TEXT NOT NULL,
  "entity" TEXT NOT NULL,
  "source_id" TEXT,
  "message" TEXT NOT NULL,
  "payload" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "migration_errors_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "migration_errors_entity_created_at_idx" ON "migration_errors"("entity", "created_at");

DO $$ BEGIN
  ALTER TABLE "user_credits" ADD CONSTRAINT "user_credits_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "device_tokens" ADD CONSTRAINT "device_tokens_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "payment_deferrals" ADD CONSTRAINT "payment_deferrals_application_id_fkey"
    FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "payment_deferrals" ADD CONSTRAINT "payment_deferrals_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "mobile_refresh_tokens" ADD CONSTRAINT "mobile_refresh_tokens_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
