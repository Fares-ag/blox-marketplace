import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { User, UserRole } from '@prisma/client';

/** Roles only a super administrator may grant or manage. */
export const SUPER_ADMIN_ONLY_ROLES: UserRole[] = [UserRole.super_admin];

/** Roles a group administrator may create or assign within their company tree. */
export const GROUP_MANAGEABLE_ROLES: UserRole[] = [
  UserRole.customer,
  UserRole.dealer_agent,
  UserRole.credit_officer,
  UserRole.finance_officer,
];

/** Platform and group administrators — restricted on PATCH unless actor is super_admin. */
export const PRIVILEGED_STAFF_ROLES: UserRole[] = [
  UserRole.admin,
  UserRole.super_admin,
  UserRole.group_admin,
];

export function isSuperAdminOnlyRole(role: UserRole): boolean {
  return SUPER_ADMIN_ONLY_ROLES.includes(role);
}

export function assertCanProvisionRole(actor: User, targetRole: UserRole): void {
  if (isSuperAdminOnlyRole(targetRole) && actor.role !== UserRole.super_admin) {
    throw new ForbiddenException('super_admin_required');
  }
  if (actor.role === UserRole.group_admin && !GROUP_MANAGEABLE_ROLES.includes(targetRole)) {
    throw new ForbiddenException('forbidden_role');
  }
}

export function assertCanManageUserRole(actor: User, targetRole: UserRole, nextRole?: UserRole): void {
  const touchesSuperAdmin =
    isSuperAdminOnlyRole(targetRole) || (nextRole !== undefined && isSuperAdminOnlyRole(nextRole));
  if (touchesSuperAdmin && actor.role !== UserRole.super_admin) {
    throw new ForbiddenException('super_admin_required');
  }
  if (actor.role === UserRole.group_admin && nextRole && !GROUP_MANAGEABLE_ROLES.includes(nextRole)) {
    throw new ForbiddenException('forbidden_role');
  }
}

/**
 * A home branch must belong to the company the user is (being) assigned to.
 * `branch` is null when the id did not resolve.
 */
export function assertHomeBranchInCompany(
  branch: { id: string; companyId: string } | null,
  companyId: string | null | undefined,
): void {
  if (!companyId) throw new BadRequestException('branch_requires_company');
  if (!branch || branch.companyId !== companyId) {
    throw new BadRequestException('branch_not_in_company');
  }
}
