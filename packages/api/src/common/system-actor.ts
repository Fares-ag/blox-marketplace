import { User, UserRole } from '@prisma/client';

/** Synthetic actor id for cron jobs and other system-initiated actions. */
export const SYSTEM_ACTOR_USER_ID = 'system';

export const SYSTEM_ACTOR = {
  id: SYSTEM_ACTOR_USER_ID,
  role: UserRole.super_admin,
} as User;
