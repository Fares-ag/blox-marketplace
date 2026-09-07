"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cronJobLockKey = cronJobLockKey;
exports.tryWithAdvisoryLock = tryWithAdvisoryLock;
function cronJobLockKey(jobName) {
    let hash = 0;
    for (let i = 0; i < jobName.length; i += 1) {
        hash = (Math.imul(31, hash) + jobName.charCodeAt(i)) >>> 0;
    }
    return BigInt(hash);
}
async function tryWithAdvisoryLock(prisma, lockKey, fn) {
    const rows = await prisma.$queryRaw `
    SELECT pg_try_advisory_lock(${lockKey}) AS acquired
  `;
    if (!rows[0]?.acquired)
        return null;
    try {
        return await fn();
    }
    finally {
        await prisma.$queryRaw `SELECT pg_advisory_unlock(${lockKey})`;
    }
}
//# sourceMappingURL=pg-advisory-lock.js.map