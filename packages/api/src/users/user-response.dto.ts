import type { User } from '@prisma/client';

type AdminUserRow = Pick<
  User,
  'id' | 'email' | 'name' | 'role' | 'companyId' | 'isActive' | 'emailVerified' | 'createdAt'
>;

export function toAdminUserDto(user: AdminUserRow) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    company_id: user.companyId,
    is_active: user.isActive,
    email_verified: user.emailVerified,
    created_at: user.createdAt,
  };
}

export function toAdminUserUpdateDto(user: Pick<User, 'id' | 'email' | 'name' | 'role' | 'companyId' | 'isActive'>) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    company_id: user.companyId,
    is_active: user.isActive,
  };
}

export function toAdminUserListResponse(
  items: AdminUserRow[],
  total: number,
  limit: number,
  offset: number,
) {
  return { total, limit, offset, items: items.map((item) => toAdminUserDto(item)) };
}
