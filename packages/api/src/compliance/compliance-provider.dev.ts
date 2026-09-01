import { Injectable } from '@nestjs/common';
import { ComplianceCheckStatus } from '@prisma/client';
import {
  ComplianceProvider,
  IdentityVerificationResult,
  SanctionsScreeningResult,
} from './compliance-provider.interface';

const SYNTHETIC_NOTE =
  'Synthetic provider — records an ops-triggered pass. Use only until a real KYC/AML vendor is wired.';

/**
 * Synthetic provider — returns pass so runCheck can persist a compliance row.
 * Selected when COMPLIANCE_PROVIDER=synthetic (any environment) or the legacy
 * COMPLIANCE_DEV_PROVIDER flag outside production.
 */
@Injectable()
export class DevRecordedComplianceProvider implements ComplianceProvider {
  readonly name = 'synthetic';

  verifyIdentity(qid: string, applicantName: string): Promise<IdentityVerificationResult> {
    return Promise.resolve({
      status: ComplianceCheckStatus.pass,
      raw: { synthetic: true, qid, applicantName, note: SYNTHETIC_NOTE },
    });
  }

  screenSanctions(applicantName: string): Promise<SanctionsScreeningResult> {
    return Promise.resolve({
      status: ComplianceCheckStatus.pass,
      raw: { synthetic: true, applicantName, note: SYNTHETIC_NOTE },
    });
  }
}
