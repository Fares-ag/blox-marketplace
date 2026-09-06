import { type AdminUser } from '@drivemarket/shared';

export type UserRow = AdminUser;
export const ASSIGNABLE_ROLES = [
  'customer',
  'dealer_agent',
  'credit_officer',
  'finance_officer',
  'admin',
  'group_admin',
  'super_admin',
] as const;

export function companyRequiredForRole(role: string) {
  return role === 'dealer_agent' || role === 'group_admin';
}

export function showsCreditFields(role: string) {
  return role === 'credit_officer';
}

export function showsFinanceFields(role: string) {
  return role === 'finance_officer';
}

export function filterCompaniesForRole(
  companies: Array<{ id: string; name: string; kind?: string }>,
  role: string,
) {
  return companies.filter((c) => {
    const kind = c.kind;
    if (role === 'group_admin') return kind === 'holding';
    if (role === 'dealer_agent') return kind !== 'holding';
    return true;
  });
}
