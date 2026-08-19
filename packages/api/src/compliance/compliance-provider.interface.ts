import { ComplianceCheckStatus } from '@prisma/client';

export interface IdentityVerificationResult {
  status: ComplianceCheckStatus;
  raw: Record<string, unknown>;
}

export interface SanctionsScreeningResult {
  status: ComplianceCheckStatus;
  raw: Record<string, unknown>;
}

export interface ComplianceProvider {
  readonly name: string;
  verifyIdentity(qid: string, applicantName: string): Promise<IdentityVerificationResult>;
  screenSanctions(applicantName: string): Promise<SanctionsScreeningResult>;
}

export const COMPLIANCE_PROVIDER = Symbol('COMPLIANCE_PROVIDER');
