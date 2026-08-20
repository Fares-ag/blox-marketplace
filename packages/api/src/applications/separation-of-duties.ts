import { ForbiddenException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { Prisma } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';

export type ActivityLogEntry = {
  actorUserId: string | null;
  action: string;
  fromValue?: string | null;
  toValue?: string | null;
  metadata?: unknown;
  createdAt?: Date;
};

type PrismaLike = Pick<PrismaService, 'activityLog'> | Prisma.TransactionClient;

/** Global SEPARATION_OF_DUTIES env (default true); optional per-company override. */
export function separationOfDutiesEnabled(opts?: {
  envValue?: string | null;
  companyFlag?: boolean | null;
}): boolean {
  const raw = opts?.envValue ?? process.env.SEPARATION_OF_DUTIES;
  const globalEnabled = raw !== 'false' && raw !== '0';
  if (!globalEnabled) return false;
  if (opts?.companyFlag === false) return false;
  return true;
}

export function resolveSeparationOfDutiesEnabled(
  config: ConfigService,
  companyFlag?: boolean | null,
): boolean {
  return separationOfDutiesEnabled({
    envValue: config.get<string>('SEPARATION_OF_DUTIES'),
    companyFlag,
  });
}

/** Credit approval = contract path, finance-ready, or direct activate from under_review. */
export function isCreditApprovalLog(entry: ActivityLogEntry): boolean {
  if (entry.action !== 'status_transition') return false;
  if (entry.toValue === 'contract_signing_required') return true;
  if (entry.toValue === 'pending_finance_activation') return true;
  if (
    entry.toValue === 'active' &&
    entry.fromValue === 'under_review' &&
    isDirectActivateMetadata(entry.metadata)
  ) {
    return true;
  }
  return false;
}

function isDirectActivateMetadata(metadata: unknown): boolean {
  if (!metadata || typeof metadata !== 'object') return false;
  return (metadata as Record<string, unknown>).direct === true;
}

/** Most recent credit-approval actor on the application (chronological logs). */
export function findCreditApproverId(logs: ActivityLogEntry[]): string | null {
  for (let i = logs.length - 1; i >= 0; i--) {
    const log = logs[i];
    if (isCreditApprovalLog(log) && log.actorUserId) {
      return log.actorUserId;
    }
  }
  return null;
}

export function violatesSeparationOfDuties(
  actorUserId: string,
  creditApproverId: string | null,
): boolean {
  if (!creditApproverId) return false;
  return actorUserId === creditApproverId;
}

export function assertActorNotCreditApprover(
  actorUserId: string,
  creditApproverId: string | null,
): void {
  if (violatesSeparationOfDuties(actorUserId, creditApproverId)) {
    throw new ForbiddenException('separation_of_duties');
  }
}

export function assertDualControlWaive(
  confirmActorUserId: string,
  requestedByUserId: string | null,
): void {
  if (!requestedByUserId) {
    throw new ForbiddenException('waive_not_requested');
  }
  if (confirmActorUserId === requestedByUserId) {
    throw new ForbiddenException('dual_control_required');
  }
}

export async function resolveCreditApproverId(
  prisma: PrismaLike,
  applicationId: string,
): Promise<string | null> {
  const logs = await prisma.activityLog.findMany({
    where: {
      entityType: 'application',
      entityId: applicationId,
      action: 'status_transition',
    },
    orderBy: { createdAt: 'asc' },
    select: {
      actorUserId: true,
      action: true,
      fromValue: true,
      toValue: true,
      metadata: true,
      createdAt: true,
    },
  });
  return findCreditApproverId(logs);
}

export async function assertSeparationOfDutiesForApplication(
  prisma: PrismaLike,
  actorUserId: string,
  applicationId: string,
  enabled: boolean,
): Promise<void> {
  if (!enabled) return;
  const creditApproverId = await resolveCreditApproverId(prisma, applicationId);
  assertActorNotCreditApprover(actorUserId, creditApproverId);
}
