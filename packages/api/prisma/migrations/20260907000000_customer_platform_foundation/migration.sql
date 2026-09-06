-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('male', 'female', 'prefer_not_to_say');

-- CreateEnum
CREATE TYPE "ConsentCode" AS ENUM ('credit_bureau', 'terms', 'kyc_biometric', 'aml');

-- CreateEnum
CREATE TYPE "ConsentChannel" AS ENUM ('web', 'mobile', 'assisted');

-- CreateEnum
CREATE TYPE "CustomerDocumentCategory" AS ENUM ('qid_front', 'qid_back', 'passport', 'driving_licence', 'residence_proof', 'salary_certificate', 'bank_statement', 'other');

-- CreateEnum
CREATE TYPE "TakafulStatus" AS ENUM ('declared', 'pending_verification', 'active', 'expired', 'closed');

-- CreateEnum
CREATE TYPE "AssistedSessionStatus" AS ENUM ('pending', 'otp_verified', 'consents_done', 'identity_started', 'completed', 'expired', 'cancelled');

-- CreateEnum
CREATE TYPE "FinancePartnerEngagementMode" AS ENUM ('full_los_underwriting', 'credit_file_handoff');

-- CreateEnum
CREATE TYPE "BreOwnership" AS ENUM ('blox_bre_only', 'blox_plus_partner_bre');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "DocumentCategory" ADD VALUE 'credit_bureau';
ALTER TYPE "DocumentCategory" ADD VALUE 'residence_proof';
ALTER TYPE "DocumentCategory" ADD VALUE 'employment_contract';
ALTER TYPE "DocumentCategory" ADD VALUE 'trade_license';
ALTER TYPE "DocumentCategory" ADD VALUE 'audited_financials';
ALTER TYPE "DocumentCategory" ADD VALUE 'tax_card';
ALTER TYPE "DocumentCategory" ADD VALUE 'business_bank';
ALTER TYPE "DocumentCategory" ADD VALUE 'guarantor_qid';
ALTER TYPE "DocumentCategory" ADD VALUE 'guarantor_salary';
ALTER TYPE "DocumentCategory" ADD VALUE 'guarantor_bank';
ALTER TYPE "DocumentCategory" ADD VALUE 'vehicle_quotation';
ALTER TYPE "DocumentCategory" ADD VALUE 'takaful_policy';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "address" JSONB,
ADD COLUMN     "date_of_birth" DATE,
ADD COLUMN     "first_name" TEXT,
ADD COLUMN     "gender" "Gender",
ADD COLUMN     "home_branch_id" TEXT,
ADD COLUMN     "last_name" TEXT,
ADD COLUMN     "nationality" TEXT,
ADD COLUMN     "notification_preferences" JSONB,
ADD COLUMN     "preferred_language" TEXT NOT NULL DEFAULT 'en',
ADD COLUMN     "qid_hash" TEXT;

-- AlterTable
ALTER TABLE "finance_partners" ADD COLUMN     "bre_ownership" "BreOwnership" NOT NULL DEFAULT 'blox_bre_only',
ADD COLUMN     "contact_email" TEXT,
ADD COLUMN     "contact_name" TEXT,
ADD COLUMN     "contact_phone" TEXT,
ADD COLUMN     "engagement_mode" "FinancePartnerEngagementMode" NOT NULL DEFAULT 'full_los_underwriting',
ADD COLUMN     "is_default_lender" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "notes" TEXT;

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "engine_number" TEXT;

-- AlterTable
ALTER TABLE "applications" ADD COLUMN     "branch_id" TEXT,
ADD COLUMN     "consents_completed_at" TIMESTAMP(3),
ADD COLUMN     "finance_partner_branch_id" TEXT,
ADD COLUMN     "identity_hold_at" TIMESTAMP(3),
ADD COLUMN     "identity_hold_cleared_at" TIMESTAMP(3),
ADD COLUMN     "identity_hold_cleared_by_id" TEXT,
ADD COLUMN     "identity_hold_reason" TEXT,
ADD COLUMN     "qid_hash" TEXT;

