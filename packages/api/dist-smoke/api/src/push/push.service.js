"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var PushService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PushService = void 0;
exports.resolvePushProvider = resolvePushProvider;
const node_fs_1 = require("node:fs");
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const fetch_with_timeout_1 = require("../common/fetch-with-timeout");
const prisma_service_1 = require("../prisma/prisma.service");
const fcm_1 = require("./fcm");
function resolvePushProvider(raw) {
    return (raw ?? '').trim().toLowerCase() === 'fcm' ? 'fcm' : 'log';
}
const TOKEN_REFRESH_SKEW_MS = 60_000;
let PushService = PushService_1 = class PushService {
    prisma;
    logger = new common_1.Logger(PushService_1.name);
    provider;
    account;
    timeoutMs;
    accessToken = null;
    tokenRequest = null;
    constructor(config, prisma) {
        this.prisma = prisma;
        this.provider = resolvePushProvider(config.get('FCM_PROVIDER'));
        this.timeoutMs = (0, fetch_with_timeout_1.resolveHttpTimeoutMs)(config.get('FCM_HTTP_TIMEOUT_MS'), fcm_1.DEFAULT_FCM_TIMEOUT_MS);
        this.account = PushService_1.loadServiceAccount(config);
        if (this.provider === 'fcm' && !this.account) {
            throw new Error('FCM_SERVICE_ACCOUNT_JSON or FCM_SERVICE_ACCOUNT_FILE is required when FCM_PROVIDER=fcm');
        }
        if (process.env.NODE_ENV === 'production' && this.provider === 'log') {
            this.logger.warn('FCM_PROVIDER is not configured — push notifications will only be logged');
        }
    }
    static loadServiceAccount(config) {
        const inline = config.get('FCM_SERVICE_ACCOUNT_JSON')?.trim();
        if (inline)
            return (0, fcm_1.parseServiceAccount)(inline);
        const file = config.get('FCM_SERVICE_ACCOUNT_FILE')?.trim();
        if (file)
            return (0, fcm_1.parseServiceAccount)((0, node_fs_1.readFileSync)(file, 'utf8'));
        return null;
    }
    get isLive() {
        return this.provider === 'fcm';
    }
    get providerName() {
        return this.provider;
    }
    async sendToUser(userId, payload) {
        const tokens = await this.prisma.deviceToken.findMany({
            where: { userId },
            select: { fcmToken: true, platform: true },
            orderBy: { updatedAt: 'desc' },
        });
        return this.sendToTokens(tokens.map((t) => t.fcmToken), payload);
    }
    async sendToTokens(tokens, payload) {
        const summary = { provider: this.provider, attempted: tokens.length, sent: 0, pruned: 0, failed: 0 };
        if (tokens.length === 0)
            return summary;
        if (this.provider === 'log') {
            for (const token of tokens) {
                this.logger.log(`[push] token=${token.slice(0, 12)}… title=${JSON.stringify(payload.title)} link=${payload.linkPath ?? '-'}`);
            }
            return summary;
        }
        const accessToken = await this.getAccessToken();
        for (const token of tokens) {
            try {
                const result = await (0, fcm_1.sendFcmMessage)(accessToken, this.account.projectId, (0, fcm_1.buildFcmMessage)(token, payload), this.timeoutMs);
                if (result.outcome === 'sent') {
                    summary.sent += 1;
                }
                else if (result.outcome === 'unregistered') {
                    await this.pruneToken(token);
                    summary.pruned += 1;
                }
                else {
                    summary.failed += 1;
                    this.logger.warn(`FCM send failed code=${result.code ?? 'unknown'}: ${result.message ?? ''}`.trim());
                }
            }
            catch (err) {
                summary.failed += 1;
                const message = err instanceof Error ? err.message : String(err);
                this.logger.warn(`FCM request failed: ${message}`);
            }
        }
        return summary;
    }
    async pruneToken(token) {
        try {
            await this.prisma.deviceToken.deleteMany({ where: { fcmToken: token } });
            this.logger.log(`Pruned unregistered device token ${token.slice(0, 12)}…`);
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            this.logger.warn(`Could not prune device token: ${message}`);
        }
    }
    async getAccessToken() {
        if (this.accessToken && this.accessToken.expiresAt - TOKEN_REFRESH_SKEW_MS > Date.now()) {
            return this.accessToken.value;
        }
        if (!this.tokenRequest) {
            this.tokenRequest = this.exchangeToken().finally(() => {
                this.tokenRequest = null;
            });
        }
        return this.tokenRequest;
    }
    async exchangeToken() {
        const account = this.account;
        const { jwt } = (0, fcm_1.buildServiceAccountJwt)(account);
        const exchanged = await (0, fcm_1.exchangeJwtForAccessToken)(account.tokenUri, jwt, this.timeoutMs);
        this.accessToken = { value: exchanged.accessToken, expiresAt: exchanged.expiresAt.getTime() };
        return exchanged.accessToken;
    }
};
exports.PushService = PushService;
exports.PushService = PushService = PushService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService,
        prisma_service_1.PrismaService])
], PushService);
//# sourceMappingURL=push.service.js.map