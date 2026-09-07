-- CreateEnum
CREATE TYPE "GuarantorSessionStatus" AS ENUM ('pending', 'otp_verified', 'consents_done', 'completed', 'expired', 'cancelled');

-- CreateEnum
CREATE TYPE "DataRightsRequestKind" AS ENUM ('access', 'correction', 'deletion', 'consent_withdrawal');

-- CreateEnum
CREATE TYPE "DataRightsRequestStatus" AS ENUM ('open', 'in_progress', 'completed', 'rejected');

-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'partner_viewer';

-- AlterEnum
ALTER TYPE "PaymentEventType" ADD VALUE 'blox_credits';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "finance_partner_id" TEXT,
ADD COLUMN     "qid_enc" TEXT;

-- AlterTable
ALTER TABLE "applications" ADD COLUMN     "approval_authority" TEXT,
ADD COLUMN     "credit_assessment" JSONB;

-- AlterTable
ALTER TABLE "consent_records" ADD COLUMN     "withdrawal_reason" TEXT,
ADD COLUMN     "withdrawn_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "application_settlements" ADD COLUMN     "accrued_profit" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "quote_as_of" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "guarantor_consent_sessions" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "application_id" TEXT NOT NULL,
    "created_by_user_id" TEXT,
    "full_name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "qid_hash" TEXT,
    "relationship" TEXT,
    "status" "GuarantorSessionStatus" NOT NULL DEFAULT 'pending',
    "otp_code_hash" TEXT,
    "otp_expires_at" TIMESTAMP(3),
    "otp_attempts" INTEGER NOT NULL DEFAULT 0,
    "otp_locked_until" TIMESTAMP(3),
    "otp_resend_count" INTEGER NOT NULL DEFAULT 0,
    "otp_resend_window_start" TIMESTAMP(3),
    "otp_verified_at" TIMESTAMP(3),
    "proof_hash" TEXT,
    "acceptances" JSONB,
    "consents_completed_at" TIMESTAMP(3),
    "ip_address" TEXT,
    "user_agent" TEXT,
    "kyc_case_id" TEXT,
    "kyc_invite_url" TEXT,
    "kyc_status" TEXT,
    "completed_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3) NOT NULL,
    "last_opened_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guarantor_consent_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "takaful_providers" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "name_ar" TEXT,
    "comprehensive_rate_pct" DECIMAL(6,3) NOT NULL,
    "third_party_annual" DECIMAL(12,2),
    "min_contribution" DECIMAL(12,2),
    "riders" JSONB,
    "contact_phone" TEXT,
    "contact_email" TEXT,
    "website" TEXT,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "takaful_providers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_rights_requests" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "kind" "DataRightsRequestKind" NOT NULL,
    "status" "DataRightsRequestStatus" NOT NULL DEFAULT 'open',
    "details" TEXT,
    "consent_code" "ConsentCode",
    "resolution_note" TEXT,
    "handled_by_id" TEXT,
    "handled_at" TIMESTAMP(3),
    "due_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "data_rights_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "guarantor_consent_sessions_token_key" ON "guarantor_consent_sessions"("token");

-- CreateIndex
CREATE INDEX "guarantor_consent_sessions_application_id_status_idx" ON "guarantor_consent_sessions"("application_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "takaful_providers_code_key" ON "takaful_providers"("code");

-- CreateIndex
CREATE INDEX "data_rights_requests_status_created_at_idx" ON "data_rights_requests"("status", "created_at");

-- CreateIndex
CREATE INDEX "data_rights_requests_user_id_idx" ON "data_rights_requests"("user_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_finance_partner_id_fkey" FOREIGN KEY ("finance_partner_id") REFERENCES "finance_partners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guarantor_consent_sessions" ADD CONSTRAINT "guarantor_consent_sessions_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guarantor_consent_sessions" ADD CONSTRAINT "guarantor_consent_sessions_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_rights_requests" ADD CONSTRAINT "data_rights_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_rights_requests" ADD CONSTRAINT "data_rights_requests_handled_by_id_fkey" FOREIGN KEY ("handled_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

