-- AlterTable
ALTER TABLE "companies" ADD COLUMN "separationOfDutiesEnabled" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "payment_schedules" ADD COLUMN "pendingWaiveReason" TEXT;
ALTER TABLE "payment_schedules" ADD COLUMN "pendingWaiveRequestedById" TEXT;
ALTER TABLE "payment_schedules" ADD COLUMN "pendingWaiveRequestedAt" TIMESTAMP(3);
