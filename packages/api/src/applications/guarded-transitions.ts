import { ConflictException } from '@nestjs/common';
import { ApplicationStatus, Prisma } from '@prisma/client';

export type GuardConflictCode = 'stale_transition' | 'vehicle_unavailable' | 'quote_unavailable';

export function assertRowsUpdated(count: number, code: GuardConflictCode = 'stale_transition'): void {
  if (count === 0) {
    throw new ConflictException(code);
  }
}

/** Guarded application status transition — throws stale_transition when status already advanced. */
export async function transitionApplication(
  tx: Prisma.TransactionClient,
  id: string,
  fromStatus: ApplicationStatus,
  data: Prisma.ApplicationUpdateManyMutationInput,
): Promise<void> {
  const result = await tx.application.updateMany({
    where: { id, status: fromStatus },
    data,
  });
  assertRowsUpdated(result.count, 'stale_transition');
}
