import type { PrismaClient } from '@prisma/client';
export declare function backfillListingImageUrls(prisma: PrismaClient): Promise<{
    total: number;
    updated: number;
}>;
