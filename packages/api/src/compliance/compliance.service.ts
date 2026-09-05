import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ComplianceCheckStatus, Prisma, User, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityService } from '../common/activity.service';
import { assertCompanyScope } from '../applications/company-scope';
import {
  COMPLIANCE_PROVIDER,
  ComplianceProvider,
} from './compliance-provider.interface';
import { toComplianceCheckDto } from './compliance-response.dto';
import { assertCompliancePassed, deriveOverallComplianceStatus } from './compliance-gate';

// Finance shares review decisions with credit (blox-vercel parity), so it may run the check that gates them.
const OPS_ROLES: UserRole[] = [
  UserRole.credit_officer,
  UserRole.finance_officer,
  UserRole.admin,
  UserRole.super_admin,
];

function asJson(value: Record<string, unknown>): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

@Injectable()
export class ComplianceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityService,
    @Inject(COMPLIANCE_PROVIDER) private readonly provider: ComplianceProvider,
  ) {}

  private assertOps(user: User) {
    if (!OPS_ROLES.includes(user.role)) {
      throw new ForbiddenException('forbidden_role');
    }
  }

  async findLatestPassingCheck(applicationId: string) {
    return this.prisma.complianceCheck.findFirst({
      where: { applicationId, overallStatus: ComplianceCheckStatus.pass },
      orderBy: { createdAt: 'desc' },
    });
  }

  async assertPassedForApproval(applicationId: string) {
    const check = await this.findLatestPassingCheck(applicationId);
    assertCompliancePassed(check);
  }

  async runCheck(user: User, applicationId: string) {
    this.assertOps(user);

    const app = await this.prisma.application.findUnique({
      where: { id: applicationId },
      select: {
        id: true,
        companyId: true,
        customerSnapshot: true,
      },
    });
    if (!app) throw new NotFoundException();
    await assertCompanyScope(this.prisma, user, app.companyId);

    const snap = app.customerSnapshot as Record<string, unknown>;
    const qid = String(snap.qid ?? '').trim();
    const applicantName = String(snap.full_name ?? '').trim();

    const identity = await this.provider.verifyIdentity(qid, applicantName);
    const sanctions = await this.provider.screenSanctions(applicantName);
    const overallStatus = deriveOverallComplianceStatus(identity.status, sanctions.status);

    const check = await this.prisma.complianceCheck.create({
      data: {
        applicationId,
        provider: this.provider.name,
        identityStatus: identity.status,
        sanctionsStatus: sanctions.status,
        overallStatus,
        identityResult: identity.raw ? asJson(identity.raw) : undefined,
        sanctionsResult: sanctions.raw ? asJson(sanctions.raw) : undefined,
        verifiedByUserId: user.id,
        qidScreened: qid,
        applicantName,
      },
    });

    await this.activity.log({
      actorUserId: user.id,
      entityType: 'application',
      entityId: applicationId,
      action: 'compliance_check',
      toValue: overallStatus,
      metadata: {
        provider: this.provider.name,
        identityStatus: identity.status,
        sanctionsStatus: sanctions.status,
      },
    });

    return toComplianceCheckDto(check);
  }
}
