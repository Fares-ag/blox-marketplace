-- CreateEnum
CREATE TYPE "KycCaseStatus" AS ENUM ('created', 'capturing', 'checks_running', 'needs_review', 'step_up_required', 'reviewing', 'approved', 'rejected', 'expired');

-- CreateEnum
CREATE TYPE "KycDecision" AS ENUM ('approved', 'rejected');

-- CreateEnum
CREATE TYPE "KycCheckType" AS ENUM ('qid', 'passport', 'doc_authenticity', 'identity_binding', 'bank_statement', 'aml_screen', 'bureau');

-- CreateEnum
CREATE TYPE "KycCheckStatus" AS ENUM ('pending', 'passed', 'failed', 'manual_review', 'error');

-- CreateEnum
CREATE TYPE "ConsentPurpose" AS ENUM ('identity', 'bureau_pull', 'bank_data');

-- CreateEnum
CREATE TYPE "IdentityDocType" AS ENUM ('qid', 'passport');

-- CreateEnum
CREATE TYPE "IdentityBindingMethod" AS ENUM ('agent_attestation', 'video_review');

-- CreateTable
CREATE TABLE "kyc_cases" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "customerUserId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "status" "KycCaseStatus" NOT NULL DEFAULT 'created',
    "decision" "KycDecision",
    "decisionReason" TEXT,
    "reviewerUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kyc_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kyc_checks" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "type" "KycCheckType" NOT NULL,
    "status" "KycCheckStatus" NOT NULL DEFAULT 'pending',
    "score" DOUBLE PRECISION,
    "provider" TEXT NOT NULL,
    "providerVersion" TEXT NOT NULL,
    "reason" TEXT,
    "evidence" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kyc_checks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "identity_documents" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "docType" "IdentityDocType" NOT NULL,
    "storageRef" TEXT NOT NULL,
    "extractedEncrypted" TEXT,
    "nfcVerified" BOOLEAN NOT NULL DEFAULT false,
    "authenticityScore" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "identity_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "identity_bindings" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "method" "IdentityBindingMethod" NOT NULL,
    "attesterUserId" TEXT NOT NULL,
    "evidenceRef" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "identity_bindings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consent_records" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "purpose" "ConsentPurpose" NOT NULL,
    "granted" BOOLEAN NOT NULL,
    "textVersion" TEXT NOT NULL,
    "textShown" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consent_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "screening_results" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "status" "KycCheckStatus" NOT NULL,
    "hitsJson" JSONB,
    "listVersion" TEXT,
    "disposition" TEXT,
    "reviewerUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "screening_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_statements" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'upload',
    "bankCode" TEXT,
    "storageRef" TEXT,
    "tamperStatus" "KycCheckStatus" NOT NULL DEFAULT 'pending',
    "periodStart" DATE,
    "periodEnd" DATE,
    "affordabilityJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bank_statements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "statement_transactions" (
    "id" TEXT NOT NULL,
    "statementId" TEXT NOT NULL,
    "postedAt" DATE NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "direction" TEXT NOT NULL,
    "category" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "statement_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kyc_audit_events" (
    "id" TEXT NOT NULL,
    "caseId" TEXT,
    "actorType" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "fromValue" TEXT,
    "toValue" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kyc_audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "kyc_cases_applicationId_key" ON "kyc_cases"("applicationId");

-- CreateIndex
CREATE INDEX "kyc_cases_status_createdAt_idx" ON "kyc_cases"("status", "createdAt");

-- CreateIndex
CREATE INDEX "kyc_cases_companyId_status_idx" ON "kyc_cases"("companyId", "status");

-- CreateIndex
CREATE INDEX "kyc_checks_caseId_type_createdAt_idx" ON "kyc_checks"("caseId", "type", "createdAt");

-- CreateIndex
CREATE INDEX "identity_documents_caseId_docType_idx" ON "identity_documents"("caseId", "docType");

-- CreateIndex
CREATE INDEX "identity_bindings_caseId_idx" ON "identity_bindings"("caseId");

-- CreateIndex
CREATE UNIQUE INDEX "consent_records_caseId_purpose_key" ON "consent_records"("caseId", "purpose");

-- CreateIndex
CREATE INDEX "screening_results_caseId_idx" ON "screening_results"("caseId");

-- CreateIndex
CREATE INDEX "bank_statements_caseId_idx" ON "bank_statements"("caseId");

-- CreateIndex
CREATE INDEX "statement_transactions_statementId_postedAt_idx" ON "statement_transactions"("statementId", "postedAt");

-- CreateIndex
CREATE INDEX "kyc_audit_events_caseId_createdAt_idx" ON "kyc_audit_events"("caseId", "createdAt");

-- AddForeignKey
ALTER TABLE "kyc_checks" ADD CONSTRAINT "kyc_checks_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "kyc_cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "identity_documents" ADD CONSTRAINT "identity_documents_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "kyc_cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "identity_bindings" ADD CONSTRAINT "identity_bindings_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "kyc_cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "kyc_cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "screening_results" ADD CONSTRAINT "screening_results_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "kyc_cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_statements" ADD CONSTRAINT "bank_statements_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "kyc_cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "statement_transactions" ADD CONSTRAINT "statement_transactions_statementId_fkey" FOREIGN KEY ("statementId") REFERENCES "bank_statements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kyc_audit_events" ADD CONSTRAINT "kyc_audit_events_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "kyc_cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
