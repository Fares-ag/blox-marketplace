ALTER TABLE "applications" ADD COLUMN IF NOT EXISTS "installment_plan" JSONB;
CREATE INDEX IF NOT EXISTS "applications_installment_plan_idx" ON "applications" USING GIN ("installment_plan");
