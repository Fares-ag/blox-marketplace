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
exports.MeController = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const class_validator_1 = require("class-validator");
const identity_service_1 = require("../common/identity.service");
const qid_1 = require("../common/qid");
const guards_1 = require("./guards");
const prisma_service_1 = require("../prisma/prisma.service");
const auth_config_1 = require("./auth-config");
const privileged_roles_1 = require("./privileged-roles");
const session_policy_1 = require("./session-policy");
class UpdateProfileDto {
    name;
    phone;
    qid;
}
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateProfileDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateProfileDto.prototype, "phone", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(qid_1.QID_PATTERN, { message: qid_1.QID_VALIDATION_MESSAGE }),
    __metadata("design:type", String)
], UpdateProfileDto.prototype, "qid", void 0);
let MeController = class MeController {
    prisma;
    config;
    identity;
    constructor(prisma, config, identity) {
        this.prisma = prisma;
        this.config = config;
        this.identity = identity;
    }
    me(user) {
        return this.toPublic(user);
    }
    async update(user, dto) {
        const updated = await this.prisma.user.update({
            where: { id: user.id },
            data: {
                name: dto.name ?? undefined,
                phone: dto.phone ?? undefined,
                ...(this.identity.prepareQidWrite(dto.qid) ?? {}),
            },
        });
        return this.toPublic(updated);
    }
    async revokeAllSessions(user) {
        await this.prisma.session.deleteMany({ where: { userId: user.id } });
        return { status: true };
    }
    async toPublic(user) {
        const mfaRequired = (0, privileged_roles_1.isMfaRequiredRole)(user.role);
        const mfaEnforced = (0, auth_config_1.isMfaEnforcementActive)((0, auth_config_1.resolveMfaEnforcement)(this.config));
        const partner = user.financePartnerId
            ? await this.prisma.financePartner.findUnique({
                where: { id: user.financePartnerId },
                select: { id: true, name: true },
            })
            : null;
        return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            company_id: user.companyId,
            credit_scope: user.creditScope,
            finance_scope: user.financeScope,
            phone: user.phone,
            qid: this.identity.readQid(user),
            email_verified: user.emailVerified,
            is_active: user.isActive,
            two_factor_enabled: user.twoFactorEnabled,
            mfa_required: mfaRequired,
            mfa_setup_required: mfaEnforced && mfaRequired && !user.twoFactorEnabled,
            session_policy: (0, session_policy_1.sessionPolicyDto)((0, session_policy_1.resolveSessionPolicy)(this.config)),
            finance_partner_id: user.financePartnerId ?? null,
            finance_partner_name: partner?.name ?? null,
        };
    }
};
exports.MeController = MeController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, guards_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], MeController.prototype, "me", null);
__decorate([
    (0, common_1.Patch)(),
    __param(0, (0, guards_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, UpdateProfileDto]),
    __metadata("design:returntype", Promise)
], MeController.prototype, "update", null);
__decorate([
    (0, common_1.Post)('sessions/revoke-all'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, guards_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], MeController.prototype, "revokeAllSessions", null);
exports.MeController = MeController = __decorate([
    (0, common_1.Controller)('me'),
    (0, guards_1.MfaExempt)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        config_1.ConfigService,
        identity_service_1.IdentityService])
], MeController);
//# sourceMappingURL=me.controller.js.map