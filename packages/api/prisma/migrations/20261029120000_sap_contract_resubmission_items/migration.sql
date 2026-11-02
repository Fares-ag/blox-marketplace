-- Dealer SAP number, credit contract series/number, and structured resubmission items.
ALTER TABLE "applications" ADD COLUMN IF NOT EXISTS "sap_number" TEXT;
ALTER TABLE "applications" ADD COLUMN IF NOT EXISTS "contract_series" TEXT;
ALTER TABLE "applications" ADD COLUMN IF NOT EXISTS "contract_number" TEXT;
ALTER TABLE "applications" ADD COLUMN IF NOT EXISTS "resubmission_items" JSONB;
