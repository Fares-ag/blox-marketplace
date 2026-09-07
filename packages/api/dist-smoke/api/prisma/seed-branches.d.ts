import { type PrismaClient } from '@prisma/client';
export declare const SEED_BRANCH_CODE = "MAIN";
export declare const SEEDED_DEALERSHIP_CODES: readonly ["chery-elite-motors", "qauto-audi", "qauto-vw", "qauto-skoda"];
export declare function seedBranchFor(company: {
    name: string;
}): {
    code: string;
    name: string;
    city: string;
};
export declare function seedBranches(prisma: PrismaClient, companyCodes?: readonly string[]): Promise<{
    branches: number;
    agentsAssigned: number;
    companies: (string | null)[];
}>;
