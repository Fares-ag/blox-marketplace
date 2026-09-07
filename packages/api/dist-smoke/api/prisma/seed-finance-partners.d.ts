import { type PrismaClient } from '@prisma/client';
export declare const DEFAULT_LENDER_CODE = "al-jazeera";
export declare const DEFAULT_LENDER_OF_RECORD_CODE = "blox-finance";
export declare const SAMPLE_PROVIDER_BRANCH: {
    readonly code: "HQ";
    readonly name: "Head Office";
    readonly city: "Doha";
};
export declare function seedFinancePartners(prisma: PrismaClient): Promise<{
    seeded: number;
    partners: string[];
    defaultLender: string | null;
    providerBranches: number;
}>;
