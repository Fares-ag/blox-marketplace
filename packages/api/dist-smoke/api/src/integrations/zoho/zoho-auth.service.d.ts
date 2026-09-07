import { ZohoConfig } from './zoho-config';
export declare class ZohoAuthService {
    private readonly config;
    private readonly logger;
    private cache;
    constructor(config: ZohoConfig);
    getAccessToken(): Promise<string>;
}
