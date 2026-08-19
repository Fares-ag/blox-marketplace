import { Injectable, NotImplementedException } from '@nestjs/common';
import {
  ComplianceProvider,
  IdentityVerificationResult,
  SanctionsScreeningResult,
} from './compliance-provider.interface';

/**
 * Injectable placeholder — wire a real KYC/AML vendor here.
 * Intentionally throws until HTTP integration is implemented (never fakes a pass).
 */
@Injectable()
export class StubComplianceProvider implements ComplianceProvider {
  readonly name = 'stub';

  verifyIdentity(_qid: string, _applicantName: string): Promise<IdentityVerificationResult> {
    throw new NotImplementedException('compliance_identity_verification_not_implemented');
  }

  screenSanctions(_applicantName: string): Promise<SanctionsScreeningResult> {
    throw new NotImplementedException('compliance_sanctions_screening_not_implemented');
  }
}
