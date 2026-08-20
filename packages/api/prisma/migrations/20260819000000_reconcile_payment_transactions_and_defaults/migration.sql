-- Reconcile migrations with schema.prisma:
-- - payment_transactions table + PaymentTransactionStatus enum (missing from 0_init)
-- - applications.status default 'draft' (0_init incorrectly used 'under_review')

-- CreateEnum
CREATE TYPE "PaymentTransactionStatus" AS ENUM ('pending', 'completed', 'failed');

-- AlterTable
ALTER TABLE "applications" ALTER COLUMN "status" SET DEFAULT 'draft';

-- CreateTable
CREATE TABLE "payment_transactions" (
    "id" TEXT NOT NULL,
    "gateway" TEXT NOT NULL DEFAULT 'skipcash',
    "gatewayPaymentId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "amount" DECIMAL(12, 2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'QAR',
    "status" "PaymentTransactionStatus" NOT NULL DEFAULT 'pending',
    "applicationId" TEXT NOT NULL,
    "scheduleId" TEXT,
    "rawPayloadRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payment_transactions_idempotencyKey_key" ON "payment_transactions"("idempotencyKey");

-- CreateIndex
CREATE INDEX "payment_transactions_applicationId_status_idx" ON "payment_transactions"("applicationId", "status");

-- AddForeignKey
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "payment_schedules"("id") ON DELETE SET NULL ON UPDATE CASCADE;
