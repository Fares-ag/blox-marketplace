import type { ComplianceCheck } from '@prisma/client';
export declare function toComplianceCheckDto(check: ComplianceCheck): {
    id: string;
    application_id: string;
    provider: string;
    identity_status: import(".prisma/client").$Enums.ComplianceCheckStatus;
    sanctions_status: import(".prisma/client").$Enums.ComplianceCheckStatus;
    overall_status: import(".prisma/client").$Enums.ComplianceCheckStatus;
    verified_by_user_id: string | null;
    qid_screened: string;
    applicant_name: string;
    created_at: Date;
};
