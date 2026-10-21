-- Finance approval before Bureau transport (SFTP / local ACK).
ALTER TABLE "bureau_submissions"
  ADD COLUMN "approved_at" TIMESTAMP(3),
  ADD COLUMN "approved_by_user_id" TEXT,
  ADD COLUMN "send_acknowledgement" TEXT;
