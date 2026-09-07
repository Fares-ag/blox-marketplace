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
var AppConfigService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppConfigService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const auth_config_1 = require("../auth/auth-config");
function requireNonEmpty(value, name) {
    const trimmed = value?.trim();
    if (!trimmed) {
        throw new Error(`${name} is required`);
    }
    return trimmed;
}
function parsePositiveInt(raw, fallback) {
    const trimmed = raw?.trim();
    if (!trimmed)
        return fallback;
    const n = Number(trimmed);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}
function parseBool(raw, fallback) {
    const trimmed = raw?.trim().toLowerCase();
    if (!trimmed)
        return fallback;
    if (['1', 'true', 'yes', 'on'].includes(trimmed))
        return true;
    if (['0', 'false', 'no', 'off'].includes(trimmed))
        return false;
    return fallback;
}
function parseOrigins(raw, fallback) {
    return (raw ?? fallback)
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean);
}
function resolvePortalBase(config, envKey, corsOrigins, devPort) {
    const explicit = config.get(envKey)?.trim();
    if (explicit)
        return explicit.replace(/\/$/, '');
    const fromCors = corsOrigins.find((origin) => new RegExp(`:${devPort}(?:/|$)`).test(origin));
    if (fromCors)
        return fromCors.replace(/\/$/, '');
    return `http://localhost:${devPort}`;
}
let AppConfigService = AppConfigService_1 = class AppConfigService {
    logger = new common_1.Logger(AppConfigService_1.name);
    nodeEnv;
    apiPort;
    corsOrigins;
    marketplaceUrl;
    adminUrl;
    superAdminUrl;
    dealerUrl;
    creditUrl;
    financeUrl;
    databaseUrl;
    assistSessionTtlMinutes;
    kycEkycRequired;
    kycAllowStaffManualIdentity;
    constructor(config) {
        this.nodeEnv = config.get('NODE_ENV') ?? 'development';
        this.apiPort = (0, auth_config_1.resolveApiPort)(config);
        this.corsOrigins = parseOrigins(config.get('CORS_ORIGINS'), 'http://localhost:5173');
        const marketplace = config.get('MARKETPLACE_URL')?.trim() ??
            config.get('VITE_MARKETPLACE_URL')?.trim();
        if (!marketplace && this.nodeEnv === 'production') {
            throw new Error('MARKETPLACE_URL is required in production');
        }
        this.marketplaceUrl = (marketplace ?? 'http://localhost:5173').replace(/\/$/, '');
        this.adminUrl = resolvePortalBase(config, 'ADMIN_URL', this.corsOrigins, 5174);
        this.superAdminUrl = resolvePortalBase(config, 'SUPER_ADMIN_URL', this.corsOrigins, 5175);
        this.dealerUrl = resolvePortalBase(config, 'DEALER_URL', this.corsOrigins, 5176);
        this.creditUrl = resolvePortalBase(config, 'CREDIT_URL', this.corsOrigins, 5177);
        this.financeUrl = resolvePortalBase(config, 'FINANCE_URL', this.corsOrigins, 5179);
        this.databaseUrl = requireNonEmpty(config.get('DATABASE_URL'), 'DATABASE_URL');
        this.assistSessionTtlMinutes = parsePositiveInt(config.get('ASSIST_SESSION_TTL_MINUTES'), 120);
        const kycConfigured = !!config.get('KYC_API_KEY')?.trim();
        this.kycEkycRequired = parseBool(config.get('KYC_EKYC_REQUIRED'), kycConfigured);
        this.kycAllowStaffManualIdentity = parseBool(config.get('KYC_ALLOW_STAFF_MANUAL_IDENTITY'), true);
        if (kycConfigured && !this.kycEkycRequired) {
            this.logger.warn('KYC_EKYC_REQUIRED=false: customers may satisfy the identity slot with a manual QID upload');
        }
        (0, auth_config_1.resolveAuthSecret)(config);
        if (this.nodeEnv === 'production' && !config.get('REDIS_URL')?.trim()) {
            this.logger.warn('REDIS_URL is not set — express-rate-limit uses an in-memory store (limits are per replica)');
        }
    }
    marketplacePath(path) {
        const normalized = path.startsWith('/') ? path : `/${path}`;
        return `${this.marketplaceUrl}${normalized}`;
    }
    portalSignInUrl(role) {
        const baseByRole = {
            customer: this.marketplaceUrl,
            dealer_agent: this.dealerUrl,
            credit_officer: this.creditUrl,
            finance_officer: this.financeUrl,
            admin: this.adminUrl,
            super_admin: this.superAdminUrl,
            group_admin: this.adminUrl,
        };
        const base = baseByRole[role] ?? this.marketplaceUrl;
        return `${base}/auth/sign-in`;
    }
};
exports.AppConfigService = AppConfigService;
exports.AppConfigService = AppConfigService = AppConfigService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], AppConfigService);
//# sourceMappingURL=app-config.service.js.map