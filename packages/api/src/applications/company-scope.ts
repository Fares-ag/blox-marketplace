import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { User, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Returns allowed company ids for list filters, or null when unrestricted.
 * Mirrors credit/finance officer scope rules used across ops endpoints.
 */
export async function opsCompanyFilter(
  prisma: PrismaService,
  user: User,
): Promise<string[] | null> {
  if (user.role === UserRole.admin || user.role === UserRole.super_admin) return null;
  if (user.role === UserRole.credit_officer) {
    if (user.creditScope === 'all') return null;
    const assigned = await prisma.creditOfficerCompany.findMany({
      where: { userId: user.id },
      select: { companyId: true },
    });
    return assigned.map((r) => r.companyId);
  }
  if (user.role === UserRole.finance_officer) {
    if (user.financeScope === 'all') return null;
    const assigned = await prisma.financeOfficerCompany.findMany({
      where: { userId: user.id },
      select: { companyId: true },
    });
    return assigned.map((r) => r.companyId);
  }
  return null;
}

/**
 * Ensures credit/finance officers may act on a single company-scoped record.
 * Admin/super_admin always pass; scope "all" officers pass; scope "assigned"
 * officers must appear on the join table for companyId.
 */
export async function assertCompanyScope(
  prisma: PrismaService,
  user: User,
  companyId: string,
): Promise<void> {
  if (user.role === UserRole.admin || user.role === UserRole.super_admin) return;

  if (user.role === UserRole.credit_officer) {
    if (user.creditScope === 'all') return;
    const assigned = await prisma.creditOfficerCompany.findMany({
      where: { userId: user.id },
      select: { companyId: true },
    });
    if (!assigned.some((r) => r.companyId === companyId)) {
      throw new ForbiddenException('out_of_scope');
    }
    return;
  }

  if (user.role === UserRole.finance_officer) {
    if (user.financeScope === 'all') return;
    const assigned = await prisma.financeOfficerCompany.findMany({
      where: { userId: user.id },
      select: { companyId: true },
    });
    if (!assigned.some((r) => r.companyId === companyId)) {
      throw new ForbiddenException('out_of_scope');
    }
    return;
  }

  throw new ForbiddenException('forbidden_role');
}

/** Read path — out-of-scope ids return 404 so company records are not enumerable. */
export async function assertCompanyScopeForRead(
  prisma: PrismaService,
  user: User,
  companyId: string,
): Promise<void> {
  try {
    await assertCompanyScope(prisma, user, companyId);
  } catch (e) {
    if (e instanceof ForbiddenException && e.message === 'out_of_scope') {
      throw new NotFoundException();
    }
    throw e;
  }
}
