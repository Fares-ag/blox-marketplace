import type { User } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';

export type LoginLockoutConfig = {
  maxFailedAttempts: number;
  lockoutDurationSeconds: number;
};

export const DEFAULT_LOGIN_LOCKOUT: LoginLockoutConfig = {
  maxFailedAttempts: 5,
  lockoutDurationSeconds: 900,
};

export function isAccountLocked(user: Pick<User, 'lockedUntil'>, now = new Date()): boolean {
  return Boolean(user.lockedUntil && user.lockedUntil > now);
}

export function lockoutExpiresAt(
  failedAttempts: number,
  config: LoginLockoutConfig,
  now = new Date(),
): Date | null {
  if (failedAttempts < config.maxFailedAttempts) return null;
  return new Date(now.getTime() + config.lockoutDurationSeconds * 1000);
}

export function lockoutMessage(lockedUntil: Date | null | undefined, now = new Date()): string {
  if (!lockedUntil || lockedUntil <= now) {
    return 'Too many sign-in attempts. Try again later.';
  }
  const minutes = Math.max(1, Math.ceil((lockedUntil.getTime() - now.getTime()) / 60_000));
  return `Too many sign-in attempts. Wait ${minutes} minute${minutes === 1 ? '' : 's'} and try again.`;
}

export async function resetLoginLockout(prisma: PrismaService, userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: {
      failedLoginAttempts: 0,
      lockedUntil: null,
    },
  });
}

export async function recordFailedPrivilegedLogin(
  prisma: PrismaService,
  userId: string,
  config: LoginLockoutConfig,
): Promise<void> {
  const now = new Date();
  const updated = await prisma.user.update({
    where: { id: userId },
    data: { failedLoginAttempts: { increment: 1 } },
    select: { failedLoginAttempts: true },
  });
  const lockedUntil = lockoutExpiresAt(updated.failedLoginAttempts, config, now);
  if (lockedUntil) {
    await prisma.user.update({
      where: { id: userId },
      data: { lockedUntil },
    });
  }
}
