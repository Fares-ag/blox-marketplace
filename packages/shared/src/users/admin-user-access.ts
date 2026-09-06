const PRIVILEGED_ROLES = ['admin', 'super_admin'];

export function canManageUserAccess(
  me: { id: string; role?: string | null } | null | undefined,
  target: { id: string; role: string },
) {
  if (!me || target.id === me.id) return false;
  if (me.role === 'super_admin') return true;
  if (me.role === 'admin') return target.role !== 'super_admin';
  return !PRIVILEGED_ROLES.includes(target.role);
}
