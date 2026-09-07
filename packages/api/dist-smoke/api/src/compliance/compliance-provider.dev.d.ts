import { ComplianceProvider, IdentityVerificationResult, SanctionsScreeningResult } from './compliance-provider.interface';
export declare class DevRecordedComplianceProvider implements ComplianceProvider {
    readonly name = "synthetic";
    verifyIdentity(qid: string, applicantName: string): Promise<IdentityVerificationResult>;
    screenSanctions(applicantName: string): Promise<SanctionsScreeningResult>;
}
