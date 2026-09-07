import { PrismaService } from './prisma/prisma.service';
export declare class HealthController {
    private readonly prisma;
    constructor(prisma: PrismaService);
    health(): {
        ok: boolean;
        service: string;
    };
    ready(): Promise<{
        ok: boolean;
        service: string;
        database: string;
    }>;
}
