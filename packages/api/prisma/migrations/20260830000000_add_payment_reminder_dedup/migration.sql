-- Atomic dedup for payment reminder cron (one row per schedule/kind/day).
CREATE TABLE "payment_reminder_sent" (
    "id" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "reminderDate" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_reminder_sent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "payment_reminder_sent_scheduleId_kind_reminderDate_key"
    ON "payment_reminder_sent"("scheduleId", "kind", "reminderDate");

ALTER TABLE "payment_reminder_sent"
    ADD CONSTRAINT "payment_reminder_sent_scheduleId_fkey"
    FOREIGN KEY ("scheduleId") REFERENCES "payment_schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE;
