import type { User } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
export type LoginLockoutConfig = {
    maxFailedAttempts: number;
    lockoutDurationSeconds: number;
};
export declare const DEFAULT_LOGIN_LOCKOUT: LoginLockoutConfig;
export declare function isAccountLocked(user: Pick<User, 'lockedUntil'>, now?: Date): boolean;
export declare function lockoutExpiresAt(failedAttempts: number, config: LoginLockoutConfig, now?: Date): Date | null;
export declare function lockoutMessage(lockedUntil: Date | null | undefined, now?: Date): string;
export declare function resetLoginLockout(prisma: PrismaService, userId: string): Promise<void>;
export declare function recordFailedPrivilegedLogin(prisma: PrismaService, userId: string, config: LoginLockoutConfig): Promise<void>;
