import { ComplianceCheckStatus } from '@prisma/client';
export declare function assertCompliancePassed(check: {
    overallStatus: ComplianceCheckStatus;
} | null | undefined): void;
export declare function deriveOverallComplianceStatus(identityStatus: ComplianceCheckStatus, sanctionsStatus: ComplianceCheckStatus): ComplianceCheckStatus;
