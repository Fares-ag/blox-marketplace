-- Musharakah flow alignment: new statuses, documents, ledgers, LPO, unit offers,
-- collections, repossession, total loss. Additive; flags keep production behaviour.

ALTER TYPE "ApplicationStatus" ADD VALUE IF NOT EXISTS 'lpo_issued';
ALTER TYPE "ApplicationStatus" ADD VALUE IF NOT EXISTS 'acquisition_pending';
ALTER TYPE "ApplicationStatus" ADD VALUE IF NOT EXISTS 'hardship';
ALTER TYPE "ApplicationStatus" ADD VALUE IF NOT EXISTS 'repossession_in_progress';
ALTER TYPE "ApplicationStatus" ADD VALUE IF NOT EXISTS 'total_loss';

ALTER TYPE "DocumentCategory" ADD VALUE IF NOT EXISTS 'delivery_note';
ALTER TYPE "DocumentCategory" ADD VALUE IF NOT EXISTS 'registration_card';
ALTER TYPE "DocumentCategory" ADD VALUE IF NOT EXISTS 'vin_evidence';
ALTER TYPE "DocumentCategory" ADD VALUE IF NOT EXISTS 'lpo';
ALTER TYPE "DocumentCategory" ADD VALUE IF NOT EXISTS 'mandate_proof';
ALTER TYPE "DocumentCategory" ADD VALUE IF NOT EXISTS 'maturity_certificate';

ALTER TYPE "PaymentEventType" ADD VALUE IF NOT EXISTS 'unit_purchase';
ALTER TYPE "PaymentEventType" ADD VALUE IF NOT EXISTS 'settlement';
ALTER TYPE "PaymentEventType" ADD VALUE IF NOT EXISTS 'total_loss_proceeds';
ALTER TYPE "PaymentEventType" ADD VALUE IF NOT EXISTS 'repossession_proceeds';

CREATE TYPE "MandateStatus" AS ENUM ('pending', 'registered', 'failed', 'cancelled');
CREATE TYPE "DefaultClassification" AS ENUM ('performing', 'watch', 'npl');
CREATE TYPE "OwnershipRegisterEventType" AS ENUM (
  'open', 'initial_contribution', 'unit_purchase', 'settlement',
  'repossession_sale', 'total_loss', 'adjustment'
);
CREATE TYPE "RentPoolEntryType" AS ENUM ('accrual', 'collected', 'forgiven');
CREATE TYPE "UnitOfferStatus" AS ENUM ('pending', 'offered', 'accepted', 'paid', 'expired', 'cancelled');
CREATE TYPE "LpoStatus" AS ENUM ('issued', 'settled', 'cancelled');
CREATE TYPE "CollectionsCaseStatus" AS ENUM ('open', 'hardship', 'resolved', 'escalated', 'closed');
CREATE TYPE "HardshipPlanStatus" AS ENUM ('proposed', 'approved', 'active', 'completed', 'failed', 'rejected');
CREATE TYPE "RepossessionStatus" AS ENUM ('initiated', 'recovered', 'sold', 'closed', 'cancelled');
CREATE TYPE "TotalLossClaimStatus" AS ENUM ('filed', 'approved', 'allocated', 'closed', 'rejected');

ALTER TABLE "companies"
  ADD COLUMN IF NOT EXISTS "unit_offers_enabled" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "applications"
  ADD COLUMN IF NOT EXISTS "last_kyc_webhook_event_id" TEXT,
  ADD COLUMN IF NOT EXISTS "last_kyc_webhook_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "repayment_mandate_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "repayment_mandate_ref" TEXT,
  ADD COLUMN IF NOT EXISTS "repayment_mandate_status" "MandateStatus",
  ADD COLUMN IF NOT EXISTS "pre_disbursal_completed_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "default_classification" "DefaultClassification",
  ADD COLUMN IF NOT EXISTS "unit_offer_disclosure_ack_at" TIMESTAMP(3);

