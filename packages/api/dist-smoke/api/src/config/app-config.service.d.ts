import { ConfigService } from '@nestjs/config';
import type { UserRole } from '@prisma/client';
export declare class AppConfigService {
    private readonly logger;
    readonly nodeEnv: string;
    readonly apiPort: number;
    readonly corsOrigins: string[];
    readonly marketplaceUrl: string;
    readonly adminUrl: string;
    readonly superAdminUrl: string;
    readonly dealerUrl: string;
    readonly creditUrl: string;
    readonly financeUrl: string;
    readonly databaseUrl: string;
    readonly assistSessionTtlMinutes: number;
    readonly kycEkycRequired: boolean;
    readonly kycAllowStaffManualIdentity: boolean;
    constructor(config: ConfigService);
    marketplacePath(path: string): string;
    portalSignInUrl(role: UserRole): string;
}
