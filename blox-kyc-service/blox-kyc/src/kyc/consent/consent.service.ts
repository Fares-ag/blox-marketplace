import { Injectable } from '@nestjs/common';
import { ConsentPurpose } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import type { CallerContext } from '../../common/auth/service-auth.guard';

@Injectable()
export class ConsentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async grant(
    caseId: string,
    purpose: ConsentPurpose,
    granted: boolean,
    textVersion: string,
    textShown: string,
    actor: CallerContext,
  ): Promise<void> {
    await this.prisma.consentRecord.upsert({
      where: { caseId_purpose: { caseId, purpose } },
      update: { granted, textVersion, textShown },
      create: { caseId, purpose, granted, textVersion, textShown },
    });
    await this.audit.record({
      caseId,
      action: 'consent.recorded',
      actor,
      toValue: `${purpose}:${granted}`,
      metadata: { textVersion },
    });
  }

  async hasConsent(caseId: string, purpose: ConsentPurpose): Promise<boolean> {
    const c = await this.prisma.consentRecord.findUnique({
      where: { caseId_purpose: { caseId, purpose } },
    });
    return Boolean(c?.granted);
  }
}
