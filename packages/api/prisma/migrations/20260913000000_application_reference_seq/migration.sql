-- Human-friendly sequential application reference (surfaced as BLOX-#### in the UI and contracts).
-- Adding a SERIAL column backfills every existing row with an increasing value and drives new inserts.
ALTER TABLE "applications" ADD COLUMN "reference_seq" SERIAL NOT NULL;

-- Ensure uniqueness of the reference.
CREATE UNIQUE INDEX "applications_reference_seq_key" ON "applications"("reference_seq");
