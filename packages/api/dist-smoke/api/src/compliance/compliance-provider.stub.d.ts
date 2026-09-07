import { ComplianceProvider, IdentityVerificationResult, SanctionsScreeningResult } from './compliance-provider.interface';
export declare class StubComplianceProvider implements ComplianceProvider {
    readonly name = "stub";
    verifyIdentity(_qid: string, _applicantName: string): Promise<IdentityVerificationResult>;
    screenSanctions(_applicantName: string): Promise<SanctionsScreeningResult>;
}
