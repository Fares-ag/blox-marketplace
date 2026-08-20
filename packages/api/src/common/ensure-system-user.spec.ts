import { UserRole } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { ensureSystemUser, SYSTEM_USER_EMAIL } from './ensure-system-user';
import { SYSTEM_ACTOR_USER_ID } from './system-actor';

describe('ensureSystemUser', () => {
  it('upserts the synthetic system actor with a stable id and non-login email', async () => {
    const upsert = vi.fn().mockResolvedValue(undefined);
    await ensureSystemUser({ user: { upsert } } as never);

    expect(upsert).toHaveBeenCalledWith({
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
  });
});
