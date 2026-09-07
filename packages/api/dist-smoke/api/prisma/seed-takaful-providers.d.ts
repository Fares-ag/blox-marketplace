import type { PrismaClient } from '@prisma/client';
export type SeedTakafulRider = {
    code: string;
    label: string;
    labelAr: string;
    annualAmount: number;
};
export type SeedTakafulProvider = {
    code: string;
    name: string;
    nameAr: string;
    comprehensiveRatePct: number;
    thirdPartyAnnual: number;
    minContribution: number;
    riders: SeedTakafulRider[];
    contactPhone: string;
    contactEmail: string;
    website: string;
    sortOrder: number;
};
export declare const TAKAFUL_PROVIDER_SEED: SeedTakafulProvider[];
export declare function seedTakafulProviders(prisma: PrismaClient, providers?: SeedTakafulProvider[]): Promise<{
    seeded: number;
    codes: string[];
}>;
