import { type PrismaClient } from '@prisma/client';
export declare function backfillInstallmentPlans(prisma: PrismaClient): Promise<{
    updated: number;
}>;
