-- Multi-document contract signing: offer financing type + generated contract documents.

CREATE TYPE "FinancingType" AS ENUM ('diminishing_musharakah', 'ijarah');
CREATE TYPE "ContractDocumentType" AS ENUM (
  'ijarah_agreement',
  'musharakah_agreement',
  'ownership_rental_schedule',
  'credit_appraisal_memorandum'
);
CREATE TYPE "ContractDocumentAudience" AS ENUM ('customer', 'ops');
CREATE TYPE "ContractDocumentStatus" AS ENUM ('pending', 'generated', 'signed_submitted', 'verified');

ALTER TABLE "offers"
  ADD COLUMN IF NOT EXISTS "financingType" "FinancingType" NOT NULL DEFAULT 'diminishing_musharakah';

CREATE TABLE IF NOT EXISTS "contract_documents" (
  "id" TEXT NOT NULL,
  "applicationId" TEXT NOT NULL,
  "documentType" "ContractDocumentType" NOT NULL,
  "audience" "ContractDocumentAudience" NOT NULL,
  "label" TEXT NOT NULL,
  "generatedPath" TEXT,
  "contentSha256" TEXT,
  "signedPath" TEXT,
  "status" "ContractDocumentStatus" NOT NULL DEFAULT 'pending',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "contract_documents_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "contract_documents_applicationId_audience_status_idx"
  ON "contract_documents"("applicationId", "audience", "status");

ALTER TABLE "contract_documents"
  ADD CONSTRAINT "contract_documents_applicationId_fkey"
  FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
