-- Qatar Credit Bureau month-end artefacts. The financing book stays on applications.

CREATE TYPE "BureauSubmissionStatus" AS ENUM ('generated', 'sent', 'failed');

CREATE TABLE "bureau_submissions" (
  "id"               TEXT NOT NULL,
  "period"           TEXT NOT NULL,
  "as_of"            TIMESTAMP(3) NOT NULL,
  "map_version"      TEXT NOT NULL,
  "unsigned"         BOOLEAN NOT NULL DEFAULT true,
  "status"           "BureauSubmissionStatus" NOT NULL,
  "transport"        TEXT NOT NULL,
  "filename"         TEXT,
  "checksum"         TEXT,
  "record_count"     INTEGER NOT NULL DEFAULT 0,
  "excluded_count"   INTEGER NOT NULL DEFAULT 0,
  "outstanding_sum"  DECIMAL(14,2) NOT NULL DEFAULT 0,
  "file_body"        TEXT,
  "error"            TEXT,
  "actor_user_id"    TEXT,
  "triggered_by"     TEXT NOT NULL DEFAULT 'cron',
  "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"       TIMESTAMP(3) NOT NULL,

  CONSTRAINT "bureau_submissions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "bureau_submissions_period_created_at_idx"
  ON "bureau_submissions" ("period", "created_at");
CREATE INDEX "bureau_submissions_status_created_at_idx"
  ON "bureau_submissions" ("status", "created_at");

CREATE TABLE "bureau_submission_rows" (
  "id"                 TEXT NOT NULL,
  "submission_id"      TEXT NOT NULL,
  "application_id"     TEXT NOT NULL,
  "reference_seq"      INTEGER NOT NULL,
  "included"           BOOLEAN NOT NULL,
  "exclude_reason"     TEXT,
  "outstanding_source" TEXT,
  "outstanding"        DECIMAL(12,2),
  "status_code"        TEXT,
  "ibra_amount"        DECIMAL(12,2),
  "created_at"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "bureau_submission_rows_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "bureau_submission_rows_submission_id_included_idx"
  ON "bureau_submission_rows" ("submission_id", "included");
CREATE INDEX "bureau_submission_rows_application_id_idx"
  ON "bureau_submission_rows" ("application_id");

ALTER TABLE "bureau_submission_rows"
  ADD CONSTRAINT "bureau_submission_rows_submission_id_fkey"
  FOREIGN KEY ("submission_id") REFERENCES "bureau_submissions"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "bureau_submission_rows"
  ADD CONSTRAINT "bureau_submission_rows_application_id_fkey"
  FOREIGN KEY ("application_id") REFERENCES "applications"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- 0_init created this column in camelCase; later fields use snake_case maps.
CREATE INDEX "applications_activatedAt_status_idx"
  ON "applications" ("activatedAt", "status");
