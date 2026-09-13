-- Purge all financing applications; keep users, dealers, and vehicle inventory.
BEGIN;

DELETE FROM payment_reminder_sent;
DELETE FROM payment_events;
DELETE FROM payment_transactions;
DELETE FROM payment_schedules;
DELETE FROM application_settlements;
DELETE FROM payment_deferrals;
DELETE FROM hardship_plans;
DELETE FROM collections_cases;
DELETE FROM repossession_cases;
DELETE FROM total_loss_claims;

ALTER TABLE ownership_register_entries DISABLE TRIGGER ownership_register_entries_immutable;
DELETE FROM ownership_register_entries;
DELETE FROM ownership_registers;
ALTER TABLE ownership_register_entries ENABLE TRIGGER ownership_register_entries_immutable;

DELETE FROM rent_pool_ledger_entries;
DELETE FROM unit_offers;
DELETE FROM lpo_records;
DELETE FROM takaful_policies;
DELETE FROM guarantor_consent_sessions;
DELETE FROM assisted_sessions;
DELETE FROM compliance_checks;
DELETE FROM application_documents;
DELETE FROM contract_documents;
DELETE FROM dealer_quotes;
DELETE FROM applications;

UPDATE consent_records SET application_id = NULL WHERE application_id IS NOT NULL;

ALTER TABLE activity_logs DISABLE TRIGGER activity_logs_immutable;
DELETE FROM activity_logs WHERE "entityType" = 'application';
ALTER TABLE activity_logs ENABLE TRIGGER activity_logs_immutable;

DELETE FROM notifications WHERE "linkPath" LIKE '%/app/applications/%';

UPDATE products SET "listingStatus" = 'published', "updatedAt" = NOW() WHERE "listingStatus" = 'reserved';

SELECT setval(pg_get_serial_sequence('applications', 'reference_seq'), 1, false);

COMMIT;

SELECT
  (SELECT COUNT(*) FROM applications) AS applications,
  (SELECT COUNT(*) FROM payment_schedules) AS payment_schedules,
  (SELECT COUNT(*) FROM dealer_quotes) AS dealer_quotes,
  (SELECT COUNT(*) FROM products) AS products,
  (SELECT COUNT(*) FROM companies) AS companies,
  (SELECT COUNT(*) FROM users) AS users;
