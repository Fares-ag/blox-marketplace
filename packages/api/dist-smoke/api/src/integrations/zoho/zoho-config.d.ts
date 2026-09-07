import { OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
export declare class ZohoConfig implements OnModuleInit {
    private readonly config;
    private readonly logger;
    constructor(config: ConfigService);
    get hasCredentials(): boolean;
    get configurationError(): string | null;
    get enabled(): boolean;
    get clientId(): string;
    get clientSecret(): string;
    get refreshToken(): string;
    get accountsUrl(): string;
    private get rawApiDomain();
    get apiDomain(): string;
    get requestSubmittedTo(): string;
    get leadSource(): string;
    get httpTimeoutMs(): number;
    onModuleInit(): void;
}
