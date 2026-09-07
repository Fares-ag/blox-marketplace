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
exports.CompaniesController = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const guards_1 = require("../auth/guards");
const activity_service_1 = require("../common/activity.service");
const pagination_dto_1 = require("../common/pagination.dto");
const prisma_errors_1 = require("../common/prisma-errors");
const prisma_service_1 = require("../prisma/prisma.service");
const branch_response_dto_1 = require("./branch-response.dto");
const branding_1 = require("./branding");
const company_response_dto_1 = require("./company-response.dto");
const company_hierarchy_1 = require("./company-hierarchy");
class CreateCompanyDto {
    name;
    code;
    contactEmail;
    dealerUserId;
    kind;
    parentCompanyId;
}
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateCompanyDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateCompanyDto.prototype, "code", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateCompanyDto.prototype, "contactEmail", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateCompanyDto.prototype, "dealerUserId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.CompanyKind),
    __metadata("design:type", String)
], CreateCompanyDto.prototype, "kind", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateCompanyDto.prototype, "parentCompanyId", void 0);
class CompanyBrandingDto {
    primary;
    accent;
    logo_url;
    display_name;
    tagline;
}
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(16),
    __metadata("design:type", Object)
], CompanyBrandingDto.prototype, "primary", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(16),
    __metadata("design:type", Object)
], CompanyBrandingDto.prototype, "accent", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(2048),
    __metadata("design:type", Object)
], CompanyBrandingDto.prototype, "logo_url", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(80),
    __metadata("design:type", Object)
], CompanyBrandingDto.prototype, "display_name", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(160),
    __metadata("design:type", Object)
], CompanyBrandingDto.prototype, "tagline", void 0);
class UpdateCompanyDto {
    name;
    code;
    description;
    status;
    allowDirectActivate;
    canPay;
    kind;
    parentCompanyId;
    branding;
}
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateCompanyDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateCompanyDto.prototype, "code", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateCompanyDto.prototype, "description", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateCompanyDto.prototype, "status", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpdateCompanyDto.prototype, "allowDirectActivate", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpdateCompanyDto.prototype, "canPay", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.CompanyKind),
    __metadata("design:type", String)
], UpdateCompanyDto.prototype, "kind", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", Object)
], UpdateCompanyDto.prototype, "parentCompanyId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => CompanyBrandingDto),
    __metadata("design:type", CompanyBrandingDto)
], UpdateCompanyDto.prototype, "branding", void 0);
class CreateBranchDto {
    code;
    name;
    city;
    address;
    phone;
}
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.MaxLength)(32),
    __metadata("design:type", String)
], CreateBranchDto.prototype, "code", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], CreateBranchDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(80),
    __metadata("design:type", String)
], CreateBranchDto.prototype, "city", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(240),
    __metadata("design:type", String)
], CreateBranchDto.prototype, "address", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(32),
    __metadata("design:type", String)
], CreateBranchDto.prototype, "phone", void 0);
class UpdateBranchDto {
    name;
    city;
    address;
    phone;
    active;
}
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], UpdateBranchDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(80),
    __metadata("design:type", Object)
], UpdateBranchDto.prototype, "city", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(240),
    __metadata("design:type", Object)
], UpdateBranchDto.prototype, "address", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(32),
    __metadata("design:type", Object)
], UpdateBranchDto.prototype, "phone", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpdateBranchDto.prototype, "active", void 0);
function optionalText(value) {
    if (value == null)
        return null;
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
}
let CompaniesController = class CompaniesController {
    prisma;
    activity;
    constructor(prisma, activity) {
        this.prisma = prisma;
        this.activity = activity;
    }
    async listPublic(query) {
        const { limit, offset } = (0, pagination_dto_1.resolvePagination)(query, { defaultLimit: 50, maxLimit: 100 });
        const where = { status: 'active', kind: client_1.CompanyKind.dealership };
        const [rows, total] = await Promise.all([
            this.prisma.company.findMany({
                where,
                select: {
                    id: true,
                    name: true,
                    code: true,
                    logoUrl: true,
                    _count: {
                        select: {
                            products: { where: { listingStatus: 'published' } },
                        },
                    },
                },
                orderBy: { name: 'asc' },
                take: limit,
                skip: offset,
            }),
            this.prisma.company.count({ where }),
        ]);
        return (0, pagination_dto_1.toPaginatedResponse)(rows.map((c) => ({
            id: c.id,
            name: c.name,
            code: c.code,
            logo_url: c.logoUrl,
            published_count: c._count.products,
        })), total, limit, offset);
    }
    async byCode(code) {
        const company = await this.prisma.company.findFirst({
            where: { code, status: 'active' },
            select: {
                id: true,
                name: true,
                code: true,
                logoUrl: true,
                branding: true,
                address: true,
                contactPhone: true,
                _count: {
                    select: {
                        products: { where: { listingStatus: 'published' } },
                    },
                },
            },
        });
        if (!company)
            return null;
        return (0, company_response_dto_1.toPublicCompanyDetailDto)({
            ...company,
            published_count: company._count.products,
        });
    }
    async listAll(user, query) {
        const { limit, offset } = (0, pagination_dto_1.resolvePagination)(query, { defaultLimit: 50, maxLimit: 100 });
        const scopeIds = user.role === client_1.UserRole.group_admin && user.companyId
            ? await (0, company_hierarchy_1.resolveDescendantCompanyIds)(this.prisma, user.companyId)
            : null;
        const where = scopeIds ? { id: { in: scopeIds } } : {};
        const [items, total] = await Promise.all([
            this.prisma.company.findMany({
                where,
                include: {
                    parentCompany: { select: { id: true, name: true } },
                    _count: { select: { childCompanies: true } },
                },
                orderBy: [{ kind: 'asc' }, { name: 'asc' }],
                take: limit,
                skip: offset,
            }),
            this.prisma.company.count({ where }),
        ]);
        return (0, pagination_dto_1.toPaginatedResponse)(items.map((item) => (0, company_response_dto_1.toAdminCompanyDto)(item)), total, limit, offset);
    }
    async create(user, dto) {
        const kind = dto.kind ?? client_1.CompanyKind.dealership;
        let parentCompanyId = dto.parentCompanyId ?? null;
        if (user.role === client_1.UserRole.group_admin) {
            if (kind === client_1.CompanyKind.holding)
                throw new common_1.ForbiddenException('forbidden_role');
            if (!user.companyId)
                throw new common_1.ForbiddenException('forbidden_role');
            parentCompanyId = user.companyId;
        }
        await (0, company_hierarchy_1.assertValidCompanyHierarchy)(this.prisma, { kind, parentCompanyId });
        const company = await this.prisma.company.create({
            data: {
                name: dto.name,
                code: dto.code,
                contactEmail: dto.contactEmail,
                status: 'active',
                kind,
                parentCompanyId,
            },
            include: {
                parentCompany: { select: { id: true, name: true } },
                _count: { select: { childCompanies: true } },
            },
        });
        if (dto.dealerUserId) {
            await this.prisma.user.update({
                where: { id: dto.dealerUserId },
                data: { role: client_1.UserRole.dealer_agent, companyId: company.id },
            });
        }
        return (0, company_response_dto_1.toAdminCompanyDto)(company);
    }
    async update(user, id, dto) {
        const existing = await this.prisma.company.findUnique({ where: { id } });
        if (!existing)
            throw new common_1.NotFoundException();
        if (user.role === client_1.UserRole.group_admin) {
            if (!user.companyId)
                throw new common_1.ForbiddenException('forbidden_role');
            const allowed = await (0, company_hierarchy_1.resolveDescendantCompanyIds)(this.prisma, user.companyId);
            if (!allowed.includes(id) || id === user.companyId) {
                throw new common_1.ForbiddenException('forbidden_role');
            }
        }
        const nextKind = dto.kind ?? existing.kind;
        const nextParent = dto.parentCompanyId === undefined ? existing.parentCompanyId : dto.parentCompanyId;
        await (0, company_hierarchy_1.assertValidCompanyHierarchy)(this.prisma, {
            kind: nextKind,
            parentCompanyId: nextParent,
        });
        if (nextParent === id)
            throw new common_1.BadRequestException('company_cannot_parent_self');
        const branding = dto.branding !== undefined ? (0, branding_1.mergeBranding)(existing.branding, dto.branding) : undefined;
        const company = await this.prisma.company.update({
            where: { id },
            data: {
                ...(dto.name !== undefined ? { name: dto.name } : {}),
                ...(dto.code !== undefined ? { code: dto.code } : {}),
                ...(dto.status !== undefined ? { status: dto.status } : {}),
                ...(dto.kind !== undefined ? { kind: dto.kind } : {}),
                ...(dto.parentCompanyId !== undefined ? { parentCompanyId: dto.parentCompanyId } : {}),
                ...(dto.allowDirectActivate !== undefined
                    ? { allowDirectActivate: dto.allowDirectActivate }
                    : {}),
                ...(dto.canPay !== undefined ? { canPay: dto.canPay } : {}),
                ...(branding !== undefined
                    ? { branding: branding ? branding : client_1.Prisma.DbNull }
                    : {}),
            },
            include: {
                parentCompany: { select: { id: true, name: true } },
                _count: { select: { childCompanies: true } },
            },
        });
        if (branding !== undefined) {
            await this.activity.log({
                actorUserId: user.id,
                entityType: 'company',
                entityId: id,
                action: 'company_branding_updated',
                metadata: { branding },
            });
        }
        return (0, company_response_dto_1.toAdminCompanyDto)(company);
    }
    async children(user, id) {
        if (user.role === client_1.UserRole.group_admin) {
            if (user.companyId !== id)
                throw new common_1.ForbiddenException('forbidden_role');
        }
        const items = await this.prisma.company.findMany({
            where: { parentCompanyId: id },
            include: {
                parentCompany: { select: { id: true, name: true } },
                _count: { select: { childCompanies: true } },
            },
            orderBy: { name: 'asc' },
        });
        return { items: items.map((item) => (0, company_response_dto_1.toAdminCompanyDto)(item)) };
    }
    async agents(user, id) {
        if (user.role === client_1.UserRole.dealer_agent && user.companyId !== id) {
            return { items: [] };
        }
        if (user.role === client_1.UserRole.group_admin) {
            const allowed = user.companyId
                ? await (0, company_hierarchy_1.resolveDescendantCompanyIds)(this.prisma, user.companyId)
                : [];
            if (!allowed.includes(id))
                return { items: [] };
        }
        const agents = await this.prisma.user.findMany({
            where: { companyId: id, role: client_1.UserRole.dealer_agent, isActive: true },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                homeBranch: { select: { id: true, code: true, name: true } },
            },
            orderBy: { name: 'asc' },
        });
        return {
            items: agents.map(({ homeBranch, ...agent }) => ({
                ...agent,
                home_branch: (0, branch_response_dto_1.toBranchRefDto)(homeBranch),
            })),
        };
    }
    async branches(user, id) {
        await this.assertBranchScope(user, id);
        const rows = await this.prisma.branch.findMany({
            where: { companyId: id },
            include: branch_response_dto_1.BRANCH_INCLUDE,
            orderBy: [{ active: 'desc' }, { name: 'asc' }],
        });
        return rows.map((row) => (0, branch_response_dto_1.toBranchDto)(row));
    }
    async createBranch(user, id, dto) {
        await this.assertBranchScope(user, id);
        const code = dto.code.trim();
        let branch;
        try {
            branch = await this.prisma.branch.create({
                data: {
                    companyId: id,
                    code,
                    name: dto.name.trim(),
                    city: optionalText(dto.city),
                    address: optionalText(dto.address),
                    phone: optionalText(dto.phone),
                },
                include: branch_response_dto_1.BRANCH_INCLUDE,
            });
        }
        catch (err) {
            if ((0, prisma_errors_1.isUniqueConstraintError)(err))
                throw new common_1.ConflictException('branch_code_exists');
            throw err;
        }
        await this.activity.log({
            actorUserId: user.id,
            entityType: 'branch',
            entityId: branch.id,
            action: 'branch_created',
            toValue: branch.code,
            metadata: { company_id: id, name: branch.name },
        });
        return (0, branch_response_dto_1.toBranchDto)(branch);
    }
    async updateBranch(user, id, branchId, dto) {
        await this.assertBranchScope(user, id);
        const existing = await this.prisma.branch.findFirst({ where: { id: branchId, companyId: id } });
        if (!existing)
            throw new common_1.NotFoundException('branch_not_found');
        const changes = {
            ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
            ...(dto.city !== undefined ? { city: optionalText(dto.city) } : {}),
            ...(dto.address !== undefined ? { address: optionalText(dto.address) } : {}),
            ...(dto.phone !== undefined ? { phone: optionalText(dto.phone) } : {}),
            ...(dto.active !== undefined ? { active: dto.active } : {}),
        };
        const branch = await this.prisma.branch.update({
            where: { id: existing.id },
            data: changes,
            include: branch_response_dto_1.BRANCH_INCLUDE,
        });
        await this.activity.log({
            actorUserId: user.id,
            entityType: 'branch',
            entityId: branch.id,
            action: 'branch_updated',
            fromValue: existing.active ? 'active' : 'inactive',
            toValue: branch.active ? 'active' : 'inactive',
            metadata: { company_id: id, changes },
        });
        return (0, branch_response_dto_1.toBranchDto)(branch);
    }
    async mine(user) {
        if (!user.companyId)
            return null;
        const company = await this.prisma.company.findUnique({ where: { id: user.companyId } });
        return company ? (0, company_response_dto_1.toDealerCompanyDto)(company) : null;
    }
    async assertBranchScope(user, companyId) {
        const company = await this.prisma.company.findUnique({
            where: { id: companyId },
            select: { id: true },
        });
        if (!company)
            throw new common_1.NotFoundException('company_not_found');
        if (user.role === client_1.UserRole.dealer_agent) {
            if (user.companyId !== companyId)
                throw new common_1.ForbiddenException('forbidden_role');
            return;
        }
        if (user.role === client_1.UserRole.group_admin) {
            const allowed = user.companyId
                ? await (0, company_hierarchy_1.resolveDescendantCompanyIds)(this.prisma, user.companyId)
                : [];
            if (!allowed.includes(companyId))
                throw new common_1.ForbiddenException('out_of_scope');
        }
    }
};
exports.CompaniesController = CompaniesController;
__decorate([
    (0, guards_1.Public)(),
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [pagination_dto_1.PaginationQueryDto]),
    __metadata("design:returntype", Promise)
], CompaniesController.prototype, "listPublic", null);
__decorate([
    (0, guards_1.Public)(),
    (0, common_1.Get)('by-code/:code'),
    __param(0, (0, common_1.Param)('code')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], CompaniesController.prototype, "byCode", null);
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.admin, client_1.UserRole.super_admin, client_1.UserRole.group_admin),
    (0, common_1.Get)('all'),
    __param(0, (0, guards_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, pagination_dto_1.PaginationQueryDto]),
    __metadata("design:returntype", Promise)
], CompaniesController.prototype, "listAll", null);
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.admin, client_1.UserRole.super_admin, client_1.UserRole.group_admin),
    (0, common_1.Post)(),
    __param(0, (0, guards_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, CreateCompanyDto]),
    __metadata("design:returntype", Promise)
], CompaniesController.prototype, "create", null);
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.admin, client_1.UserRole.super_admin, client_1.UserRole.group_admin),
    (0, common_1.Patch)(':id'),
    __param(0, (0, guards_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, UpdateCompanyDto]),
    __metadata("design:returntype", Promise)
], CompaniesController.prototype, "update", null);
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.admin, client_1.UserRole.super_admin, client_1.UserRole.group_admin),
    (0, common_1.Get)(':id/children'),
    __param(0, (0, guards_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], CompaniesController.prototype, "children", null);
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.admin, client_1.UserRole.super_admin, client_1.UserRole.dealer_agent, client_1.UserRole.group_admin),
    (0, common_1.Get)(':id/agents'),
    __param(0, (0, guards_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], CompaniesController.prototype, "agents", null);
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.admin, client_1.UserRole.super_admin, client_1.UserRole.group_admin, client_1.UserRole.dealer_agent),
    (0, common_1.Get)(':id/branches'),
    __param(0, (0, guards_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], CompaniesController.prototype, "branches", null);
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.admin, client_1.UserRole.super_admin, client_1.UserRole.group_admin),
    (0, common_1.Post)(':id/branches'),
    __param(0, (0, guards_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, CreateBranchDto]),
    __metadata("design:returntype", Promise)
], CompaniesController.prototype, "createBranch", null);
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.admin, client_1.UserRole.super_admin, client_1.UserRole.group_admin),
    (0, common_1.Patch)(':id/branches/:branchId'),
    __param(0, (0, guards_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Param)('branchId')),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, UpdateBranchDto]),
    __metadata("design:returntype", Promise)
], CompaniesController.prototype, "updateBranch", null);
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.dealer_agent),
    (0, common_1.Get)('mine'),
    __param(0, (0, guards_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], CompaniesController.prototype, "mine", null);
exports.CompaniesController = CompaniesController = __decorate([
    (0, common_1.Controller)('companies'),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        activity_service_1.ActivityService])
], CompaniesController);
//# sourceMappingURL=companies.controller.js.map