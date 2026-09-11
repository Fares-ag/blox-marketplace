import { ApplicationStatus, User, UserRole } from '@prisma/client';
import { ForbiddenException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';
import { assertCompanyScopeForRead } from './company-scope';

/** Statuses that block a customer from starting another application on the same product. */
export const BLOCKING_APPLICATION_STATUSES: ApplicationStatus[] = [
  'draft',
  'under_review',
  'resubmission_required',
  'contract_signing_required',
  'contracts_submitted',
  'contract_under_review',
  'down_payment_required',
  'down_payment_submitted',
  'pending_finance_activation',
  'partner_processing',
  'lpo_issued',
  'acquisition_pending',
  'active',
  'hardship',
  'repossession_in_progress',
  'total_loss',
];

export async function assertApplicationCanView(
  prisma: PrismaService,
  user: User,
  app: { customerUserId: string | null; companyId: string },
): Promise<void> {
  if (user.role === UserRole.customer) {
    if (app.customerUserId === user.id) return;
    throw new ForbiddenException('forbidden_role');
  }
  if (user.role === UserRole.dealer_agent && user.companyId === app.companyId) return;
  const ops: UserRole[] = [
    UserRole.credit_officer,
    UserRole.finance_officer,
    UserRole.admin,
    UserRole.super_admin,
    UserRole.group_admin,
  ];
  if (ops.includes(user.role)) {
    await assertCompanyScopeForRead(prisma, user, app.companyId);
    return;
  }
  throw new ForbiddenException('forbidden_role');
}
