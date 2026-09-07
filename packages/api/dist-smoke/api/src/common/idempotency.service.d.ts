import { PrismaService } from '../prisma/prisma.service';
export declare class IdempotencyService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    run<T>(opts: {
        userId: string;
        scope: string;
        idempotencyKey?: string | null;
        handler: () => Promise<T>;
        statusCode?: number;
    }): Promise<T>;
    private waitForStoredResponse;
}
