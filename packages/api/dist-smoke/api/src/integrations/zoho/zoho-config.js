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
var ZohoConfig_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ZohoConfig = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const fetch_with_timeout_1 = require("../../common/fetch-with-timeout");
function dataCentreSuffix(hostname, marker) {
    const idx = hostname.indexOf(marker);
    if (idx === -1)
        return null;
    return hostname.slice(idx + marker.length) || null;
}
let ZohoConfig = ZohoConfig_1 = class ZohoConfig {
    config;
    logger = new common_1.Logger(ZohoConfig_1.name);
    constructor(config) {
        this.config = config;
    }
    get hasCredentials() {
        const token = this.refreshToken;
        if (!token || token.includes('<') || token.length < 20)
            return false;
        return Boolean(this.clientId && this.clientSecret && token);
    }
    get configurationError() {
        if (!this.hasCredentials)
            return null;
        const raw = this.rawApiDomain;
        if (!raw)
            return 'zoho_api_domain_missing';
        let url;
        try {
            url = new URL(raw);
        }
        catch {
            return 'zoho_api_domain_invalid';
        }
        if (url.protocol !== 'https:')
            return 'zoho_api_domain_invalid';
        if (!url.hostname.includes('zohoapis.'))
            return 'zoho_api_domain_invalid';
        return null;
    }
    get enabled() {
        return this.hasCredentials && this.configurationError === null;
    }
    get clientId() {
        return this.config.get('ZOHO_CLIENT_ID') ?? '';
    }
    get clientSecret() {
        return this.config.get('ZOHO_CLIENT_SECRET') ?? '';
    }
    get refreshToken() {
        return this.config.get('ZOHO_REFRESH_TOKEN') ?? '';
    }
    get accountsUrl() {
        return this.config.get('ZOHO_ACCOUNTS_URL') ?? 'https://accounts.zoho.com';
    }
    get rawApiDomain() {
        return this.config.get('ZOHO_API_DOMAIN')?.trim() ?? '';
    }
    get apiDomain() {
        return this.rawApiDomain.replace(/\/$/, '');
    }
    get requestSubmittedTo() {
        return this.config.get('ZOHO_REQUEST_SUBMITTED_TO') ?? 'Direct to Partner';
    }
    get leadSource() {
        return this.config.get('ZOHO_LEAD_SOURCE') ?? 'Partners';
    }
    get httpTimeoutMs() {
        return (0, fetch_with_timeout_1.resolveHttpTimeoutMs)(this.config.get('ZOHO_HTTP_TIMEOUT_MS'), 8000);
    }
    onModuleInit() {
        if (!this.hasCredentials) {
            this.logger.log('Zoho CRM disabled (no credentials configured).');
            return;
        }
        const error = this.configurationError;
        if (error) {
            this.logger.error(`Zoho CRM credentials are present but the integration is DISABLED: ${error}. ` +
                'Set ZOHO_API_DOMAIN explicitly (e.g. https://www.zohoapis.com).');
            return;
        }
        this.logger.log(`Zoho CRM enabled — api=${this.apiDomain} accounts=${this.accountsUrl} ` +
            `requestSubmittedTo="${this.requestSubmittedTo}"`);
        if (this.apiDomain.includes('sandbox')) {
            this.logger.warn('Zoho CRM is pointing at the SANDBOX data centre.');
        }
        try {
            const apiSuffix = dataCentreSuffix(new URL(this.apiDomain).hostname, 'zohoapis');
            const accountsSuffix = dataCentreSuffix(new URL(this.accountsUrl).hostname, 'zoho');
            if (apiSuffix && accountsSuffix && apiSuffix !== accountsSuffix) {
                this.logger.warn(`Zoho data-centre mismatch: API domain ends "${apiSuffix}" but accounts URL ends ` +
                    `"${accountsSuffix}". Token refresh will likely fail.`);
            }
        }
        catch {
        }
    }
};
exports.ZohoConfig = ZohoConfig;
exports.ZohoConfig = ZohoConfig = ZohoConfig_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], ZohoConfig);
//# sourceMappingURL=zoho-config.js.map