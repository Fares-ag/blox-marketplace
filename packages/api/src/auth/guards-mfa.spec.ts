import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SessionAuthGuard } from './guards';

function mockConfig(values: Record<string, string | undefined>) {
  return { get: (key: string) => values[key] };
}

function mockAuth(sessionUserId: string) {
  return {
    api: {
      getSession: vi.fn().mockResolvedValue({ user: { id: sessionUserId } }),
    },
  };
}

describe('SessionAuthGuard MFA enforcement', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
  });

  it('blocks privileged roles without TOTP when enforcement is active', async () => {
    process.env.NODE_ENV = 'production';
    const user = {
      id: 'u1',
      role: UserRole.credit_officer,
      isActive: true,
      twoFactorEnabled: false,
    };

    const prisma = {
      user: { findUnique: vi.fn().mockResolvedValue(user) },
    };
    const guard = new SessionAuthGuard(
      prisma as never,
      new Reflector(),
      mockConfig({}) as never,
      mockAuth(user.id) as never,
    );

    const context = {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({ headers: {} }),
      }),
    };

    await expect(guard.canActivate(context as never)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(guard.canActivate(context as never)).rejects.toThrow('mfa_required');
  });

  it('allows MFA-exempt routes during TOTP setup', async () => {
    process.env.NODE_ENV = 'production';
    const user = {
      id: 'u1',
      role: UserRole.admin,
      isActive: true,
      twoFactorEnabled: false,
    };

    const reflector = new Reflector();
    vi.spyOn(reflector, 'getAllAndOverride').mockImplementation((key: string) => {
      if (key === 'mfaExempt') return true;
      return false;
    });

    const prisma = {
      user: { findUnique: vi.fn().mockResolvedValue(user) },
    };
    const guard = new SessionAuthGuard(
      prisma as never,
      reflector,
      mockConfig({}) as never,
      mockAuth(user.id) as never,
    );

    const context = {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({ headers: {}, user }),
      }),
    };

    await expect(guard.canActivate(context as never)).resolves.toBe(true);
  });
});
