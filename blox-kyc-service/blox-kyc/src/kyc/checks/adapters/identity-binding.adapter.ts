import { Injectable } from '@nestjs/common';
import { KycCheckType } from '@prisma/client';
import type { CheckContext, CheckResult } from '../check.types';
import type { KycCheckPort } from '../check.types';
import { PrismaService } from '../../../prisma/prisma.service';

/**
 * Compensating control that replaces the (removed) face check: passes only when
 * an IdentityBinding (agent/video attestation) has been recorded for the case.
 * This is a real check, not a stub — it reads recorded evidence.
 */
@Injectable()
export class IdentityBindingCheckAdapter implements KycCheckPort {
  readonly type: KycCheckType = 'identity_binding';

  constructor(private readonly prisma: PrismaService) {}

  async run(ctx: CheckContext): Promise<CheckResult> {
    const binding = await this.prisma.identityBinding.findFirst({
      where: { caseId: ctx.caseId },
      orderBy: { createdAt: 'desc' },
    });
    if (!binding) {
      return {
        status: 'failed',
        provider: 'identity_binding',
        providerVersion: '1.0.0',
        reason: 'no_binding_recorded',
      };
    }
    return {
      status: 'passed',
      provider: 'identity_binding',
      providerVersion: '1.0.0',
      reason: `bound_via_${binding.method}`,
      evidence: { method: binding.method, attesterUserId: binding.attesterUserId },
    };
  }
}
