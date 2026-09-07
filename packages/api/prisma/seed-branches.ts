import { CompanyKind, UserRole, type PrismaClient } from '@prisma/client';

export const SEED_BRANCH_CODE = 'MAIN';

/** Dealerships created by the other seeds (Chery + the QAuto group). */
export const SEEDED_DEALERSHIP_CODES = [
  'chery-elite-motors',
  'qauto-audi',
  'qauto-vw',
  'qauto-skoda',
] as const;

/** Pure: the branch every seeded dealership starts with. */
export function seedBranchFor(company: { name: string }) {
  return { code: SEED_BRANCH_CODE, name: `${company.name} Main Branch`, city: 'Doha' };
}

/**
 * Idempotent, production-safe: one MAIN branch per seeded dealership and a
 * home branch for every dealer agent of that company who has none yet. Never
 * moves an agent that already has a home branch.
 */
export async function seedBranches(
  prisma: PrismaClient,
  companyCodes: readonly string[] = SEEDED_DEALERSHIP_CODES,
) {
  const companies = await prisma.company.findMany({
    where: { code: { in: [...companyCodes] }, kind: CompanyKind.dealership },
    orderBy: { name: 'asc' },
  });

  let agentsAssigned = 0;
  const branches: Array<{ companyCode: string | null; branchId: string; code: string }> = [];
  for (const company of companies) {
    const spec = seedBranchFor(company);
    const branch = await prisma.branch.upsert({
      where: { companyId_code: { companyId: company.id, code: spec.code } },
      create: { companyId: company.id, ...spec },
      update: { active: true },
    });
    const assigned = await prisma.user.updateMany({
      where: { companyId: company.id, role: UserRole.dealer_agent, homeBranchId: null },
      data: { homeBranchId: branch.id },
    });
    agentsAssigned += assigned.count;
    branches.push({ companyCode: company.code, branchId: branch.id, code: branch.code });
  }

  return {
    branches: branches.length,
    agentsAssigned,
    companies: branches.map((b) => b.companyCode),
  };
}
