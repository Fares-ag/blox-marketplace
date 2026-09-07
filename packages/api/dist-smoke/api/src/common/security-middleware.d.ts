import type { ConfigService } from '@nestjs/config';
import type { Express } from 'express';
export declare function applySecurityMiddleware(expressApp: Express, config: ConfigService): Promise<void>;
export declare function closeSecurityMiddlewareClients(): Promise<void>;
