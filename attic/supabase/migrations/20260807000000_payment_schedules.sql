-- Payment schedules for activated financing applications
CREATE TYPE "ScheduleStatus" AS ENUM ('pending', 'paid', 'overdue', 'waived');

CREATE TABLE "payment_schedules" (
  "id" TEXT NOT NULL,
  "applicationId" TEXT NOT NULL,
  "sequence" INTEGER NOT NULL,
  "dueDate" DATE NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "paidAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "remainingAmount" DECIMAL(12,2) NOT NULL,
  "status" "ScheduleStatus" NOT NULL DEFAULT 'pending',
  "paymentMethod" TEXT,
  "paymentReference" TEXT,
  "paidAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "payment_schedules_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "payment_schedules_applicationId_sequence_key" ON "payment_schedules"("applicationId", "sequence");
CREATE INDEX "payment_schedules_applicationId_status_idx" ON "payment_schedules"("applicationId", "status");

ALTER TABLE "payment_schedules" ADD CONSTRAINT "payment_schedules_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
