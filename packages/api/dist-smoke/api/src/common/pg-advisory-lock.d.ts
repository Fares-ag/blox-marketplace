import { PrismaService } from '../prisma/prisma.service';
export declare function cronJobLockKey(jobName: string): bigint;
export declare function tryWithAdvisoryLock<T>(prisma: PrismaService, lockKey: bigint, fn: () => Promise<T>): Promise<T | null>;
