-- Purge QA / business data; preserve auth (users, accounts, sessions, verifications, twoFactor, mobile_refresh_tokens).
BEGIN;

DELETE FROM payment_reminder_sent;
DELETE FROM payment_deferrals;
DELETE FROM payment_events;
DELETE FROM payment_transactions;
DELETE FROM payment_schedules;
DELETE FROM compliance_checks;
DELETE FROM application_documents;
DELETE FROM dealer_quotes;
DELETE FROM applications;
DELETE FROM notifications;
ALTER TABLE activity_logs DISABLE TRIGGER activity_logs_immutable;
DELETE FROM activity_logs;
ALTER TABLE activity_logs ENABLE TRIGGER activity_logs_immutable;
DELETE FROM email_outbox;
DELETE FROM idempotency_records;
DELETE FROM device_tokens;
DELETE FROM user_credits;
DELETE FROM product_images;
DELETE FROM products;
DELETE FROM offers;
DELETE FROM credit_officer_companies;
DELETE FROM finance_officer_companies;
UPDATE users SET "companyId" = NULL WHERE "companyId" IS NOT NULL;
DELETE FROM companies;
DELETE FROM finance_partners;
DELETE FROM migration_id_map;
DELETE FROM migration_errors;

COMMIT;

SELECT
  (SELECT COUNT(*) FROM users) AS users,
  (SELECT COUNT(*) FROM accounts) AS accounts,
  (SELECT COUNT(*) FROM sessions) AS sessions,
  (SELECT COUNT(*) FROM applications) AS applications,
  (SELECT COUNT(*) FROM products) AS products,
  (SELECT COUNT(*) FROM companies) AS companies;
