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
exports.UsersController = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const class_validator_1 = require("class-validator");
const node_crypto_1 = require("node:crypto");
const guards_1 = require("../auth/guards");
const auth_constants_1 = require("../auth/auth.constants");
const mail_service_1 = require("../mail/mail.service");
const app_config_service_1 = require("../config/app-config.service");
const prisma_service_1 = require("../prisma/prisma.service");
const activity_service_1 = require("../common/activity.service");
const pagination_dto_1 = require("../common/pagination.dto");
const prisma_errors_1 = require("../common/prisma-errors");
const user_response_dto_1 = require("./user-response.dto");
const company_hierarchy_1 = require("../companies/company-hierarchy");
const user_provisioning_policy_1 = require("./user-provisioning.policy");
const HOME_BRANCH_SELECT = { select: { id: true, code: true, name: true } };
const FINANCE_PARTNER_SELECT = { select: { id: true, name: true } };
class UpdateUserDto {
    name;
    isActive;
    role;
    companyId;
    creditScope;
    financeScope;
    creditCompanyIds;
    financeCompanyIds;
    home_branch_id;
    homeBranchId;
    finance_partner_id;
    financePartnerId;
}
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], UpdateUserDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpdateUserDto.prototype, "isActive", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.UserRole),
    __metadata("design:type", String)
], UpdateUserDto.prototype, "role", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", Object)
], UpdateUserDto.prototype, "companyId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.OfficerScope),
    __metadata("design:type", String)
], UpdateUserDto.prototype, "creditScope", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.OfficerScope),
    __metadata("design:type", String)
], UpdateUserDto.prototype, "financeScope", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], UpdateUserDto.prototype, "creditCompanyIds", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], UpdateUserDto.prototype, "financeCompanyIds", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", Object)
], UpdateUserDto.prototype, "home_branch_id", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", Object)
], UpdateUserDto.prototype, "homeBranchId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", Object)
], UpdateUserDto.prototype, "finance_partner_id", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", Object)
], UpdateUserDto.prototype, "financePartnerId", void 0);
class CreateUserDto {
    email;
    name;
    role;
    companyId;
    creditScope;
    financeScope;
    creditCompanyIds;
    financeCompanyIds;
    home_branch_id;
    homeBranchId;
    finance_partner_id;
    financePartnerId;
}
__decorate([
    (0, class_validator_1.IsEmail)(),
    __metadata("design:type", String)
], CreateUserDto.prototype, "email", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateUserDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(client_1.UserRole),
    __metadata("design:type", String)
], CreateUserDto.prototype, "role", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateUserDto.prototype, "companyId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.OfficerScope),
    __metadata("design:type", String)
], CreateUserDto.prototype, "creditScope", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.OfficerScope),
    __metadata("design:type", String)
], CreateUserDto.prototype, "financeScope", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], CreateUserDto.prototype, "creditCompanyIds", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], CreateUserDto.prototype, "financeCompanyIds", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", Object)
], CreateUserDto.prototype, "home_branch_id", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", Object)
], CreateUserDto.prototype, "homeBranchId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", Object)
], CreateUserDto.prototype, "finance_partner_id", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", Object)
], CreateUserDto.prototype, "financePartnerId", void 0);
class InviteDealerAgentDto {
    email;
    name;
    home_branch_id;
    homeBranchId;
}
__decorate([
    (0, class_validator_1.IsEmail)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], InviteDealerAgentDto.prototype, "email", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], InviteDealerAgentDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", Object)
], InviteDealerAgentDto.prototype, "home_branch_id", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", Object)
], InviteDealerAgentDto.prototype, "homeBranchId", void 0);
class SetPasswordDto {
    password;
    sendEmail;
}
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(12),
    __metadata("design:type", String)
], SetPasswordDto.prototype, "password", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], SetPasswordDto.prototype, "sendEmail", void 0);
function requestedHomeBranch(dto) {
    const raw = dto.home_branch_id !== undefined ? dto.home_branch_id : dto.homeBranchId;
    if (raw === undefined)
        return undefined;
    return raw ? raw : null;
}
function requestedFinancePartner(dto) {
    const raw = dto.finance_partner_id !== undefined ? dto.finance_partner_id : dto.financePartnerId;
    if (raw === undefined)
        return undefined;
    return raw ? raw : null;
}
let UsersController = class UsersController {
    prisma;
    activity;
    mail;
    appConfig;
    auth;
    constructor(prisma, activity, mail, appConfig, auth) {
        this.prisma = prisma;
        this.activity = activity;
        this.mail = mail;
        this.appConfig = appConfig;
        this.auth = auth;
    }
    async list(actor, query) {
        const { limit, offset } = (0, pagination_dto_1.resolvePagination)(query, { defaultLimit: 50, maxLimit: 100 });
        const scopeIds = actor.role === client_1.UserRole.group_admin && actor.companyId
            ? await (0, company_hierarchy_1.resolveDescendantCompanyIds)(this.prisma, actor.companyId)
            : null;
        const where = scopeIds
            ? {
                OR: [
                    { companyId: { in: scopeIds } },
                    { creditCompanies: { some: { companyId: { in: scopeIds } } } },
                    { financeCompanies: { some: { companyId: { in: scopeIds } } } },
                ],
            }
            : {};
        const [items, total] = await Promise.all([
            this.prisma.user.findMany({
                where,
                select: {
                    id: true,
                    email: true,
                    name: true,
                    role: true,
                    companyId: true,
                    isActive: true,
                    emailVerified: true,
                    createdAt: true,
                    company: { select: { name: true } },
                    homeBranch: HOME_BRANCH_SELECT,
                    financePartner: FINANCE_PARTNER_SELECT,
                },
                orderBy: { createdAt: 'desc' },
                take: limit,
                skip: offset,
            }),
            this.prisma.user.count({ where }),
        ]);
        return (0, user_response_dto_1.toAdminUserListResponse)(items, total, limit, offset);
    }
    async one(actor, id) {
        const user = await this.prisma.user.findUnique({
            where: { id },
            include: {
                company: { select: { id: true, name: true } },
                homeBranch: HOME_BRANCH_SELECT,
                financePartner: FINANCE_PARTNER_SELECT,
                creditCompanies: { select: { companyId: true } },
                financeCompanies: { select: { companyId: true } },
                _count: { select: { applications: true, agentApplications: true } },
            },
        });
        if (!user)
            throw new common_1.NotFoundException();
        if (actor.role === client_1.UserRole.group_admin && actor.companyId) {
            const allowed = await (0, company_hierarchy_1.resolveDescendantCompanyIds)(this.prisma, actor.companyId);
            const inTree = (user.companyId && allowed.includes(user.companyId)) ||
                user.creditCompanies.some((r) => allowed.includes(r.companyId)) ||
                user.financeCompanies.some((r) => allowed.includes(r.companyId));
            if (!inTree)
                throw new common_1.NotFoundException();
        }
        return {
            ...(0, user_response_dto_1.toAdminUserDto)(user),
            company_name: user.company?.name ?? null,
            credit_scope: user.creditScope,
            finance_scope: user.financeScope,
            credit_company_ids: user.creditCompanies.map((r) => r.companyId),
            finance_company_ids: user.financeCompanies.map((r) => r.companyId),
            applications_count: user._count.applications,
            agent_applications_count: user._count.agentApplications,
        };
    }
    async create(actor, dto) {
        return this.provisionUser(actor, dto);
    }
    async inviteDealerAgent(actor, dto) {
        if (!actor.companyId)
            throw new common_1.ForbiddenException('no_company');
        return this.provisionUser(actor, {
            email: dto.email,
            name: dto.name,
            role: client_1.UserRole.dealer_agent,
            companyId: actor.companyId,
            home_branch_id: requestedHomeBranch(dto),
        });
    }
    async provisionUser(actor, dto) {
        (0, user_provisioning_policy_1.assertCanProvisionRole)(actor, dto.role);
        if (actor.role === client_1.UserRole.dealer_agent) {
            if (dto.role !== client_1.UserRole.dealer_agent || dto.companyId !== actor.companyId) {
                throw new common_1.ForbiddenException('forbidden_role');
            }
        }
        const email = dto.email.trim().toLowerCase();
        const existing = await this.prisma.user.findUnique({ where: { email } });
        if (existing)
            throw new common_1.BadRequestException('email_taken');
        if (dto.role === client_1.UserRole.dealer_agent && !dto.companyId) {
            throw new common_1.BadRequestException('dealer_requires_company');
        }
        if (dto.role === client_1.UserRole.group_admin && !dto.companyId) {
            throw new common_1.BadRequestException('group_admin_requires_holding');
        }
        let companyName = null;
        if (dto.companyId) {
            const company = await this.prisma.company.findUnique({ where: { id: dto.companyId } });
            if (!company)
                throw new common_1.BadRequestException('company_not_found');
            companyName = company.name;
            if (dto.role === client_1.UserRole.group_admin && company.kind !== client_1.CompanyKind.holding) {
                throw new common_1.BadRequestException('group_admin_requires_holding');
            }
            if (dto.role === client_1.UserRole.dealer_agent && company.kind === client_1.CompanyKind.holding) {
                throw new common_1.BadRequestException('dealer_requires_dealership');
            }
            if (actor.role === client_1.UserRole.group_admin && actor.companyId) {
                const allowed = await (0, company_hierarchy_1.resolveDescendantCompanyIds)(this.prisma, actor.companyId);
                if (!allowed.includes(dto.companyId))
                    throw new common_1.ForbiddenException('out_of_scope');
            }
        }
        const homeBranchId = await this.resolveHomeBranch(requestedHomeBranch(dto), dto.companyId ?? null);
        const financePartnerId = await this.resolveFinancePartner(dto.role, requestedFinancePartner(dto));
        const companyId = dto.role === client_1.UserRole.partner_viewer ? null : (dto.companyId ?? null);
        const officerCompanyIds = [
            ...(dto.creditCompanyIds ?? []),
            ...(dto.financeCompanyIds ?? []),
        ];
        if (officerCompanyIds.length) {
            const uniqueIds = [...new Set(officerCompanyIds)];
            const found = await this.prisma.company.findMany({
                where: { id: { in: uniqueIds } },
                select: { id: true },
            });
            if (found.length !== uniqueIds.length)
                throw new common_1.BadRequestException('company_not_found');
            if (actor.role === client_1.UserRole.group_admin && actor.companyId) {
                const allowed = await (0, company_hierarchy_1.resolveDescendantCompanyIds)(this.prisma, actor.companyId);
                if (uniqueIds.some((id) => !allowed.includes(id)))
                    throw new common_1.ForbiddenException('out_of_scope');
            }
        }
        const password = `Tmp!${(0, node_crypto_1.randomBytes)(18).toString('base64url')}`;
        const staffProvisioned = dto.role !== client_1.UserRole.customer;
        try {
            await this.auth.api.signUpEmail({
                body: { email, password, name: dto.name.trim() },
            });
        }
        catch {
            const raced = await this.prisma.user.findUnique({ where: { email } });
            if (raced)
                throw new common_1.BadRequestException('email_taken');
            throw new common_1.BadRequestException('user_create_failed');
        }
        const created = await this.prisma.user.findUnique({ where: { email } });
        if (!created)
            throw new common_1.BadRequestException('user_create_failed');
        const updated = await this.prisma.$transaction(async (tx) => {
            const next = await tx.user.update({
                where: { id: created.id },
                data: {
                    role: dto.role,
                    companyId,
                    homeBranchId: homeBranchId ?? null,
                    financePartnerId,
                    creditScope: dto.creditScope ?? undefined,
                    financeScope: dto.financeScope ?? undefined,
                    emailVerified: staffProvisioned,
                },
                include: { homeBranch: HOME_BRANCH_SELECT, financePartner: FINANCE_PARTNER_SELECT },
            });
            if (dto.creditCompanyIds?.length) {
                await tx.creditOfficerCompany.createMany({
                    data: dto.creditCompanyIds.map((companyId) => ({ userId: next.id, companyId })),
                    skipDuplicates: true,
                });
            }
            if (dto.financeCompanyIds?.length) {
                await tx.financeOfficerCompany.createMany({
                    data: dto.financeCompanyIds.map((companyId) => ({ userId: next.id, companyId })),
                    skipDuplicates: true,
                });
            }
            return next;
        });
        const loginUrl = this.signInUrlFor(dto.role);
        if (staffProvisioned) {
            try {
                if (dto.role === client_1.UserRole.dealer_agent && companyName) {
                    await this.mail.sendDealerAgentWelcomeEmail({
                        to: email,
                        name: dto.name.trim(),
                        loginUrl,
                        temporaryPassword: password,
                        dealerName: companyName,
                    });
                }
                else {
                    await this.mail.sendStaffAccountCreatedEmail(email, dto.name.trim(), loginUrl);
                }
            }
            catch {
            }
        }
        else {
            try {
                await this.auth.api.requestPasswordReset({
                    body: { email, redirectTo: this.appConfig.marketplacePath('/auth/reset-password') },
                });
            }
            catch {
                await this.mail.sendWalkInInviteEmail(email, this.appConfig.marketplacePath('/auth/forgot-password'), 'Blox');
            }
        }
        await this.activity.log({
            actorUserId: actor.id,
            entityType: 'user',
            entityId: updated.id,
            action: 'user_created',
            toValue: updated.role,
            metadata: homeBranchId || financePartnerId
                ? { ...(homeBranchId ? { homeBranchId } : {}), ...(financePartnerId ? { financePartnerId } : {}) }
                : undefined,
        });
        return (0, user_response_dto_1.toAdminUserProvisionDto)(updated, {
            temporaryPassword: password,
            loginUrl,
            companyName,
        });
    }
    async update(actor, id, dto) {
        const target = await this.prisma.user.findUnique({ where: { id } });
        if (!target)
            throw new common_1.NotFoundException();
        (0, user_provisioning_policy_1.assertCanManageUserRole)(actor, target.role, dto.role);
        if (target.id === actor.id && (dto.isActive === false || (dto.role && dto.role !== actor.role))) {
            throw new common_1.BadRequestException('cannot_modify_own_access');
        }
        if (dto.companyId) {
            const company = await this.prisma.company.findUnique({ where: { id: dto.companyId } });
            if (!company)
                throw new common_1.BadRequestException('company_not_found');
            const nextRole = dto.role ?? target.role;
            if (nextRole === client_1.UserRole.group_admin && company.kind !== client_1.CompanyKind.holding) {
                throw new common_1.BadRequestException('group_admin_requires_holding');
            }
            if (nextRole === client_1.UserRole.dealer_agent && company.kind === client_1.CompanyKind.holding) {
                throw new common_1.BadRequestException('dealer_requires_dealership');
            }
            if (actor.role === client_1.UserRole.group_admin && actor.companyId) {
                const allowed = await (0, company_hierarchy_1.resolveDescendantCompanyIds)(this.prisma, actor.companyId);
                if (!allowed.includes(dto.companyId))
                    throw new common_1.ForbiddenException('out_of_scope');
            }
        }
        const nextCompanyId = dto.companyId === undefined ? target.companyId : dto.companyId;
        let homeBranchId = await this.resolveHomeBranch(requestedHomeBranch(dto), nextCompanyId);
        if (homeBranchId === undefined && dto.companyId !== undefined && dto.companyId !== target.companyId) {
            homeBranchId = null;
        }
        const nextRole = dto.role ?? target.role;
        const requestedPartner = requestedFinancePartner(dto);
        let financePartnerId;
        if (nextRole === client_1.UserRole.partner_viewer) {
            const effective = requestedPartner === undefined ? target.financePartnerId : requestedPartner;
            financePartnerId = await this.resolveFinancePartner(nextRole, effective);
        }
        else if (target.financePartnerId || requestedPartner) {
            financePartnerId = null;
        }
        const updated = await this.prisma.$transaction(async (tx) => {
            const next = await tx.user.update({
                where: { id },
                data: {
                    name: dto.name?.trim() ?? undefined,
                    isActive: dto.isActive ?? undefined,
                    role: dto.role ?? undefined,
                    companyId: dto.companyId === undefined ? undefined : dto.companyId,
                    homeBranchId: homeBranchId === undefined ? undefined : homeBranchId,
                    financePartnerId: financePartnerId === undefined ? undefined : financePartnerId,
                    creditScope: dto.creditScope ?? undefined,
                    financeScope: dto.financeScope ?? undefined,
                },
                include: { homeBranch: HOME_BRANCH_SELECT, financePartner: FINANCE_PARTNER_SELECT },
            });
            if (dto.creditCompanyIds) {
                await tx.creditOfficerCompany.deleteMany({ where: { userId: id } });
                if (dto.creditCompanyIds.length) {
                    await tx.creditOfficerCompany.createMany({
                        data: dto.creditCompanyIds.map((companyId) => ({ userId: id, companyId })),
                    });
                }
            }
            if (dto.financeCompanyIds) {
                await tx.financeOfficerCompany.deleteMany({ where: { userId: id } });
                if (dto.financeCompanyIds.length) {
                    await tx.financeOfficerCompany.createMany({
                        data: dto.financeCompanyIds.map((companyId) => ({ userId: id, companyId })),
                    });
                }
            }
            if (dto.isActive === false) {
                await tx.session.deleteMany({ where: { userId: id } });
            }
            return next;
        });
        await this.activity.log({
            actorUserId: actor.id,
            entityType: 'user',
            entityId: id,
            action: 'user_updated',
            fromValue: `${target.role}:${target.isActive ? 'active' : 'suspended'}`,
            toValue: `${updated.role}:${updated.isActive ? 'active' : 'suspended'}`,
            metadata: {
                changes: {
                    ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
                    ...(dto.role !== undefined ? { role: dto.role } : {}),
                    ...(dto.companyId !== undefined ? { companyId: dto.companyId } : {}),
                    ...(homeBranchId !== undefined ? { homeBranchId } : {}),
                    ...(financePartnerId !== undefined ? { financePartnerId } : {}),
                    ...(dto.creditScope !== undefined ? { creditScope: dto.creditScope } : {}),
                    ...(dto.financeScope !== undefined ? { financeScope: dto.financeScope } : {}),
                },
            },
        });
        return (0, user_response_dto_1.toAdminUserUpdateDto)(updated);
    }
    async setPassword(actor, id, dto) {
        const target = await this.loadManagedUser(actor, id);
        if (target.id === actor.id)
            throw new common_1.BadRequestException('cannot_modify_own_access');
        const password = dto.password?.trim() || `Tmp!${(0, node_crypto_1.randomBytes)(18).toString('base64url')}`;
        const ctx = await this.auth.$context;
        const hash = await ctx.password.hash(password);
        await ctx.internalAdapter.updatePassword(target.id, hash);
        await this.prisma.$transaction(async (tx) => {
            await tx.session.deleteMany({ where: { userId: target.id } });
            await tx.mobileRefreshToken.updateMany({
                where: { userId: target.id, revokedAt: null },
                data: { revokedAt: new Date() },
            });
        });
        const loginUrl = this.signInUrlFor(target.role);
        if (dto.sendEmail !== false) {
            try {
                await this.mail.sendAdminPasswordResetEmail({
                    to: target.email,
                    name: target.name,
                    loginUrl,
                    temporaryPassword: password,
                });
            }
            catch {
            }
        }
        await this.activity.log({
            actorUserId: actor.id,
            entityType: 'user',
            entityId: target.id,
            action: 'user_password_reset',
            metadata: { emailed: dto.sendEmail !== false },
        });
        return (0, user_response_dto_1.toAdminUserProvisionDto)(target, {
            temporaryPassword: password,
            loginUrl,
            companyName: target.company?.name ?? null,
        });
    }
    async remove(actor, id) {
        const target = await this.loadManagedUser(actor, id);
        if (target.id === actor.id)
            throw new common_1.BadRequestException('cannot_modify_own_access');
        try {
            await this.prisma.$transaction(async (tx) => {
                await tx.creditOfficerCompany.deleteMany({ where: { userId: id } });
                await tx.financeOfficerCompany.deleteMany({ where: { userId: id } });
                await tx.session.deleteMany({ where: { userId: id } });
                await tx.mobileRefreshToken.deleteMany({ where: { userId: id } });
                await tx.deviceToken.deleteMany({ where: { userId: id } });
                await tx.account.deleteMany({ where: { userId: id } });
                await tx.user.delete({ where: { id } });
            });
        }
        catch (err) {
            if ((0, prisma_errors_1.isForeignKeyConstraintError)(err)) {
                throw new common_1.BadRequestException('user_has_dependencies');
            }
            throw err;
        }
        await this.activity.log({
            actorUserId: actor.id,
            entityType: 'user',
            entityId: id,
            action: 'user_deleted',
            fromValue: target.email,
        });
        return { ok: true };
    }
    async resolveHomeBranch(requested, companyId) {
        if (requested === undefined)
            return undefined;
        if (requested === null)
            return null;
        const branch = await this.prisma.branch.findUnique({
            where: { id: requested },
            select: { id: true, companyId: true },
        });
        (0, user_provisioning_policy_1.assertHomeBranchInCompany)(branch, companyId);
        return requested;
    }
    async resolveFinancePartner(role, requested) {
        if (role !== client_1.UserRole.partner_viewer)
            return null;
        const partner = requested
            ? await this.prisma.financePartner.findUnique({ where: { id: requested }, select: { id: true } })
            : null;
        return (0, user_provisioning_policy_1.assertPartnerViewerAssignment)(role, partner, requested);
    }
    signInUrlFor(role) {
        return role === client_1.UserRole.partner_viewer
            ? `${this.appConfig.financeUrl}/auth/sign-in`
            : this.appConfig.portalSignInUrl(role);
    }
    async loadManagedUser(actor, id) {
        const target = await this.prisma.user.findUnique({
            where: { id },
            include: {
                company: { select: { name: true } },
                homeBranch: HOME_BRANCH_SELECT,
                financePartner: FINANCE_PARTNER_SELECT,
            },
        });
        if (!target)
            throw new common_1.NotFoundException();
        (0, user_provisioning_policy_1.assertCanManageUserRole)(actor, target.role);
        if (actor.role === client_1.UserRole.group_admin && actor.companyId) {
            const allowed = await (0, company_hierarchy_1.resolveDescendantCompanyIds)(this.prisma, actor.companyId);
            const inTree = (target.companyId && allowed.includes(target.companyId)) ||
                (await this.prisma.creditOfficerCompany.count({
                    where: { userId: id, companyId: { in: allowed } },
                })) > 0 ||
                (await this.prisma.financeOfficerCompany.count({
                    where: { userId: id, companyId: { in: allowed } },
                })) > 0;
            if (!inTree)
                throw new common_1.NotFoundException();
        }
        return target;
    }
};
exports.UsersController = UsersController;
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.admin, client_1.UserRole.super_admin, client_1.UserRole.group_admin),
    (0, common_1.Get)(),
    __param(0, (0, guards_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, pagination_dto_1.PaginationQueryDto]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "list", null);
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.admin, client_1.UserRole.super_admin, client_1.UserRole.group_admin),
    (0, common_1.Get)(':id'),
    __param(0, (0, guards_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "one", null);
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.admin, client_1.UserRole.super_admin, client_1.UserRole.group_admin),
    (0, common_1.Post)(),
    __param(0, (0, guards_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, CreateUserDto]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "create", null);
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.dealer_agent),
    (0, common_1.Post)('dealer-agents'),
    __param(0, (0, guards_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, InviteDealerAgentDto]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "inviteDealerAgent", null);
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.admin, client_1.UserRole.super_admin, client_1.UserRole.group_admin),
    (0, common_1.Patch)(':id'),
    __param(0, (0, guards_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, UpdateUserDto]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "update", null);
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.admin, client_1.UserRole.super_admin, client_1.UserRole.group_admin),
    (0, common_1.Post)(':id/set-password'),
    __param(0, (0, guards_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, SetPasswordDto]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "setPassword", null);
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.admin, client_1.UserRole.super_admin, client_1.UserRole.group_admin),
    (0, common_1.Delete)(':id'),
    __param(0, (0, guards_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "remove", null);
exports.UsersController = UsersController = __decorate([
    (0, common_1.Controller)('users'),
    __param(4, (0, common_1.Inject)(auth_constants_1.AUTH_INSTANCE)),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        activity_service_1.ActivityService,
        mail_service_1.MailService,
        app_config_service_1.AppConfigService, Object])
], UsersController);
//# sourceMappingURL=users.controller.js.map