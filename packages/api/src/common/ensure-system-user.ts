import { UserRole, type PrismaClient } from '@prisma/client';
import { SYSTEM_ACTOR_USER_ID } from './system-actor';

/** Non-login mailbox reserved for cron/system attribution. */
export const SYSTEM_USER_EMAIL = 'system@internal.blox.invalid';

type PrismaLike = Pick<PrismaClient, 'user'>;

/** Idempotent bootstrap so system-attributed FKs always resolve. */
export async function ensureSystemUser(prisma: PrismaLike): Promise<void> {
  await prisma.user.upsert({
    where: { id: SYSTEM_ACTOR_USER_ID },
    create: {
      id: SYSTEM_ACTOR_USER_ID,
      name: 'System',
      email: SYSTEM_USER_EMAIL,
      emailVerified: false,
      role: UserRole.super_admin,
      isActive: true,
    },
    update: {
      name: 'System',
      role: UserRole.super_admin,
      isActive: true,
    },
  });
}
