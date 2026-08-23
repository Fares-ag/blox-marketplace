import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { CallerContext } from '../auth/service-auth.guard';

export interface AuditInput {
  caseId?: string;
  action: string;
  actor?: CallerContext;
  actorType?: string;
  fromValue?: string;
  toValue?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Writes the immutable audit/evidence trail. There is deliberately NO update or
 * delete method — the table is append-only and additionally protected by a DB
 * trigger (see the migration). Every state change and sensitive read goes here.
 */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: AuditInput): Promise<void> {
    await this.prisma.kycAuditEvent.create({
      data: {
        caseId: input.caseId,
        actorType: input.actorType ?? (input.actor?.userId ? 'user' : 'system'),
        actorId: input.actor?.userId,
        action: input.action,
        fromValue: input.fromValue,
        toValue: input.toValue,
        metadata: input.metadata as object | undefined,
      },
    });
  }
}
