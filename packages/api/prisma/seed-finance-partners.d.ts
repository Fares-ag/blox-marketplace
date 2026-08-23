import type { PrismaClient } from '@prisma/client';
export declare function seedFinancePartners(prisma: PrismaClient): Promise<{
    seeded: number;
    partners: string[];
}>;
