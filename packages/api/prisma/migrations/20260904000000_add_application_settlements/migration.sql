-- Early-settlement requests (blox-vercel `application_settlements` parity).
-- Customer requests; finance/admin approve or reject.
CREATE TYPE "SettlementStatus" AS ENUM ('pending', 'approved', 'rejected', 'cancelled');

CREATE TABLE "application_settlements" (
  "id"                  TEXT NOT NULL,
  "application_id"      TEXT NOT NULL,
  "customer_user_id"    TEXT NOT NULL,
  "customer_email"      TEXT NOT NULL,
  "status"              "SettlementStatus" NOT NULL DEFAULT 'pending',
  "settlement_amount"   DECIMAL(12,2) NOT NULL,
  "remaining_principal" DECIMAL(12,2) NOT NULL,
  "discount_amount"     DECIMAL(12,2) NOT NULL DEFAULT 0,
  "forgiven_rent"       DECIMAL(12,2) NOT NULL DEFAULT 0,
  "requested_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "decided_at"          TIMESTAMP(3),
  "decided_by_user_id"  TEXT,
  "decision_reason"     TEXT,
  "created_at"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"          TIMESTAMP(3) NOT NULL,

  CONSTRAINT "application_settlements_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "application_settlements_status_requested_at_idx"
  ON "application_settlements" ("status", "requested_at");
CREATE INDEX "application_settlements_application_id_idx"
  ON "application_settlements" ("application_id");

ALTER TABLE "application_settlements"
  ADD CONSTRAINT "application_settlements_application_id_fkey"
  FOREIGN KEY ("application_id") REFERENCES "applications"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
