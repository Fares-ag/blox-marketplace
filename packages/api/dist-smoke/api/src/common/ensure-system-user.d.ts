import { type PrismaClient } from '@prisma/client';
export declare const SYSTEM_USER_EMAIL = "system@internal.blox.invalid";
type PrismaLike = Pick<PrismaClient, 'user'>;
export declare function ensureSystemUser(prisma: PrismaLike): Promise<void>;
export {};
