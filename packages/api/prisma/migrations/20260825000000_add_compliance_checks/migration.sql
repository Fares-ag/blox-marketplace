-- CreateEnum
CREATE TYPE "ComplianceCheckStatus" AS ENUM ('pass', 'fail', 'pending');

-- CreateTable
CREATE TABLE "compliance_checks" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "identityStatus" "ComplianceCheckStatus" NOT NULL DEFAULT 'pending',
    "sanctionsStatus" "ComplianceCheckStatus" NOT NULL DEFAULT 'pending',
    "overallStatus" "ComplianceCheckStatus" NOT NULL DEFAULT 'pending',
    "identityResult" JSONB,
    "sanctionsResult" JSONB,
    "verifiedByUserId" TEXT,
    "qidScreened" TEXT NOT NULL,
    "applicantName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "compliance_checks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "compliance_checks_applicationId_createdAt_idx" ON "compliance_checks"("applicationId", "createdAt");

-- CreateIndex
CREATE INDEX "compliance_checks_applicationId_overallStatus_idx" ON "compliance_checks"("applicationId", "overallStatus");

-- AddForeignKey
ALTER TABLE "compliance_checks" ADD CONSTRAINT "compliance_checks_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_checks" ADD CONSTRAINT "compliance_checks_verifiedByUserId_fkey" FOREIGN KEY ("verifiedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
