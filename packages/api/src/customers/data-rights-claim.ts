import { DataRightsRequestKind, type ConsentCode, type DataRightsRequest } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PENDING_DATA_RIGHTS_STATUSES } from './data-rights-logic';

/**
 * One open request per customer, kind, and consent. Repeated withdraw clicks
 * used to pass the read-then-insert check together and spam the privacy queue.
 * The advisory lock serialises that check for the same key.
 */
export async function claimPendingDataRightsRequest(
  prisma: PrismaService,
  input: {
    userId: string;
    kind: DataRightsRequestKind;
    consentCode?: ConsentCode | null;
    details?: string | null;
    dueAt: Date;
  },
): Promise<{ row: DataRightsRequest; created: boolean }> {
  const consentCode = input.consentCode ?? null;
  const lockKey = `${input.userId}:${input.kind}:${consentCode ?? ''}`;
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`;
    const pending = await tx.dataRightsRequest.findFirst({
      where: {
        userId: input.userId,
        kind: input.kind,
        ...(consentCode ? { consentCode } : {}),
        status: { in: PENDING_DATA_RIGHTS_STATUSES },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (pending) return { row: pending, created: false };
    const row = await tx.dataRightsRequest.create({
      data: {
        userId: input.userId,
        kind: input.kind,
        consentCode,
        details: input.details ?? null,
        dueAt: input.dueAt,
      },
    });
    return { row, created: true };
  });
}
