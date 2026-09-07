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
exports.OffersController = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const class_validator_1 = require("class-validator");
const guards_1 = require("../auth/guards");
const prisma_service_1 = require("../prisma/prisma.service");
const pagination_dto_1 = require("../common/pagination.dto");
const offer_response_dto_1 = require("../common/offer-response.dto");
class UpsertOfferDto {
    name;
    annualRentRate;
    profitRate;
    tenureOptions;
    minDownPaymentPct;
    isDefault;
    status;
    companyId;
    financePartnerId;
    insuranceRateId;
}
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpsertOfferDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], UpsertOfferDto.prototype, "annualRentRate", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], UpsertOfferDto.prototype, "profitRate", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsNumber)({}, { each: true }),
    __metadata("design:type", Array)
], UpsertOfferDto.prototype, "tenureOptions", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], UpsertOfferDto.prototype, "minDownPaymentPct", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpsertOfferDto.prototype, "isDefault", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.OfferStatus),
    __metadata("design:type", String)
], UpsertOfferDto.prototype, "status", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpsertOfferDto.prototype, "companyId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpsertOfferDto.prototype, "financePartnerId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpsertOfferDto.prototype, "insuranceRateId", void 0);
function toStaffOfferDto(offer) {
    return {
        ...(0, offer_response_dto_1.toPublicOfferDto)(offer),
        profit_rate: offer.profitRate != null ? Number(offer.profitRate) : null,
        status: offer.status,
        company_id: offer.companyId,
    };
}
let OffersController = class OffersController {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async list(query) {
        const { limit, offset } = (0, pagination_dto_1.resolvePagination)(query, { defaultLimit: 50, maxLimit: 100 });
        const where = { status: 'active' };
        const [items, total] = await Promise.all([
            this.prisma.offer.findMany({
                where,
                select: {
                    id: true,
                    name: true,
                    annualRentRate: true,
                    tenureOptions: true,
                    minDownPaymentPct: true,
                    isDefault: true,
                    financePartnerId: true,
                    financePartner: { select: { name: true, crmAdapter: true } },
                },
                orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
                take: limit,
                skip: offset,
            }),
            this.prisma.offer.count({ where }),
        ]);
        return (0, pagination_dto_1.toPaginatedResponse)(items.map((item) => (0, offer_response_dto_1.toPublicOfferDto)(item)), total, limit, offset);
    }
    async listOps(query) {
        const { limit, offset } = (0, pagination_dto_1.resolvePagination)(query, { defaultLimit: 50, maxLimit: 100 });
        const [items, total] = await Promise.all([
            this.prisma.offer.findMany({
                orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
                take: limit,
                skip: offset,
            }),
            this.prisma.offer.count(),
        ]);
        return (0, pagination_dto_1.toPaginatedResponse)(items.map((item) => toStaffOfferDto(item)), total, limit, offset);
    }
    async one(id) {
        const offer = await this.prisma.offer.findUnique({ where: { id } });
        if (!offer)
            return null;
        return toStaffOfferDto(offer);
    }
    async create(dto) {
        if (dto.isDefault) {
            await this.prisma.offer.updateMany({ data: { isDefault: false }, where: { isDefault: true } });
        }
        const offer = await this.prisma.offer.create({
            data: {
                name: dto.name,
                annualRentRate: dto.annualRentRate,
                profitRate: dto.profitRate,
                tenureOptions: dto.tenureOptions,
                minDownPaymentPct: dto.minDownPaymentPct ?? 0,
                isDefault: dto.isDefault ?? false,
                status: dto.status ?? 'active',
                companyId: dto.companyId,
                financePartnerId: dto.financePartnerId,
                insuranceRateId: dto.insuranceRateId,
            },
        });
        return toStaffOfferDto(offer);
    }
    async remove(id) {
        await this.prisma.offer.delete({ where: { id } });
        return { ok: true };
    }
    async update(id, dto) {
        if (dto.isDefault) {
            await this.prisma.offer.updateMany({ data: { isDefault: false }, where: { isDefault: true } });
        }
        const offer = await this.prisma.offer.update({
            where: { id },
            data: {
                ...(dto.name !== undefined ? { name: dto.name } : {}),
                ...(dto.annualRentRate !== undefined ? { annualRentRate: dto.annualRentRate } : {}),
                ...(dto.profitRate !== undefined ? { profitRate: dto.profitRate } : {}),
                ...(dto.tenureOptions !== undefined ? { tenureOptions: dto.tenureOptions } : {}),
                ...(dto.minDownPaymentPct !== undefined ? { minDownPaymentPct: dto.minDownPaymentPct } : {}),
                ...(dto.isDefault !== undefined ? { isDefault: dto.isDefault } : {}),
                ...(dto.status !== undefined ? { status: dto.status } : {}),
                ...(dto.companyId !== undefined ? { companyId: dto.companyId } : {}),
                ...(dto.financePartnerId !== undefined ? { financePartnerId: dto.financePartnerId } : {}),
                ...(dto.insuranceRateId !== undefined ? { insuranceRateId: dto.insuranceRateId } : {}),
            },
        });
        return toStaffOfferDto(offer);
    }
};
exports.OffersController = OffersController;
__decorate([
    (0, guards_1.Public)(),
    (0, common_1.Get)('offers'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [pagination_dto_1.PaginationQueryDto]),
    __metadata("design:returntype", Promise)
], OffersController.prototype, "list", null);
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.admin, client_1.UserRole.super_admin),
    (0, common_1.Get)('ops/offers'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [pagination_dto_1.PaginationQueryDto]),
    __metadata("design:returntype", Promise)
], OffersController.prototype, "listOps", null);
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.admin, client_1.UserRole.super_admin, client_1.UserRole.dealer_agent, client_1.UserRole.credit_officer),
    (0, common_1.Get)('ops/offers/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], OffersController.prototype, "one", null);
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.admin, client_1.UserRole.super_admin),
    (0, common_1.Post)('ops/offers'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [UpsertOfferDto]),
    __metadata("design:returntype", Promise)
], OffersController.prototype, "create", null);
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.admin, client_1.UserRole.super_admin),
    (0, common_1.Delete)('ops/offers/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], OffersController.prototype, "remove", null);
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.admin, client_1.UserRole.super_admin),
    (0, common_1.Patch)('ops/offers/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], OffersController.prototype, "update", null);
exports.OffersController = OffersController = __decorate([
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], OffersController);
//# sourceMappingURL=offers.controller.js.map