-- CreateTable
CREATE TABLE "branches" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT,
    "address" TEXT,
    "phone" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "branches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance_partner_branches" (
    "id" TEXT NOT NULL,
    "partner_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "finance_partner_branches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consent_records" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "application_id" TEXT,
    "code" "ConsentCode" NOT NULL,
    "version" TEXT NOT NULL,
    "text_hash" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "channel" "ConsentChannel" NOT NULL DEFAULT 'web',
    "accepted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "session_id" TEXT,
    "device_info" JSONB,
    "actor_user_id" TEXT,

    CONSTRAINT "consent_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_documents" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "category" "CustomerDocumentCategory" NOT NULL,
    "storage_path" TEXT NOT NULL,
    "mime_type" TEXT,
    "original_name" TEXT,
    "size_bytes" INTEGER,
    "document_number_enc" TEXT,
    "issued_at" DATE,
    "expires_at" DATE,
    "verified_at" TIMESTAMP(3),
    "verified_by_id" TEXT,
    "last_reminder_kind" TEXT,
    "last_reminder_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "takaful_policies" (
    "id" TEXT NOT NULL,
    "application_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "policy_number" TEXT,
    "coverage_type" TEXT,
    "coverage_amount" DECIMAL(12,2),
    "premium_amount" DECIMAL(12,2),
    "issued_at" DATE,
    "effective_from" DATE,
    "expires_at" DATE,
    "riders" JSONB,
    "status" "TakafulStatus" NOT NULL DEFAULT 'declared',
    "declaration_accepted_at" TIMESTAMP(3),
    "declaration_version" TEXT,
    "document_path" TEXT,
    "document_mime" TEXT,
    "verified_at" TIMESTAMP(3),
    "verified_by_id" TEXT,
    "closed_at" TIMESTAMP(3),
    "last_reminder_kind" TEXT,
    "last_reminder_at" TIMESTAMP(3),
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "takaful_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assisted_sessions" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "application_id" TEXT NOT NULL,
    "customer_user_id" TEXT NOT NULL,
    "created_by_user_id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "status" "AssistedSessionStatus" NOT NULL DEFAULT 'pending',
    "otp_code_hash" TEXT,
    "otp_expires_at" TIMESTAMP(3),
    "otp_attempts" INTEGER NOT NULL DEFAULT 0,
    "otp_locked_until" TIMESTAMP(3),
    "otp_resend_count" INTEGER NOT NULL DEFAULT 0,
    "otp_resend_window_start" TIMESTAMP(3),
    "otp_verified_at" TIMESTAMP(3),
    "proof_hash" TEXT,
    "consents_completed_at" TIMESTAMP(3),
    "identity_started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3) NOT NULL,
    "last_opened_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assisted_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "branches_company_id_active_idx" ON "branches"("company_id", "active");

-- CreateIndex
CREATE UNIQUE INDEX "branches_company_id_code_key" ON "branches"("company_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "finance_partner_branches_partner_id_code_key" ON "finance_partner_branches"("partner_id", "code");

-- CreateIndex
CREATE INDEX "consent_records_user_id_code_accepted_at_idx" ON "consent_records"("user_id", "code", "accepted_at");

-- CreateIndex
CREATE INDEX "consent_records_application_id_code_idx" ON "consent_records"("application_id", "code");

-- CreateIndex
CREATE INDEX "customer_documents_user_id_category_idx" ON "customer_documents"("user_id", "category");

-- CreateIndex
CREATE INDEX "customer_documents_expires_at_idx" ON "customer_documents"("expires_at");

-- CreateIndex
CREATE INDEX "takaful_policies_application_id_status_idx" ON "takaful_policies"("application_id", "status");

-- CreateIndex
CREATE INDEX "takaful_policies_expires_at_idx" ON "takaful_policies"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "assisted_sessions_token_key" ON "assisted_sessions"("token");

-- CreateIndex
CREATE INDEX "assisted_sessions_application_id_status_idx" ON "assisted_sessions"("application_id", "status");

-- CreateIndex
CREATE INDEX "users_qid_hash_idx" ON "users"("qid_hash");

-- CreateIndex
CREATE INDEX "applications_qid_hash_idx" ON "applications"("qid_hash");

-- CreateIndex
CREATE INDEX "applications_branch_id_idx" ON "applications"("branch_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_home_branch_id_fkey" FOREIGN KEY ("home_branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branches" ADD CONSTRAINT "branches_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_partner_branches" ADD CONSTRAINT "finance_partner_branches_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "finance_partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_finance_partner_branch_id_fkey" FOREIGN KEY ("finance_partner_branch_id") REFERENCES "finance_partner_branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_documents" ADD CONSTRAINT "customer_documents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "takaful_policies" ADD CONSTRAINT "takaful_policies_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "takaful_policies" ADD CONSTRAINT "takaful_policies_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assisted_sessions" ADD CONSTRAINT "assisted_sessions_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assisted_sessions" ADD CONSTRAINT "assisted_sessions_customer_user_id_fkey" FOREIGN KEY ("customer_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assisted_sessions" ADD CONSTRAINT "assisted_sessions_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

