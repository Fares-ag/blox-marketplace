import { Injectable } from '@nestjs/common';
import { ComplianceCheckStatus } from '@prisma/client';
import {
  ComplianceProvider,
  IdentityVerificationResult,
  SanctionsScreeningResult,
} from './compliance-provider.interface';

const DEV_NOTE =
  'Non-production dev provider — records a synthetic pass for local testing only.';

/**
 * Dev/test-only provider — returns pass so runCheck can persist a compliance row.
 * Never selected in production (see compliance-provider.resolve.ts).
 */
@Injectable()
export class DevRecordedComplianceProvider implements ComplianceProvider {
  readonly name = 'dev-recorded';

  verifyIdentity(qid: string, applicantName: string): Promise<IdentityVerificationResult> {
    return Promise.resolve({
      status: ComplianceCheckStatus.pass,
      raw: { dev: true, qid, applicantName, note: DEV_NOTE },
    });
  }

  screenSanctions(applicantName: string): Promise<SanctionsScreeningResult> {
    return Promise.resolve({
      status: ComplianceCheckStatus.pass,
      raw: { dev: true, applicantName, note: DEV_NOTE },
    });
  }
}
