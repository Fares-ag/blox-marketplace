import type { Branch, Prisma } from '@prisma/client';

/** Only active staff count towards a branch's headcount. */
export const BRANCH_INCLUDE = {
  _count: { select: { staff: { where: { isActive: true } } } },
} satisfies Prisma.BranchInclude;

export type BranchRow = Branch & { _count?: { staff?: number } };

/** Mirrors `BranchDto` in `@drivemarket/shared/types/customer-platform`. */
export function toBranchDto(branch: BranchRow) {
  return {
    id: branch.id,
    company_id: branch.companyId,
    code: branch.code,
    name: branch.name,
    city: branch.city,
    address: branch.address,
    phone: branch.phone,
    active: branch.active,
    staff_count: branch._count?.staff ?? 0,
    created_at: branch.createdAt.toISOString(),
  };
}

/** Compact reference embedded in user DTOs (`home_branch`). */
export function toBranchRefDto(branch: Pick<Branch, 'id' | 'code' | 'name'> | null | undefined) {
  if (!branch) return null;
  return { id: branch.id, code: branch.code, name: branch.name };
}
