import type { ComplianceCheck } from '@prisma/client';

export function toComplianceCheckDto(check: ComplianceCheck) {
  return {
    id: check.id,
    application_id: check.applicationId,
    provider: check.provider,
    identity_status: check.identityStatus,
    sanctions_status: check.sanctionsStatus,
    overall_status: check.overallStatus,
    verified_by_user_id: check.verifiedByUserId,
    qid_screened: check.qidScreened,
    applicant_name: check.applicantName,
    created_at: check.createdAt,
  };
}
