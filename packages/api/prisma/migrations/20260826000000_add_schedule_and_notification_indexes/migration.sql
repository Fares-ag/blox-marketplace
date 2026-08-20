-- CreateIndex
CREATE INDEX "payment_schedules_status_dueDate_idx" ON "payment_schedules"("status", "dueDate");

-- Partial index for unread notifications (not expressible in Prisma 6 schema yet)
CREATE INDEX "notifications_user_id_unread_idx" ON "notifications"("userId") WHERE "readAt" IS NULL;
