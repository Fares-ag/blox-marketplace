-- Walk-in applications may be stored before the customer registers (leadSource = walk_in_pending).
ALTER TABLE "applications" ALTER COLUMN "customerUserId" DROP NOT NULL;
