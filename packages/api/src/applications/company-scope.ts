import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { User, UserRole } from '@prisma/client';
import { expandCompanyIds, resolveDescendantCompanyIds } from '../companies/company-hierarchy';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Returns allowed company ids for list filters, or null when unrestricted.
 * Holdings in officer assignments expand to child dealerships.
 */
export async function opsCompanyFilter(
  prisma: PrismaService,
  user: User,
): Promise<string[] | null> {
  if (user.role === UserRole.admin || user.role === UserRole.super_admin) return null;
  if (user.role === UserRole.group_admin) {
    if (!user.companyId) return [];
    return resolveDescendantCompanyIds(prisma, user.companyId);
  }
  if (user.role === UserRole.credit_officer) {
    if (user.creditScope === 'all') return null;
    const assigned = await prisma.creditOfficerCompany.findMany({
      where: { userId: user.id },
      select: { companyId: true },
    });
    return expandCompanyIds(
      prisma,
      assigned.map((r) => r.companyId),
    );
  }
  if (user.role === UserRole.finance_officer) {
    if (user.financeScope === 'all') return null;
    const assigned = await prisma.financeOfficerCompany.findMany({
      where: { userId: user.id },
      select: { companyId: true },
    });
    return expandCompanyIds(
      prisma,
      assigned.map((r) => r.companyId),
    );
  }
  return null;
}

/**
 * Ensures credit/finance/group officers may act on a single company-scoped record.
 */
export async function assertCompanyScope(
  prisma: PrismaService,
  user: User,
  companyId: string,
): Promise<void> {
  if (user.role === UserRole.admin || user.role === UserRole.super_admin) return;

  if (user.role === UserRole.group_admin) {
    if (!user.companyId) throw new ForbiddenException('out_of_scope');
    const allowed = await resolveDescendantCompanyIds(prisma, user.companyId);
    if (!allowed.includes(companyId)) throw new ForbiddenException('out_of_scope');
    return;
  }

  if (user.role === UserRole.credit_officer) {
    if (user.creditScope === 'all') return;
    const assigned = await prisma.creditOfficerCompany.findMany({
      where: { userId: user.id },
      select: { companyId: true },
    });
    const allowed = await expandCompanyIds(
      prisma,
      assigned.map((r) => r.companyId),
    );
    if (!allowed.includes(companyId)) {
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
    const allowed = await expandCompanyIds(
      prisma,
      assigned.map((r) => r.companyId),
    );
    if (!allowed.includes(companyId)) {
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
