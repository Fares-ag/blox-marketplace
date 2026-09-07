import { type PrismaClient } from '@prisma/client';
export declare function bootstrapQauto(prisma: PrismaClient): Promise<{
    holding: {
        id: string;
        code: string | null;
        name: string;
    };
    dealerships: {
        id: string;
        code: string | null;
        name: string;
    }[];
    users: string[];
}>;
