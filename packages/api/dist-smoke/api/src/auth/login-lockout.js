"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_LOGIN_LOCKOUT = void 0;
exports.isAccountLocked = isAccountLocked;
exports.lockoutExpiresAt = lockoutExpiresAt;
exports.lockoutMessage = lockoutMessage;
exports.resetLoginLockout = resetLoginLockout;
exports.recordFailedPrivilegedLogin = recordFailedPrivilegedLogin;
exports.DEFAULT_LOGIN_LOCKOUT = {
    maxFailedAttempts: 5,
    lockoutDurationSeconds: 900,
};
function isAccountLocked(user, now = new Date()) {
    return Boolean(user.lockedUntil && user.lockedUntil > now);
}
function lockoutExpiresAt(failedAttempts, config, now = new Date()) {
    if (failedAttempts < config.maxFailedAttempts)
        return null;
    return new Date(now.getTime() + config.lockoutDurationSeconds * 1000);
}
function lockoutMessage(lockedUntil, now = new Date()) {
    if (!lockedUntil || lockedUntil <= now) {
        return 'Too many failed sign-in attempts. Try again later.';
    }
    const minutes = Math.max(1, Math.ceil((lockedUntil.getTime() - now.getTime()) / 60_000));
    return `Too many failed sign-in attempts. Try again in about ${minutes} minute${minutes === 1 ? '' : 's'}.`;
}
async function resetLoginLockout(prisma, userId) {
    await prisma.user.update({
        where: { id: userId },
        data: {
            failedLoginAttempts: 0,
            lockedUntil: null,
        },
    });
}
async function recordFailedPrivilegedLogin(prisma, userId, config) {
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
//# sourceMappingURL=login-lockout.js.map