import { BadRequestException } from '@nestjs/common';
import { ComplianceCheckStatus } from '@prisma/client';

export function assertCompliancePassed(
  check: { overallStatus: ComplianceCheckStatus } | null | undefined,
): void {
  if (!check || check.overallStatus !== ComplianceCheckStatus.pass) {
    throw new BadRequestException('compliance_check_required');
  }
}

export function deriveOverallComplianceStatus(
  identityStatus: ComplianceCheckStatus,
  sanctionsStatus: ComplianceCheckStatus,
): ComplianceCheckStatus {
  if (identityStatus === ComplianceCheckStatus.fail || sanctionsStatus === ComplianceCheckStatus.fail) {
    return ComplianceCheckStatus.fail;
  }
  if (identityStatus === ComplianceCheckStatus.pass && sanctionsStatus === ComplianceCheckStatus.pass) {
    return ComplianceCheckStatus.pass;
  }
  return ComplianceCheckStatus.pending;
}
