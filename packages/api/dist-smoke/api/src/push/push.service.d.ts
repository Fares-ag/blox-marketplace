import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { type PushPayload } from './fcm';
export type PushProvider = 'log' | 'fcm';
export type PushSendSummary = {
    provider: PushProvider;
    attempted: number;
    sent: number;
    pruned: number;
    failed: number;
};
export declare function resolvePushProvider(raw: string | undefined): PushProvider;
export declare class PushService {
    private readonly prisma;
    private readonly logger;
    private readonly provider;
    private readonly account;
    private readonly timeoutMs;
    private accessToken;
    private tokenRequest;
    constructor(config: ConfigService, prisma: PrismaService);
    private static loadServiceAccount;
    get isLive(): boolean;
    get providerName(): PushProvider;
    sendToUser(userId: string, payload: PushPayload): Promise<PushSendSummary>;
    sendToTokens(tokens: string[], payload: PushPayload): Promise<PushSendSummary>;
    private pruneToken;
    private getAccessToken;
    private exchangeToken;
}
