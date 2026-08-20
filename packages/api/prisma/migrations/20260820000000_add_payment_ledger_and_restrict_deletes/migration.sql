-- Append-only payment ledger + protect repayment history from application cascade deletes.
-- ApplicationDocument intentionally remains ON DELETE CASCADE (KYC files, not financial ledger).

-- CreateEnum
CREATE TYPE "PaymentEventType" AS ENUM ('down_payment', 'installment', 'waive', 'adjustment', 'reversal');

-- DropForeignKey
ALTER TABLE "payment_schedules" DROP CONSTRAINT "payment_schedules_applicationId_fkey";

-- CreateTable
CREATE TABLE "payment_events" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "scheduleId" TEXT,
    "transactionId" TEXT,
    "type" "PaymentEventType" NOT NULL,
    "amount" DECIMAL(12, 2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'QAR',
    "actorUserId" TEXT,
    "reason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "payment_events_applicationId_createdAt_idx" ON "payment_events"("applicationId", "createdAt");

-- CreateIndex
CREATE INDEX "payment_events_scheduleId_createdAt_idx" ON "payment_events"("scheduleId", "createdAt");

-- AddForeignKey
ALTER TABLE "payment_schedules" ADD CONSTRAINT "payment_schedules_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_events" ADD CONSTRAINT "payment_events_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_events" ADD CONSTRAINT "payment_events_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "payment_schedules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_events" ADD CONSTRAINT "payment_events_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "payment_transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_events" ADD CONSTRAINT "payment_events_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
