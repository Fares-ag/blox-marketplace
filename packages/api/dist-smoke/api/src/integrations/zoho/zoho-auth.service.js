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
var ZohoAuthService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ZohoAuthService = void 0;
const common_1 = require("@nestjs/common");
const fetch_with_timeout_1 = require("../../common/fetch-with-timeout");
const zoho_config_1 = require("./zoho-config");
let ZohoAuthService = ZohoAuthService_1 = class ZohoAuthService {
    config;
    logger = new common_1.Logger(ZohoAuthService_1.name);
    cache = null;
    constructor(config) {
        this.config = config;
    }
    async getAccessToken() {
        if (this.cache && this.cache.expiresAt > Date.now() + 60_000) {
            return this.cache.accessToken;
        }
        const res = await (0, fetch_with_timeout_1.fetchWithTimeout)(`${this.config.accountsUrl}/oauth/v2/token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type: 'refresh_token',
                client_id: this.config.clientId,
                client_secret: this.config.clientSecret,
                refresh_token: this.config.refreshToken,
            }),
        }, this.config.httpTimeoutMs);
        const body = (await res.json());
        if (!res.ok || !body.access_token) {
            this.logger.error(`Zoho token refresh failed: ${body.error ?? res.status}`);
            throw new Error('zoho_token_refresh_failed');
        }
        this.cache = {
            accessToken: body.access_token,
            expiresAt: Date.now() + (body.expires_in ?? 3600) * 1000,
        };
        return body.access_token;
    }
};
exports.ZohoAuthService = ZohoAuthService;
exports.ZohoAuthService = ZohoAuthService = ZohoAuthService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [zoho_config_1.ZohoConfig])
], ZohoAuthService);
//# sourceMappingURL=zoho-auth.service.js.map