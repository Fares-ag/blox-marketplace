import type { PrismaClient } from '@prisma/client';
import { type QautoListing } from './seed-qauto-inventory';
export declare function resolveQautoImageSourceDir(): Promise<string>;
export declare function resolveQautoSourceFile(listing: QautoListing, sourceDir: string): Promise<{
    filePath: string;
    kind: 'catalog' | 'fallback';
} | null>;
export declare function uploadQautoListingImages(prisma: PrismaClient, opts?: {
    sourceDir?: string;
}): Promise<{
    sourceDir: string;
    uploadedCatalog: number;
    uploadedFallback: number;
    uploadedTotal: number;
    missingProduct: number;
    missingSource: number;
}>;
