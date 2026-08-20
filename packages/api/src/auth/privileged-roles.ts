import { UserRole } from '@prisma/client';

/** Ops roles that must use TOTP and are subject to password lockout. */
export const MFA_REQUIRED_ROLES: UserRole[] = [
  UserRole.admin,
  UserRole.super_admin,
  UserRole.credit_officer,
  UserRole.finance_officer,
];

export function isMfaRequiredRole(role: UserRole): boolean {
  return MFA_REQUIRED_ROLES.includes(role);
}
