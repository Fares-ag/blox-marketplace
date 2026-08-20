DROP INDEX IF EXISTS "applications_installmentPlan_idx";
ALTER TABLE "applications" DROP COLUMN IF EXISTS "installmentPlan";
