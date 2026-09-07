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
Object.defineProperty(exports, "__esModule", { value: true });
exports.CatalogService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const pagination_dto_1 = require("../common/pagination.dto");
let CatalogService = class CatalogService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    listPromotions(query) {
        return this.paged(this.prisma.promotion, query);
    }
    getPromotion(id) {
        return this.one(this.prisma.promotion, id);
    }
    createPromotion(data) {
        return this.prisma.promotion.create({ data });
    }
    updatePromotion(id, data) {
        return this.prisma.promotion.update({ where: { id }, data });
    }
    deletePromotion(id) {
        return this.prisma.promotion.delete({ where: { id } });
    }
    listInsurance(query) {
        return this.paged(this.prisma.insuranceRate, query);
    }
    getInsurance(id) {
        return this.one(this.prisma.insuranceRate, id);
    }
    createInsurance(data) {
        return this.prisma.insuranceRate.create({ data });
    }
    updateInsurance(id, data) {
        return this.prisma.insuranceRate.update({ where: { id }, data });
    }
    deleteInsurance(id) {
        return this.prisma.insuranceRate.delete({ where: { id } });
    }
    listPackages(query) {
        return this.paged(this.prisma.package, query);
    }
    getPackage(id) {
        return this.one(this.prisma.package, id);
    }
    createPackage(data) {
        return this.prisma.package.create({ data });
    }
    updatePackage(id, data) {
        return this.prisma.package.update({ where: { id }, data });
    }
    deletePackage(id) {
        return this.prisma.package.delete({ where: { id } });
    }
    async getSettings() {
        const existing = await this.prisma.settlementDiscountSettings.findFirst({
            orderBy: { priority: 'desc' },
        });
        if (existing)
            return existing;
        return this.prisma.settlementDiscountSettings.create({
            data: { name: 'Default Settlement Discount Settings' },
        });
    }
    async patchSettings(data) {
        const current = await this.getSettings();
        return this.prisma.settlementDiscountSettings.update({ where: { id: current.id }, data });
    }
    async paged(model, query) {
        const { limit, offset } = (0, pagination_dto_1.resolvePagination)(query, { defaultLimit: 50, maxLimit: 100 });
        const [items, total] = await Promise.all([
            model.findMany({ orderBy: { createdAt: 'desc' }, take: limit, skip: offset }),
            model.count(),
        ]);
        return (0, pagination_dto_1.toPaginatedResponse)(items, total, limit, offset);
    }
    async one(model, id) {
        const row = await model.findUnique({ where: { id } });
        if (!row)
            throw new common_1.NotFoundException();
        return row;
    }
};
exports.CatalogService = CatalogService;
exports.CatalogService = CatalogService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], CatalogService);
//# sourceMappingURL=catalog.service.js.map