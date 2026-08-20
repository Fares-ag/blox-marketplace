-- Privileged-account hardening: Better Auth 2FA + password lockout fields

ALTER TABLE "users"
  ADD COLUMN "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "lockedUntil" TIMESTAMP(3);

CREATE TABLE "twoFactor" (
  "id" TEXT NOT NULL,
  "secret" TEXT NOT NULL,
  "backupCodes" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "verified" BOOLEAN NOT NULL DEFAULT true,
  "failedVerificationCount" INTEGER NOT NULL DEFAULT 0,
  "lockedUntil" TIMESTAMP(3),

  CONSTRAINT "twoFactor_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "twoFactor_userId_key" ON "twoFactor"("userId");
CREATE INDEX "twoFactor_secret_idx" ON "twoFactor"("secret");

ALTER TABLE "twoFactor"
  ADD CONSTRAINT "twoFactor_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
