import type { UserRole } from '../types/domain';

export const MFA_REQUIRED_ROLES: UserRole[] = [
  'admin',
  'super_admin',
  'credit_officer',
  'finance_officer',
];

export function isMfaRequiredRole(role: UserRole | undefined): boolean {
  if (!role) return false;
  return MFA_REQUIRED_ROLES.includes(role);
}
