-- Financial integrity CHECK constraints, partial unique indexes, and append-only audit guard.

-- payment_schedules: positive amounts with paid + remaining = total
ALTER TABLE "payment_schedules"
  ADD CONSTRAINT "payment_schedules_amount_positive_chk" CHECK (amount > 0);

ALTER TABLE "payment_schedules"
  ADD CONSTRAINT "payment_schedules_paid_amount_non_negative_chk" CHECK ("paidAmount" >= 0);

ALTER TABLE "payment_schedules"
  ADD CONSTRAINT "payment_schedules_remaining_amount_non_negative_chk" CHECK ("remainingAmount" >= 0);

ALTER TABLE "payment_schedules"
  ADD CONSTRAINT "payment_schedules_paid_remaining_sum_chk" CHECK ("paidAmount" + "remainingAmount" = amount);

-- payment_transactions: positive payment amounts
ALTER TABLE "payment_transactions"
  ADD CONSTRAINT "payment_transactions_amount_positive_chk" CHECK (amount > 0);

-- products: list price must be positive
ALTER TABLE "products"
  ADD CONSTRAINT "products_price_positive_chk" CHECK (price > 0);

-- dealer_quotes: negotiated price within list price bounds
ALTER TABLE "dealer_quotes"
  ADD CONSTRAINT "dealer_quotes_negotiated_price_bounds_chk"
  CHECK ("negotiatedPrice" > 0 AND "negotiatedPrice" <= "listPriceSnapshot");

-- Partial unique indexes (nullable identifiers)
CREATE UNIQUE INDEX "products_vin_unique_idx" ON "products"("vin") WHERE "vin" IS NOT NULL;

CREATE UNIQUE INDEX "products_chassis_number_unique_idx" ON "products"("chassisNumber") WHERE "chassisNumber" IS NOT NULL;

CREATE UNIQUE INDEX "users_qid_unique_idx" ON "users"("qid") WHERE "qid" IS NOT NULL;

-- activity_logs: append-only audit trail
CREATE OR REPLACE FUNCTION prevent_activity_log_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'activity_logs are append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER activity_logs_immutable
BEFORE UPDATE OR DELETE ON "activity_logs"
FOR EACH ROW
EXECUTE FUNCTION prevent_activity_log_mutation();
