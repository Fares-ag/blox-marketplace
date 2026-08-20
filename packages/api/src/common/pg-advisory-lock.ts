import { PrismaService } from '../prisma/prisma.service';

/** Stable bigint key for Postgres advisory locks from a cron job name. */
export function cronJobLockKey(jobName: string): bigint {
  let hash = 0;
  for (let i = 0; i < jobName.length; i += 1) {
    hash = (Math.imul(31, hash) + jobName.charCodeAt(i)) >>> 0;
  }
  return BigInt(hash);
}

/**
 * Runs `fn` while holding a session-level advisory lock. Returns null when
 * another replica already holds the lock (pg_try_advisory_lock = false).
 */
export async function tryWithAdvisoryLock<T>(
  prisma: PrismaService,
  lockKey: bigint,
  fn: () => Promise<T>,
): Promise<T | null> {
  const rows = await prisma.$queryRaw<{ acquired: boolean }[]>`
    SELECT pg_try_advisory_lock(${lockKey}) AS acquired
  `;
  if (!rows[0]?.acquired) return null;

  try {
    return await fn();
  } finally {
    await prisma.$queryRaw`SELECT pg_advisory_unlock(${lockKey})`;
  }
}
