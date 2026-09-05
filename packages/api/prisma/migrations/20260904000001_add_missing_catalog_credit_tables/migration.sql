-- Schema drift repair (QA_PRODUCTION_2026-09-04 PROD-02): these models were added to
-- schema.prisma via `db push` without a migration, so `prisma migrate deploy` never
-- created them and the deployed API returned P2021 on promotions / packages /
-- insurance rates / settlement discount settings / credit transactions.
-- Generated with `prisma migrate diff --from-migrations --to-schema-datamodel`.

-- DropIndex
DROP INDEX IF EXISTS "applications_installment_plan_idx";

-- CreateTable
CREATE TABLE "credit_transactions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "amount" DECIMAL(18,3) NOT NULL,
    "balance_after" DECIMAL(18,3) NOT NULL,
    "description" TEXT,
    "actor_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "insurance_rates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "annual_rate" DECIMAL(5,2) NOT NULL,
    "annual_rate_provider" DECIMAL(5,2) NOT NULL,
    "coverage_type" TEXT,
    "min_vehicle_value" DECIMAL(12,2),
    "max_vehicle_value" DECIMAL(12,2),
    "min_tenure" INTEGER,
    "max_tenure" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'active',
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "insurance_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promotions" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "discount_percentage" DECIMAL(5,2),
    "discount_amount" DECIMAL(12,2),
    "start_date" DATE,
    "end_date" DATE,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "promotions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "packages" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "items" JSONB NOT NULL DEFAULT '[]',
    "price" DECIMAL(12,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settlement_discount_settings" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Default Settlement Discount Settings',
    "description" TEXT,
    "principal_discount_enabled" BOOLEAN NOT NULL DEFAULT false,
    "principal_discount_type" TEXT NOT NULL DEFAULT 'percentage',
    "principal_discount_value" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "principal_discount_min_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "interest_discount_enabled" BOOLEAN NOT NULL DEFAULT false,
    "interest_discount_type" TEXT NOT NULL DEFAULT 'percentage',
    "interest_discount_value" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "interest_discount_min_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "min_settlement_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "min_remaining_payments" INTEGER NOT NULL DEFAULT 1,
    "max_discount_amount" DECIMAL(12,2),
    "max_discount_percentage" DECIMAL(5,2),
    "tiered_discounts" JSONB NOT NULL DEFAULT '[]',
    "valid_from" DATE,
    "valid_until" DATE,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "settlement_discount_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "credit_transactions_user_id_created_at_idx" ON "credit_transactions"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "payment_transactions_scheduleId_status_idx" ON "payment_transactions"("scheduleId", "status");

-- AddForeignKey
ALTER TABLE "offers" ADD CONSTRAINT "offers_insuranceRateId_fkey" FOREIGN KEY ("insuranceRateId") REFERENCES "insurance_rates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

