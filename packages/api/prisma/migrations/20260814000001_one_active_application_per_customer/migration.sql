-- P1-3: enforce "one blocking application per customer" at the database level.
-- The application-level check in ApplicationsService.create()/createWalkIn() is racy
-- under READ COMMITTED (two concurrent applies for different products both pass the
-- findFirst check). This partial unique index makes the invariant transactional.
--
-- NOTE: if existing data violates the invariant (a customer with two blocking
-- applications), this migration fails. Resolve duplicates first, e.g.:
--   SELECT "customerUserId", count(*) FROM "applications"
--   WHERE "status" IN ('draft','under_review','resubmission_required',
--     'contract_signing_required','contracts_submitted','contract_under_review',
--     'down_payment_required','down_payment_submitted','pending_finance_activation','active')
--   GROUP BY 1 HAVING count(*) > 1;

CREATE UNIQUE INDEX "applications_one_blocking_per_customer_key"
ON "applications" ("customerUserId")
WHERE "status" IN (
  'draft',
  'under_review',
  'resubmission_required',
  'contract_signing_required',
  'contracts_submitted',
  'contract_under_review',
  'down_payment_required',
  'down_payment_submitted',
  'pending_finance_activation',
  'active'
);