CREATE TABLE "ownership_registers" (
  "id" TEXT NOT NULL,
  "application_id" TEXT NOT NULL,
  "total_units" INTEGER NOT NULL DEFAULT 100,
  "customer_units" INTEGER NOT NULL DEFAULT 0,
  "blox_units" INTEGER NOT NULL DEFAULT 100,
  "vehicle_price" DECIMAL(12,2) NOT NULL,
  "unit_nominal_value" DECIMAL(12,2) NOT NULL,
  "opened_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "matured_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ownership_registers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ownership_registers_application_id_key" ON "ownership_registers"("application_id");

ALTER TABLE "ownership_registers"
  ADD CONSTRAINT "ownership_registers_application_id_fkey"
  FOREIGN KEY ("application_id") REFERENCES "applications"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ownership_register_entries" (
  "id" TEXT NOT NULL,
  "register_id" TEXT NOT NULL,
  "event_type" "OwnershipRegisterEventType" NOT NULL,
  "units_delta" INTEGER NOT NULL,
  "customer_units_after" INTEGER NOT NULL,
  "blox_units_after" INTEGER NOT NULL,
  "payment_event_id" TEXT,
  "actor_user_id" TEXT,
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ownership_register_entries_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ownership_register_entries_register_id_created_at_idx"
  ON "ownership_register_entries"("register_id", "created_at");

ALTER TABLE "ownership_register_entries"
  ADD CONSTRAINT "ownership_register_entries_register_id_fkey"
  FOREIGN KEY ("register_id") REFERENCES "ownership_registers"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION prevent_ownership_register_entry_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'ownership_register_entries are append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ownership_register_entries_immutable
BEFORE UPDATE OR DELETE ON "ownership_register_entries"
FOR EACH ROW
EXECUTE FUNCTION prevent_ownership_register_entry_mutation();

CREATE TABLE "rent_pool_ledger_entries" (
  "id" TEXT NOT NULL,
  "application_id" TEXT NOT NULL,
  "type" "RentPoolEntryType" NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "period" INTEGER,
  "payment_event_id" TEXT,
  "actor_user_id" TEXT,
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "rent_pool_ledger_entries_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "rent_pool_ledger_entries_application_id_created_at_idx"
  ON "rent_pool_ledger_entries"("application_id", "created_at");

ALTER TABLE "rent_pool_ledger_entries"
  ADD CONSTRAINT "rent_pool_ledger_entries_application_id_fkey"
  FOREIGN KEY ("application_id") REFERENCES "applications"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "unit_offers" (
  "id" TEXT NOT NULL,
  "application_id" TEXT NOT NULL,
  "period" INTEGER NOT NULL,
  "units_offered" INTEGER NOT NULL,
  "unit_price" DECIMAL(12,2) NOT NULL,
  "rent_amount" DECIMAL(12,2) NOT NULL,
  "total_amount" DECIMAL(12,2) NOT NULL,
  "status" "UnitOfferStatus" NOT NULL DEFAULT 'pending',
  "offered_at" TIMESTAMP(3),
  "accepted_at" TIMESTAMP(3),
  "paid_at" TIMESTAMP(3),
  "expires_at" TIMESTAMP(3),
  "disclosure_ack_at" TIMESTAMP(3),
  "schedule_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "unit_offers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "unit_offers_application_id_period_key" ON "unit_offers"("application_id", "period");
CREATE INDEX "unit_offers_status_offered_at_idx" ON "unit_offers"("status", "offered_at");

ALTER TABLE "unit_offers"
  ADD CONSTRAINT "unit_offers_application_id_fkey"
  FOREIGN KEY ("application_id") REFERENCES "applications"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "lpo_records" (
  "id" TEXT NOT NULL,
  "application_id" TEXT NOT NULL,
  "dealer_company_id" TEXT NOT NULL,
  "status" "LpoStatus" NOT NULL DEFAULT 'issued',
  "amount" DECIMAL(12,2) NOT NULL,
  "reference" TEXT,
  "issued_by_user_id" TEXT NOT NULL,
  "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "settled_at" TIMESTAMP(3),
  "settled_by_user_id" TEXT,
  "settlement_ref" TEXT,
  "cancelled_at" TIMESTAMP(3),
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "lpo_records_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "lpo_records_application_id_status_idx" ON "lpo_records"("application_id", "status");
CREATE INDEX "lpo_records_dealer_company_id_status_idx" ON "lpo_records"("dealer_company_id", "status");

ALTER TABLE "lpo_records"
  ADD CONSTRAINT "lpo_records_application_id_fkey"
  FOREIGN KEY ("application_id") REFERENCES "applications"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "collections_cases" (
  "id" TEXT NOT NULL,
  "application_id" TEXT NOT NULL,
  "status" "CollectionsCaseStatus" NOT NULL DEFAULT 'open',
  "reason" TEXT,
  "opened_by_user_id" TEXT,
  "opened_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "closed_at" TIMESTAMP(3),
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "collections_cases_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "collections_cases_application_id_status_idx" ON "collections_cases"("application_id", "status");
CREATE INDEX "collections_cases_status_opened_at_idx" ON "collections_cases"("status", "opened_at");

ALTER TABLE "collections_cases"
  ADD CONSTRAINT "collections_cases_application_id_fkey"
  FOREIGN KEY ("application_id") REFERENCES "applications"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "hardship_plans" (
  "id" TEXT NOT NULL,
  "application_id" TEXT NOT NULL,
  "collections_case_id" TEXT,
  "status" "HardshipPlanStatus" NOT NULL DEFAULT 'proposed',
  "proposed_by_user_id" TEXT NOT NULL,
  "approved_by_user_id" TEXT,
  "installments_deferred" INTEGER NOT NULL DEFAULT 0,
  "override_defer_quota" BOOLEAN NOT NULL DEFAULT false,
  "notes" TEXT,
  "proposed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "decided_at" TIMESTAMP(3),
  "completed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "hardship_plans_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "hardship_plans_application_id_status_idx" ON "hardship_plans"("application_id", "status");

ALTER TABLE "hardship_plans"
  ADD CONSTRAINT "hardship_plans_application_id_fkey"
  FOREIGN KEY ("application_id") REFERENCES "applications"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "hardship_plans"
  ADD CONSTRAINT "hardship_plans_collections_case_id_fkey"
  FOREIGN KEY ("collections_case_id") REFERENCES "collections_cases"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "repossession_cases" (
  "id" TEXT NOT NULL,
  "application_id" TEXT NOT NULL,
  "status" "RepossessionStatus" NOT NULL DEFAULT 'initiated',
  "initiated_by_user_id" TEXT NOT NULL,
  "recovered_at" TIMESTAMP(3),
  "sold_at" TIMESTAMP(3),
  "sale_proceeds" DECIMAL(12,2),
  "customer_share" DECIMAL(12,2),
  "blox_share" DECIMAL(12,2),
  "closed_at" TIMESTAMP(3),
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "repossession_cases_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "repossession_cases_application_id_status_idx" ON "repossession_cases"("application_id", "status");

ALTER TABLE "repossession_cases"
  ADD CONSTRAINT "repossession_cases_application_id_fkey"
  FOREIGN KEY ("application_id") REFERENCES "applications"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "total_loss_claims" (
  "id" TEXT NOT NULL,
  "application_id" TEXT NOT NULL,
  "takaful_policy_id" TEXT,
  "status" "TotalLossClaimStatus" NOT NULL DEFAULT 'filed',
  "proceeds" DECIMAL(12,2),
  "customer_share" DECIMAL(12,2),
  "blox_share" DECIMAL(12,2),
  "filed_by_user_id" TEXT NOT NULL,
  "filed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "allocated_at" TIMESTAMP(3),
  "closed_at" TIMESTAMP(3),
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "total_loss_claims_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "total_loss_claims_application_id_status_idx" ON "total_loss_claims"("application_id", "status");

ALTER TABLE "total_loss_claims"
  ADD CONSTRAINT "total_loss_claims_application_id_fkey"
  FOREIGN KEY ("application_id") REFERENCES "applications"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "total_loss_claims"
  ADD CONSTRAINT "total_loss_claims_takaful_policy_id_fkey"
  FOREIGN KEY ("takaful_policy_id") REFERENCES "takaful_policies"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
