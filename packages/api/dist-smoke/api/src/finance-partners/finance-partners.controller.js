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
exports.FinancePartnersController = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const class_validator_1 = require("class-validator");
const guards_1 = require("../auth/guards");
const activity_service_1 = require("../common/activity.service");
const prisma_errors_1 = require("../common/prisma-errors");
const prisma_service_1 = require("../prisma/prisma.service");
const default_lender_1 = require("./default-lender");
const finance_partner_response_dto_1 = require("./finance-partner-response.dto");
const CODE_PATTERN = /^[a-z0-9][a-z0-9_-]*$/i;
class CreateFinancePartnerDto {
    code;
    name;
    engagement_mode;
    bre_ownership;
    is_default_lender;
    contact_name;
    contact_email;
    contact_phone;
    notes;
    active;
    crm_adapter;
}
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.MaxLength)(40),
    (0, class_validator_1.Matches)(CODE_PATTERN),
    __metadata("design:type", String)
], CreateFinancePartnerDto.prototype, "code", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], CreateFinancePartnerDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(client_1.FinancePartnerEngagementMode),
    __metadata("design:type", String)
], CreateFinancePartnerDto.prototype, "engagement_mode", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(client_1.BreOwnership),
    __metadata("design:type", String)
], CreateFinancePartnerDto.prototype, "bre_ownership", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreateFinancePartnerDto.prototype, "is_default_lender", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", Object)
], CreateFinancePartnerDto.prototype, "contact_name", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(160),
    __metadata("design:type", Object)
], CreateFinancePartnerDto.prototype, "contact_email", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(40),
    __metadata("design:type", Object)
], CreateFinancePartnerDto.prototype, "contact_phone", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(2000),
    __metadata("design:type", Object)
], CreateFinancePartnerDto.prototype, "notes", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreateFinancePartnerDto.prototype, "active", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.CrmAdapter),
    __metadata("design:type", String)
], CreateFinancePartnerDto.prototype, "crm_adapter", void 0);
class UpdateFinancePartnerDto {
    code;
    name;
    engagement_mode;
    bre_ownership;
    is_default_lender;
    contact_name;
    contact_email;
    contact_phone;
    notes;
    active;
    crm_adapter;
}
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.MaxLength)(40),
    (0, class_validator_1.Matches)(CODE_PATTERN),
    __metadata("design:type", String)
], UpdateFinancePartnerDto.prototype, "code", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], UpdateFinancePartnerDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.FinancePartnerEngagementMode),
    __metadata("design:type", String)
], UpdateFinancePartnerDto.prototype, "engagement_mode", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.BreOwnership),
    __metadata("design:type", String)
], UpdateFinancePartnerDto.prototype, "bre_ownership", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpdateFinancePartnerDto.prototype, "is_default_lender", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", Object)
], UpdateFinancePartnerDto.prototype, "contact_name", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(160),
    __metadata("design:type", Object)
], UpdateFinancePartnerDto.prototype, "contact_email", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(40),
    __metadata("design:type", Object)
], UpdateFinancePartnerDto.prototype, "contact_phone", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(2000),
    __metadata("design:type", Object)
], UpdateFinancePartnerDto.prototype, "notes", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpdateFinancePartnerDto.prototype, "active", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.CrmAdapter),
    __metadata("design:type", String)
], UpdateFinancePartnerDto.prototype, "crm_adapter", void 0);
class CreateFinancePartnerBranchDto {
    code;
    name;
    city;
}
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.MaxLength)(32),
    __metadata("design:type", String)
], CreateFinancePartnerBranchDto.prototype, "code", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], CreateFinancePartnerBranchDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(80),
    __metadata("design:type", Object)
], CreateFinancePartnerBranchDto.prototype, "city", void 0);
class UpdateFinancePartnerBranchDto {
    name;
    city;
    active;
}
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], UpdateFinancePartnerBranchDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(80),
    __metadata("design:type", Object)
], UpdateFinancePartnerBranchDto.prototype, "city", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpdateFinancePartnerBranchDto.prototype, "active", void 0);
const READ_ROLES = [
    client_1.UserRole.admin,
    client_1.UserRole.super_admin,
    client_1.UserRole.group_admin,
    client_1.UserRole.credit_officer,
    client_1.UserRole.finance_officer,
    client_1.UserRole.dealer_agent,
];
function optionalText(value) {
    if (value == null)
        return null;
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
}
let FinancePartnersController = class FinancePartnersController {
    prisma;
    activity;
    constructor(prisma, activity) {
        this.prisma = prisma;
        this.activity = activity;
    }
    async list() {
        const rows = await this.prisma.financePartner.findMany({
            include: finance_partner_response_dto_1.FINANCE_PARTNER_INCLUDE,
            orderBy: [{ isDefaultLender: 'desc' }, { name: 'asc' }],
        });
        return rows.map((row) => (0, finance_partner_response_dto_1.toFinancePartnerAdminDto)(row));
    }
    async create(user, dto) {
        const code = dto.code.trim().toLowerCase();
        const active = dto.active ?? true;
        const isDefault = dto.is_default_lender ?? false;
        (0, default_lender_1.assertDefaultLenderEligible)({ active }, isDefault);
        let created;
        try {
            created = await this.prisma.$transaction(async (tx) => {
                if (isDefault) {
                    const partners = await tx.financePartner.findMany({
                        select: { id: true, isDefaultLender: true },
                    });
                    const plan = (0, default_lender_1.planDefaultLenderSwitch)(partners, '__new__', true);
                    if (plan.clearIds.length) {
                        await tx.financePartner.updateMany({
                            where: { id: { in: plan.clearIds } },
                            data: { isDefaultLender: false },
                        });
                    }
                }
                return tx.financePartner.create({
                    data: {
                        code,
                        name: dto.name.trim(),
                        active,
                        crmAdapter: dto.crm_adapter ?? client_1.CrmAdapter.none,
                        engagementMode: dto.engagement_mode,
                        breOwnership: dto.bre_ownership,
                        isDefaultLender: isDefault,
                        contactName: optionalText(dto.contact_name),
                        contactEmail: optionalText(dto.contact_email),
                        contactPhone: optionalText(dto.contact_phone),
                        notes: optionalText(dto.notes),
                    },
                    include: finance_partner_response_dto_1.FINANCE_PARTNER_INCLUDE,
                });
            });
        }
        catch (err) {
            if ((0, prisma_errors_1.isUniqueConstraintError)(err))
                throw new common_1.ConflictException('finance_partner_code_exists');
            throw err;
        }
        await this.activity.log({
            actorUserId: user.id,
            entityType: 'finance_partner',
            entityId: created.id,
            action: 'finance_partner_created',
            toValue: created.code,
            metadata: {
                engagement_mode: created.engagementMode,
                bre_ownership: created.breOwnership,
                is_default_lender: created.isDefaultLender,
            },
        });
        if (isDefault) {
            await this.activity.log({
                actorUserId: user.id,
                entityType: 'finance_partner',
                entityId: created.id,
                action: 'default_lender_set',
                toValue: created.code,
            });
        }
        return (0, finance_partner_response_dto_1.toFinancePartnerAdminDto)(created);
    }
    async update(user, id, dto) {
        const existing = await this.prisma.financePartner.findUnique({ where: { id } });
        if (!existing)
            throw new common_1.NotFoundException('finance_partner_not_found');
        const nextActive = dto.active ?? existing.active;
        const nextDefault = dto.is_default_lender ?? existing.isDefaultLender;
        (0, default_lender_1.assertDefaultLenderEligible)({ active: nextActive }, nextDefault);
        const changes = {
            ...(dto.code !== undefined ? { code: dto.code.trim().toLowerCase() } : {}),
            ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
            ...(dto.engagement_mode !== undefined ? { engagementMode: dto.engagement_mode } : {}),
            ...(dto.bre_ownership !== undefined ? { breOwnership: dto.bre_ownership } : {}),
            ...(dto.contact_name !== undefined ? { contactName: optionalText(dto.contact_name) } : {}),
            ...(dto.contact_email !== undefined ? { contactEmail: optionalText(dto.contact_email) } : {}),
            ...(dto.contact_phone !== undefined ? { contactPhone: optionalText(dto.contact_phone) } : {}),
            ...(dto.notes !== undefined ? { notes: optionalText(dto.notes) } : {}),
            ...(dto.active !== undefined ? { active: dto.active } : {}),
            ...(dto.crm_adapter !== undefined ? { crmAdapter: dto.crm_adapter } : {}),
        };
        let plan = {
            clearIds: [],
            targetIsDefault: existing.isDefaultLender,
            changed: false,
        };
        let updated;
        try {
            updated = await this.prisma.$transaction(async (tx) => {
                const partners = await tx.financePartner.findMany({
                    select: { id: true, isDefaultLender: true },
                });
                plan = (0, default_lender_1.planDefaultLenderSwitch)(partners, id, dto.is_default_lender);
                if (plan.clearIds.length) {
                    await tx.financePartner.updateMany({
                        where: { id: { in: plan.clearIds } },
                        data: { isDefaultLender: false },
                    });
                }
                return tx.financePartner.update({
                    where: { id },
                    data: {
                        ...changes,
                        ...(dto.is_default_lender !== undefined ? { isDefaultLender: plan.targetIsDefault } : {}),
                    },
                    include: finance_partner_response_dto_1.FINANCE_PARTNER_INCLUDE,
                });
            });
        }
        catch (err) {
            if ((0, prisma_errors_1.isUniqueConstraintError)(err))
                throw new common_1.ConflictException('finance_partner_code_exists');
            throw err;
        }
        await this.activity.log({
            actorUserId: user.id,
            entityType: 'finance_partner',
            entityId: id,
            action: 'finance_partner_updated',
            fromValue: existing.active ? 'active' : 'inactive',
            toValue: updated.active ? 'active' : 'inactive',
            metadata: {
                changes: {
                    ...changes,
                    ...(dto.is_default_lender !== undefined ? { isDefaultLender: plan.targetIsDefault } : {}),
                },
            },
        });
        if (dto.is_default_lender !== undefined && plan.changed) {
            await this.activity.log({
                actorUserId: user.id,
                entityType: 'finance_partner',
                entityId: id,
                action: plan.targetIsDefault ? 'default_lender_set' : 'default_lender_cleared',
                fromValue: existing.isDefaultLender ? existing.code : null,
                toValue: plan.targetIsDefault ? updated.code : null,
                metadata: plan.clearIds.length ? { cleared_partner_ids: plan.clearIds } : undefined,
            });
        }
        return (0, finance_partner_response_dto_1.toFinancePartnerAdminDto)(updated);
    }
    async createBranch(user, id, dto) {
        await this.requirePartner(id);
        let branch;
        try {
            branch = await this.prisma.financePartnerBranch.create({
                data: {
                    partnerId: id,
                    code: dto.code.trim(),
                    name: dto.name.trim(),
                    city: optionalText(dto.city),
                },
            });
        }
        catch (err) {
            if ((0, prisma_errors_1.isUniqueConstraintError)(err)) {
                throw new common_1.ConflictException('finance_partner_branch_code_exists');
            }
            throw err;
        }
        await this.activity.log({
            actorUserId: user.id,
            entityType: 'finance_partner_branch',
            entityId: branch.id,
            action: 'finance_partner_branch_created',
            toValue: branch.code,
            metadata: { partner_id: id, name: branch.name },
        });
        return (0, finance_partner_response_dto_1.toFinancePartnerBranchDto)(branch);
    }
    async updateBranch(user, id, branchId, dto) {
        const existing = await this.prisma.financePartnerBranch.findFirst({
            where: { id: branchId, partnerId: id },
        });
        if (!existing)
            throw new common_1.NotFoundException('finance_partner_branch_not_found');
        const changes = {
            ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
            ...(dto.city !== undefined ? { city: optionalText(dto.city) } : {}),
            ...(dto.active !== undefined ? { active: dto.active } : {}),
        };
        const branch = await this.prisma.financePartnerBranch.update({
            where: { id: existing.id },
            data: changes,
        });
        await this.activity.log({
            actorUserId: user.id,
            entityType: 'finance_partner_branch',
            entityId: branch.id,
            action: 'finance_partner_branch_updated',
            fromValue: existing.active ? 'active' : 'inactive',
            toValue: branch.active ? 'active' : 'inactive',
            metadata: { partner_id: id, changes },
        });
        return (0, finance_partner_response_dto_1.toFinancePartnerBranchDto)(branch);
    }
    async requirePartner(id) {
        const partner = await this.prisma.financePartner.findUnique({
            where: { id },
            select: { id: true },
        });
        if (!partner)
            throw new common_1.NotFoundException('finance_partner_not_found');
        return partner;
    }
};
exports.FinancePartnersController = FinancePartnersController;
__decorate([
    (0, guards_1.Roles)(...READ_ROLES),
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], FinancePartnersController.prototype, "list", null);
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.admin, client_1.UserRole.super_admin),
    (0, common_1.Post)(),
    __param(0, (0, guards_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, CreateFinancePartnerDto]),
    __metadata("design:returntype", Promise)
], FinancePartnersController.prototype, "create", null);
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.admin, client_1.UserRole.super_admin),
    (0, common_1.Patch)(':id'),
    __param(0, (0, guards_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, UpdateFinancePartnerDto]),
    __metadata("design:returntype", Promise)
], FinancePartnersController.prototype, "update", null);
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.admin, client_1.UserRole.super_admin),
    (0, common_1.Post)(':id/branches'),
    __param(0, (0, guards_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, CreateFinancePartnerBranchDto]),
    __metadata("design:returntype", Promise)
], FinancePartnersController.prototype, "createBranch", null);
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.admin, client_1.UserRole.super_admin),
    (0, common_1.Patch)(':id/branches/:branchId'),
    __param(0, (0, guards_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Param)('branchId')),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, UpdateFinancePartnerBranchDto]),
    __metadata("design:returntype", Promise)
], FinancePartnersController.prototype, "updateBranch", null);
exports.FinancePartnersController = FinancePartnersController = __decorate([
    (0, common_1.Controller)('finance-partners'),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        activity_service_1.ActivityService])
], FinancePartnersController);
//# sourceMappingURL=finance-partners.controller.js.map