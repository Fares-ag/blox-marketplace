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
exports.CatalogController = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const class_validator_1 = require("class-validator");
const guards_1 = require("../auth/guards");
const pagination_dto_1 = require("../common/pagination.dto");
const catalog_service_1 = require("./catalog.service");
class PromotionDto {
    name;
    description;
    discountPercentage;
    discountAmount;
    startDate;
    endDate;
    status;
}
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], PromotionDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], PromotionDto.prototype, "description", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], PromotionDto.prototype, "discountPercentage", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], PromotionDto.prototype, "discountAmount", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], PromotionDto.prototype, "startDate", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], PromotionDto.prototype, "endDate", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], PromotionDto.prototype, "status", void 0);
class InsuranceDto {
    name;
    description;
    annualRate;
    annualRateProvider;
    coverageType;
    minVehicleValue;
    maxVehicleValue;
    minTenure;
    maxTenure;
    status;
    isDefault;
}
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], InsuranceDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], InsuranceDto.prototype, "description", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], InsuranceDto.prototype, "annualRate", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], InsuranceDto.prototype, "annualRateProvider", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], InsuranceDto.prototype, "coverageType", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], InsuranceDto.prototype, "minVehicleValue", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], InsuranceDto.prototype, "maxVehicleValue", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], InsuranceDto.prototype, "minTenure", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], InsuranceDto.prototype, "maxTenure", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], InsuranceDto.prototype, "status", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], InsuranceDto.prototype, "isDefault", void 0);
class PackageDto {
    name;
    description;
    items;
    price;
    status;
}
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], PackageDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], PackageDto.prototype, "description", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    __metadata("design:type", Array)
], PackageDto.prototype, "items", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], PackageDto.prototype, "price", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], PackageDto.prototype, "status", void 0);
let CatalogController = class CatalogController {
    catalog;
    constructor(catalog) {
        this.catalog = catalog;
    }
    listPromotions(query) {
        return this.catalog.listPromotions(query);
    }
    getPromotion(id) {
        return this.catalog.getPromotion(id);
    }
    createPromotion(dto) {
        return this.catalog.createPromotion({
            name: dto.name,
            description: dto.description,
            discountPercentage: dto.discountPercentage,
            discountAmount: dto.discountAmount,
            startDate: dto.startDate ? new Date(dto.startDate) : undefined,
            endDate: dto.endDate ? new Date(dto.endDate) : undefined,
            status: dto.status ?? 'active',
        });
    }
    updatePromotion(id, dto) {
        return this.catalog.updatePromotion(id, {
            name: dto.name,
            description: dto.description,
            discountPercentage: dto.discountPercentage,
            discountAmount: dto.discountAmount,
            startDate: dto.startDate ? new Date(dto.startDate) : undefined,
            endDate: dto.endDate ? new Date(dto.endDate) : undefined,
            status: dto.status,
        });
    }
    deletePromotion(id) {
        return this.catalog.deletePromotion(id);
    }
    listInsurance(query) {
        return this.catalog.listInsurance(query);
    }
    getInsurance(id) {
        return this.catalog.getInsurance(id);
    }
    createInsurance(dto) {
        return this.catalog.createInsurance({
            name: dto.name,
            description: dto.description,
            annualRate: dto.annualRate,
            annualRateProvider: dto.annualRateProvider,
            coverageType: dto.coverageType,
            minVehicleValue: dto.minVehicleValue,
            maxVehicleValue: dto.maxVehicleValue,
            minTenure: dto.minTenure,
            maxTenure: dto.maxTenure,
            status: dto.status ?? 'active',
            isDefault: dto.isDefault ?? false,
        });
    }
    updateInsurance(id, dto) {
        return this.catalog.updateInsurance(id, {
            name: dto.name,
            description: dto.description,
            annualRate: dto.annualRate,
            annualRateProvider: dto.annualRateProvider,
            coverageType: dto.coverageType,
            minVehicleValue: dto.minVehicleValue,
            maxVehicleValue: dto.maxVehicleValue,
            minTenure: dto.minTenure,
            maxTenure: dto.maxTenure,
            status: dto.status,
            isDefault: dto.isDefault,
        });
    }
    deleteInsurance(id) {
        return this.catalog.deleteInsurance(id);
    }
    listPackages(query) {
        return this.catalog.listPackages(query);
    }
    getPackage(id) {
        return this.catalog.getPackage(id);
    }
    createPackage(dto) {
        return this.catalog.createPackage({
            name: dto.name,
            description: dto.description,
            items: (dto.items ?? []),
            price: dto.price,
            status: dto.status ?? 'active',
        });
    }
    updatePackage(id, dto) {
        return this.catalog.updatePackage(id, {
            name: dto.name,
            description: dto.description,
            items: dto.items,
            price: dto.price,
            status: dto.status,
        });
    }
    deletePackage(id) {
        return this.catalog.deletePackage(id);
    }
    getSettings() {
        return this.catalog.getSettings();
    }
    patchSettings(body) {
        return this.catalog.patchSettings(body);
    }
};
exports.CatalogController = CatalogController;
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.admin, client_1.UserRole.super_admin),
    (0, common_1.Get)('promotions'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [pagination_dto_1.PaginationQueryDto]),
    __metadata("design:returntype", void 0)
], CatalogController.prototype, "listPromotions", null);
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.admin, client_1.UserRole.super_admin),
    (0, common_1.Get)('promotions/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], CatalogController.prototype, "getPromotion", null);
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.admin, client_1.UserRole.super_admin),
    (0, common_1.Post)('promotions'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [PromotionDto]),
    __metadata("design:returntype", void 0)
], CatalogController.prototype, "createPromotion", null);
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.admin, client_1.UserRole.super_admin),
    (0, common_1.Patch)('promotions/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], CatalogController.prototype, "updatePromotion", null);
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.admin, client_1.UserRole.super_admin),
    (0, common_1.Delete)('promotions/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], CatalogController.prototype, "deletePromotion", null);
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.admin, client_1.UserRole.super_admin),
    (0, common_1.Get)('insurance-rates'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [pagination_dto_1.PaginationQueryDto]),
    __metadata("design:returntype", void 0)
], CatalogController.prototype, "listInsurance", null);
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.admin, client_1.UserRole.super_admin),
    (0, common_1.Get)('insurance-rates/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], CatalogController.prototype, "getInsurance", null);
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.admin, client_1.UserRole.super_admin),
    (0, common_1.Post)('insurance-rates'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [InsuranceDto]),
    __metadata("design:returntype", void 0)
], CatalogController.prototype, "createInsurance", null);
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.admin, client_1.UserRole.super_admin),
    (0, common_1.Patch)('insurance-rates/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], CatalogController.prototype, "updateInsurance", null);
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.admin, client_1.UserRole.super_admin),
    (0, common_1.Delete)('insurance-rates/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], CatalogController.prototype, "deleteInsurance", null);
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.admin, client_1.UserRole.super_admin),
    (0, common_1.Get)('packages'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [pagination_dto_1.PaginationQueryDto]),
    __metadata("design:returntype", void 0)
], CatalogController.prototype, "listPackages", null);
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.admin, client_1.UserRole.super_admin),
    (0, common_1.Get)('packages/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], CatalogController.prototype, "getPackage", null);
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.admin, client_1.UserRole.super_admin),
    (0, common_1.Post)('packages'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [PackageDto]),
    __metadata("design:returntype", void 0)
], CatalogController.prototype, "createPackage", null);
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.admin, client_1.UserRole.super_admin),
    (0, common_1.Patch)('packages/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], CatalogController.prototype, "updatePackage", null);
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.admin, client_1.UserRole.super_admin),
    (0, common_1.Delete)('packages/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], CatalogController.prototype, "deletePackage", null);
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.admin, client_1.UserRole.super_admin),
    (0, common_1.Get)('settings/settlement-discounts'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], CatalogController.prototype, "getSettings", null);
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.admin, client_1.UserRole.super_admin),
    (0, common_1.Patch)('settings/settlement-discounts'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], CatalogController.prototype, "patchSettings", null);
exports.CatalogController = CatalogController = __decorate([
    (0, common_1.Controller)('ops'),
    __metadata("design:paramtypes", [catalog_service_1.CatalogService])
], CatalogController);
//# sourceMappingURL=catalog.controller.js.map