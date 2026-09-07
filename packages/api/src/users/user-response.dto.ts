import type { User } from '@prisma/client';
import { toBranchRefDto } from '../companies/branch-response.dto';

type AdminUserRow = Pick<
  User,
  'id' | 'email' | 'name' | 'role' | 'companyId' | 'isActive' | 'emailVerified' | 'createdAt'
>;

export type HomeBranchRef = { id: string; code: string; name: string } | null;

type WithHomeBranch = { homeBranch?: HomeBranchRef | null };

/** Finance provider a `partner_viewer` belongs to (`finance_partner` in user DTOs). */
export type FinancePartnerRef = { id: string; name: string } | null;

type WithFinancePartner = { financePartner?: FinancePartnerRef | null };

export function toFinancePartnerRefDto(partner: FinancePartnerRef | undefined) {
  if (!partner) return null;
  return { id: partner.id, name: partner.name };
}

export function toAdminUserDto(
  user: AdminUserRow & { company?: { name: string } | null } & WithHomeBranch & WithFinancePartner,
) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    company_id: user.companyId,
    company_name: user.company?.name ?? null,
    home_branch: toBranchRefDto(user.homeBranch),
    finance_partner: toFinancePartnerRefDto(user.financePartner),
    is_active: user.isActive,
    email_verified: user.emailVerified,
    created_at: user.createdAt,
  };
}

export function toAdminUserUpdateDto(
  user: Pick<User, 'id' | 'email' | 'name' | 'role' | 'companyId' | 'isActive'> & WithHomeBranch & WithFinancePartner,
) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    company_id: user.companyId,
    home_branch: toBranchRefDto(user.homeBranch),
    finance_partner: toFinancePartnerRefDto(user.financePartner),
    is_active: user.isActive,
  };
}

export function toAdminUserProvisionDto(
  user: Pick<User, 'id' | 'email' | 'name' | 'role' | 'companyId' | 'isActive'> & WithHomeBranch & WithFinancePartner,
  extras: {
    temporaryPassword: string;
    loginUrl: string;
    companyName?: string | null;
  },
) {
  return {
    ...toAdminUserUpdateDto(user),
    temporary_password: extras.temporaryPassword,
    login_url: extras.loginUrl,
    company_name: extras.companyName ?? null,
  };
}

export function toAdminUserListResponse(
  items: Array<AdminUserRow & { company?: { name: string } | null } & WithHomeBranch & WithFinancePartner>,
  total: number,
  limit: number,
  offset: number,
) {
  return { total, limit, offset, items: items.map((item) => toAdminUserDto(item)) };
}
