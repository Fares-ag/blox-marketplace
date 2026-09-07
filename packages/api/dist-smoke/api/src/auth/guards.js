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
exports.OptionalSessionGuard = exports.SessionAuthGuard = exports.CurrentUser = exports.MfaExempt = exports.MFA_EXEMPT_KEY = exports.Public = exports.IS_PUBLIC_KEY = exports.Roles = exports.ROLES_KEY = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const core_1 = require("@nestjs/core");
const prisma_service_1 = require("../prisma/prisma.service");
const auth_constants_1 = require("./auth.constants");
const node_1 = require("better-auth/node");
const auth_config_1 = require("./auth-config");
const privileged_roles_1 = require("./privileged-roles");
const mobile_token_1 = require("./mobile/mobile-token");
const session_policy_1 = require("./session-policy");
exports.ROLES_KEY = 'roles';
const Roles = (...roles) => (0, common_1.SetMetadata)(exports.ROLES_KEY, roles);
exports.Roles = Roles;
exports.IS_PUBLIC_KEY = 'isPublic';
const Public = () => (0, common_1.SetMetadata)(exports.IS_PUBLIC_KEY, true);
exports.Public = Public;
exports.MFA_EXEMPT_KEY = 'mfaExempt';
const MfaExempt = () => (0, common_1.SetMetadata)(exports.MFA_EXEMPT_KEY, true);
exports.MfaExempt = MfaExempt;
exports.CurrentUser = (0, common_1.createParamDecorator)((_, ctx) => {
    const req = ctx.switchToHttp().getRequest();
    return req.user;
});
async function retireIfPastAbsoluteLimit(prisma, session, policy) {
    if (!session?.session || !(0, session_policy_1.sessionPastAbsoluteLimit)(session.session.createdAt, policy))
        return false;
    await prisma.session.deleteMany({ where: { id: session.session.id } }).catch(() => undefined);
    return true;
}
let SessionAuthGuard = class SessionAuthGuard {
    prisma;
    reflector;
    config;
    auth;
    sessionPolicy;
    constructor(prisma, reflector, config, auth) {
        this.prisma = prisma;
        this.reflector = reflector;
        this.config = config;
        this.auth = auth;
        this.sessionPolicy = (0, session_policy_1.resolveSessionPolicy)(config);
    }
    async canActivate(context) {
        const isPublic = this.reflector.getAllAndOverride(exports.IS_PUBLIC_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);
        const mfaExempt = this.reflector.getAllAndOverride(exports.MFA_EXEMPT_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);
        const req = context.switchToHttp().getRequest();
        const session = await this.auth.api.getSession({ headers: (0, node_1.fromNodeHeaders)(req.headers) });
        let retired = false;
        if (session?.user) {
            retired = await retireIfPastAbsoluteLimit(this.prisma, session, this.sessionPolicy);
            if (!retired) {
                const user = await this.prisma.user.findUnique({ where: { id: session.user.id } });
                if (user?.isActive) {
                    req.user = user;
                }
            }
        }
        if (!req.user) {
            const token = (0, mobile_token_1.bearerFromHeader)(req.headers.authorization);
            if (token) {
                try {
                    const payload = (0, mobile_token_1.verifyMobileAccessToken)((0, auth_config_1.resolveAuthSecret)(this.config), token);
                    if (payload?.sub) {
                        const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
                        if (user?.isActive)
                            req.user = user;
                    }
                }
                catch {
                }
            }
        }
        if (!req.user) {
            if (isPublic)
                return true;
            throw new common_1.UnauthorizedException(retired ? 'session_absolute_timeout' : undefined);
        }
        const roles = this.reflector.getAllAndOverride(exports.ROLES_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);
        if (roles?.length && !roles.includes(req.user.role)) {
            throw new common_1.ForbiddenException('forbidden_role');
        }
        if (!mfaExempt &&
            (0, auth_config_1.isMfaEnforcementActive)((0, auth_config_1.resolveMfaEnforcement)(this.config)) &&
            (0, privileged_roles_1.isMfaRequiredRole)(req.user.role) &&
            !req.user.twoFactorEnabled) {
            throw new common_1.ForbiddenException('mfa_required');
        }
        return true;
    }
};
exports.SessionAuthGuard = SessionAuthGuard;
exports.SessionAuthGuard = SessionAuthGuard = __decorate([
    (0, common_1.Injectable)(),
    __param(3, (0, common_1.Inject)(auth_constants_1.AUTH_INSTANCE)),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        core_1.Reflector,
        config_1.ConfigService, Object])
], SessionAuthGuard);
let OptionalSessionGuard = class OptionalSessionGuard {
    prisma;
    config;
    auth;
    sessionPolicy;
    constructor(prisma, config, auth) {
        this.prisma = prisma;
        this.config = config;
        this.auth = auth;
        this.sessionPolicy = (0, session_policy_1.resolveSessionPolicy)(config);
    }
    async canActivate(context) {
        const req = context.switchToHttp().getRequest();
        try {
            const session = await this.auth.api.getSession({ headers: (0, node_1.fromNodeHeaders)(req.headers) });
            if (session?.user &&
                !(await retireIfPastAbsoluteLimit(this.prisma, session, this.sessionPolicy))) {
                const user = await this.prisma.user.findUnique({ where: { id: session.user.id } });
                if (user?.isActive)
                    req.user = user;
            }
            if (!req.user) {
                const token = (0, mobile_token_1.bearerFromHeader)(req.headers.authorization);
                if (token) {
                    const payload = (0, mobile_token_1.verifyMobileAccessToken)((0, auth_config_1.resolveAuthSecret)(this.config), token);
                    if (payload?.sub) {
                        const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
                        if (user?.isActive)
                            req.user = user;
                    }
                }
            }
        }
        catch {
        }
        return true;
    }
};
exports.OptionalSessionGuard = OptionalSessionGuard;
exports.OptionalSessionGuard = OptionalSessionGuard = __decorate([
    (0, common_1.Injectable)(),
    __param(2, (0, common_1.Inject)(auth_constants_1.AUTH_INSTANCE)),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        config_1.ConfigService, Object])
], OptionalSessionGuard);
//# sourceMappingURL=guards.js.map