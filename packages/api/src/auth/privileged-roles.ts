import { UserRole } from '@prisma/client';

/** Ops roles that must use TOTP. */
export const MFA_REQUIRED_ROLES: UserRole[] = [
  UserRole.admin,
  UserRole.super_admin,
  UserRole.credit_officer,
  UserRole.finance_officer,
  UserRole.group_admin,
];

/** Staff roles subject to password sign-in lockout after repeated failures. */
export const LOCKOUT_REQUIRED_ROLES: UserRole[] = [...MFA_REQUIRED_ROLES, UserRole.dealer_agent];

export function isMfaRequiredRole(role: UserRole): boolean {
  return MFA_REQUIRED_ROLES.includes(role);
}

export function isLockoutRequiredRole(role: UserRole): boolean {
  return LOCKOUT_REQUIRED_ROLES.includes(role);
}
