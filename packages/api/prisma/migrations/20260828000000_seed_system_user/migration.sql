-- Synthetic actor for cron jobs (overdue sweep, payment reminders, sandbox payments).
INSERT INTO "users" (
  "id",
  "name",
  "email",
  "emailVerified",
  "role",
  "isActive",
  "createdAt",
  "updatedAt",
  "creditScope",
  "financeScope",
  "failedLoginAttempts",
  "twoFactorEnabled"
)
VALUES (
  'system',
  'System',
  'system@internal.blox.invalid',
  false,
  'super_admin',
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP,
  'assigned',
  'assigned',
  0,
  false
)
ON CONFLICT ("id") DO UPDATE SET
  "name" = EXCLUDED."name",
  "role" = EXCLUDED."role",
  "isActive" = EXCLUDED."isActive";
