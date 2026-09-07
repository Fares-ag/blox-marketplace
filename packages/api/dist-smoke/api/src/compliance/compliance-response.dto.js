"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toComplianceCheckDto = toComplianceCheckDto;
function toComplianceCheckDto(check) {
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
//# sourceMappingURL=compliance-response.dto.js.map