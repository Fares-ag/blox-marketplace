-- Allow multiple concurrent applications per customer (different vehicles),
-- while enforcing one blocking application per customer per product.
DROP INDEX IF EXISTS "applications_one_blocking_per_customer_key";

CREATE UNIQUE INDEX "applications_one_blocking_per_customer_product_key"
ON "applications" ("customerUserId", "productId")
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
  'partner_processing',
  'active'
);
