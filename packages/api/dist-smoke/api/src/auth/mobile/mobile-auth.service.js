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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MobileAuthService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const api_1 = require("better-auth/api");
const config_1 = require("@nestjs/config");
const prisma_service_1 = require("../../prisma/prisma.service");
const identity_service_1 = require("../../common/identity.service");
const auth_constants_1 = require("../auth.constants");
const auth_config_1 = require("../auth-config");
const mobile_token_1 = require("./mobile-token");
const signup_error_1 = require("./signup-error");
function splitName(name) {
    const parts = name.trim().split(/\s+/);
    return { firstName: parts[0] ?? '', lastName: parts.slice(1).join(' ') };
}
let MobileAuthService = class MobileAuthService {
    prisma;
    config;
    identity;
    auth;
    constructor(prisma, config, identity, auth) {
        this.prisma = prisma;
        this.config = config;
        this.identity = identity;
        this.auth = auth;
    }
    secret() {
        return (0, auth_config_1.resolveAuthSecret)(this.config);
    }
    async signIn(email, password) {
        const normalized = email.trim().toLowerCase();
        try {
            await this.auth.api.signInEmail({ body: { email: normalized, password } });
        }
        catch (err) {
            if (err instanceof api_1.APIError) {
                throw new common_1.UnauthorizedException('invalid_credentials');
            }
            throw err;
        }
        const user = await this.prisma.user.findUnique({ where: { email: normalized } });
        if (!user?.isActive)
            throw new common_1.UnauthorizedException('invalid_credentials');
        if (user.role !== client_1.UserRole.customer) {
            throw new common_1.ForbiddenException('forbidden_role');
        }
        return this.issueSession(user);
    }
    async signUp(input) {
        const email = input.email.trim().toLowerCase();
        const name = `${input.firstName} ${input.lastName}`.trim();
        try {
            await this.auth.api.signUpEmail({
                body: {
                    email,
                    password: input.password,
                    name,
                },
            });
        }
        catch (err) {
            if (err instanceof api_1.APIError) {
                throw new common_1.BadRequestException((0, signup_error_1.mapSignupFailure)(err.message));
            }
            throw err;
        }
        const user = await this.prisma.user.findUnique({ where: { email } });
        if (!user)
            throw new common_1.BadRequestException('signup_failed');
        await this.prisma.user.update({
            where: { id: user.id },
            data: {
                role: client_1.UserRole.customer,
                phone: input.phone ?? user.phone,
                ...(input.qid ? this.identity.prepareQidWrite(input.qid) : {}),
                name: name || user.name,
            },
        });
        const refreshed = await this.prisma.user.findUniqueOrThrow({ where: { id: user.id } });
        return this.issueSession(refreshed);
    }
    async refresh(rawToken) {
        const hash = (0, mobile_token_1.hashRefreshToken)(rawToken);
        const row = await this.prisma.mobileRefreshToken.findUnique({ where: { tokenHash: hash } });
        if (!row || row.revokedAt || row.expiresAt.getTime() < Date.now()) {
            throw new common_1.UnauthorizedException('invalid_refresh_token');
        }
        await this.prisma.mobileRefreshToken.update({
            where: { id: row.id },
            data: { revokedAt: new Date() },
        });
        const user = await this.prisma.user.findUnique({ where: { id: row.userId } });
        if (!user?.isActive)
            throw new common_1.UnauthorizedException('invalid_refresh_token');
        return this.issueSession(user);
    }
    async signOut(rawToken, userId) {
        if (rawToken) {
            const hash = (0, mobile_token_1.hashRefreshToken)(rawToken);
            await this.prisma.mobileRefreshToken.updateMany({
                where: { userId, tokenHash: hash, revokedAt: null },
                data: { revokedAt: new Date() },
            });
        }
        else {
            await this.prisma.mobileRefreshToken.updateMany({
                where: { userId, revokedAt: null },
                data: { revokedAt: new Date() },
            });
        }
        return { ok: true };
    }
    async requestPasswordReset(email) {
        const normalized = email.trim().toLowerCase();
        try {
            await this.auth.api.requestPasswordReset({
                body: { email: normalized, redirectTo: undefined },
            });
        }
        catch {
        }
        return { ok: true };
    }
    async confirmPasswordReset(token, newPassword) {
        try {
            await this.auth.api.resetPassword({
                body: { token, newPassword },
            });
        }
        catch (err) {
            if (err instanceof api_1.APIError) {
                throw new common_1.BadRequestException(err.message || 'reset_failed');
            }
            throw err;
        }
        return { ok: true };
    }
    async changePassword(userId, currentPassword, newPassword) {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user)
            throw new common_1.UnauthorizedException('invalid_credentials');
        try {
            await this.auth.api.signInEmail({
                body: { email: user.email, password: currentPassword },
            });
        }
        catch {
            throw new common_1.UnauthorizedException('invalid_credentials');
        }
        const ctx = await this.auth.$context;
        const hash = await ctx.password.hash(newPassword);
        await ctx.internalAdapter.updatePassword(user.id, hash);
        return { ok: true };
    }
    async issueSession(user) {
        const access = (0, mobile_token_1.signMobileAccessToken)(this.secret(), {
            sub: user.id,
            email: user.email,
            role: user.role,
        });
        const refresh = (0, mobile_token_1.newRefreshToken)();
        await this.prisma.mobileRefreshToken.create({
            data: {
                userId: user.id,
                tokenHash: refresh.hash,
                expiresAt: refresh.expiresAt,
            },
        });
        const names = splitName(user.name);
        return {
            access_token: access.token,
            refresh_token: refresh.raw,
            expires_at: access.expiresAt.toISOString(),
            user: {
                user_id: user.id,
                role: user.role,
                email: user.email,
                phone: user.phone ?? '',
                first_name: names.firstName,
                last_name: names.lastName,
            },
        };
    }
};
exports.MobileAuthService = MobileAuthService;
exports.MobileAuthService = MobileAuthService = __decorate([
    (0, common_1.Injectable)(),
    __param(3, (0, common_1.Inject)(auth_constants_1.AUTH_INSTANCE)),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        config_1.ConfigService,
        identity_service_1.IdentityService, Object])
], MobileAuthService);
//# sourceMappingURL=mobile-auth.service.js.map