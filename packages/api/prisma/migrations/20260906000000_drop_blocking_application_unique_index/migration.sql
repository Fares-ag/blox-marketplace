-- Allow multiple concurrent in-flight applications per customer (same or different vehicles).
DROP INDEX IF EXISTS "applications_one_blocking_per_customer_product_key";
