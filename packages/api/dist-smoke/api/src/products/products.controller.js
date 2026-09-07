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
exports.ProductsController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const client_1 = require("@prisma/client");
const class_validator_1 = require("class-validator");
const guards_1 = require("../auth/guards");
const multer_options_1 = require("../common/multer-options");
const pagination_dto_1 = require("../common/pagination.dto");
const products_service_1 = require("./products.service");
class CreateProductDto {
    make;
    model;
    trim;
    modelYear;
    condition;
    engine;
    transmission;
    cylinders;
    drivetrain;
    bodyType;
    warrantyMonths;
    warrantyNotes;
    color;
    mileage;
    vin;
    chassis_number;
    chassisNumber;
    engine_number;
    engineNumber;
    description;
    price;
    financeEligible;
    defaultOfferId;
    companyId;
}
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateProductDto.prototype, "make", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateProductDto.prototype, "model", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateProductDto.prototype, "trim", void 0);
__decorate([
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], CreateProductDto.prototype, "modelYear", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.VehicleCondition),
    __metadata("design:type", String)
], CreateProductDto.prototype, "condition", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateProductDto.prototype, "engine", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.Transmission),
    __metadata("design:type", String)
], CreateProductDto.prototype, "transmission", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], CreateProductDto.prototype, "cylinders", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.Drivetrain),
    __metadata("design:type", String)
], CreateProductDto.prototype, "drivetrain", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.BodyType),
    __metadata("design:type", String)
], CreateProductDto.prototype, "bodyType", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], CreateProductDto.prototype, "warrantyMonths", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateProductDto.prototype, "warrantyNotes", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateProductDto.prototype, "color", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], CreateProductDto.prototype, "mileage", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(64),
    __metadata("design:type", Object)
], CreateProductDto.prototype, "vin", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(64),
    __metadata("design:type", Object)
], CreateProductDto.prototype, "chassis_number", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(64),
    __metadata("design:type", Object)
], CreateProductDto.prototype, "chassisNumber", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(64),
    __metadata("design:type", Object)
], CreateProductDto.prototype, "engine_number", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(64),
    __metadata("design:type", Object)
], CreateProductDto.prototype, "engineNumber", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateProductDto.prototype, "description", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], CreateProductDto.prototype, "price", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreateProductDto.prototype, "financeEligible", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateProductDto.prototype, "defaultOfferId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateProductDto.prototype, "companyId", void 0);
class UpdateProductDto {
    make;
    model;
    trim;
    modelYear;
    condition;
    engine;
    transmission;
    cylinders;
    drivetrain;
    bodyType;
    warrantyMonths;
    warrantyNotes;
    color;
    mileage;
    vin;
    chassis_number;
    chassisNumber;
    engine_number;
    engineNumber;
    description;
    price;
    financeEligible;
    defaultOfferId;
}
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateProductDto.prototype, "make", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateProductDto.prototype, "model", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateProductDto.prototype, "trim", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], UpdateProductDto.prototype, "modelYear", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.VehicleCondition),
    __metadata("design:type", String)
], UpdateProductDto.prototype, "condition", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateProductDto.prototype, "engine", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.Transmission),
    __metadata("design:type", String)
], UpdateProductDto.prototype, "transmission", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], UpdateProductDto.prototype, "cylinders", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.Drivetrain),
    __metadata("design:type", String)
], UpdateProductDto.prototype, "drivetrain", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.BodyType),
    __metadata("design:type", String)
], UpdateProductDto.prototype, "bodyType", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], UpdateProductDto.prototype, "warrantyMonths", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateProductDto.prototype, "warrantyNotes", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateProductDto.prototype, "color", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], UpdateProductDto.prototype, "mileage", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(64),
    __metadata("design:type", Object)
], UpdateProductDto.prototype, "vin", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(64),
    __metadata("design:type", Object)
], UpdateProductDto.prototype, "chassis_number", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(64),
    __metadata("design:type", Object)
], UpdateProductDto.prototype, "chassisNumber", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(64),
    __metadata("design:type", Object)
], UpdateProductDto.prototype, "engine_number", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(64),
    __metadata("design:type", Object)
], UpdateProductDto.prototype, "engineNumber", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateProductDto.prototype, "description", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], UpdateProductDto.prototype, "price", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpdateProductDto.prototype, "financeEligible", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateProductDto.prototype, "defaultOfferId", void 0);
class AdminUpdateProductDto extends UpdateProductDto {
    listingStatus;
}
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], AdminUpdateProductDto.prototype, "listingStatus", void 0);
let ProductsController = class ProductsController {
    products;
    constructor(products) {
        this.products = products;
    }
    list(make, model, yearMin, yearMax, priceMin, priceMax, condition, companyId, transmission, drivetrain, bodyType, cylinders, mileageMax, hasWarranty, q, limit, offset, sort) {
        return this.products.listPublished({
            make,
            model,
            yearMin,
            yearMax,
            priceMin,
            priceMax,
            condition,
            companyId,
            transmission,
            drivetrain,
            bodyType,
            cylinders: cylinders ? Number(cylinders) : undefined,
            mileageMax: mileageMax != null ? Number(mileageMax) : undefined,
            hasWarranty: hasWarranty === 'true' || hasWarranty === '1',
            q,
            limit,
            offset,
            sort,
        });
    }
    facetOptions() {
        return this.products.listFacetOptions();
    }
    detail(slug, user) {
        return this.products.getBySlug(slug, user);
    }
    opsOne(user, id) {
        return this.products.getOpsOne(user, id);
    }
    opsUpdate(user, id, dto) {
        return this.products.updateOps(user, id, dto);
    }
    opsDelete(user, id) {
        return this.products.deleteOps(user, id);
    }
    bulkStatus(user, dto) {
        return this.products.bulkStatus(user, dto.ids ?? [], dto.listingStatus);
    }
    inventory(user, query) {
        return this.products.listDealerInventory(user, query);
    }
    inventoryOne(user, id) {
        return this.products.getDealerOne(user, id);
    }
    create(user, dto) {
        return this.products.create(user, dto);
    }
    update(user, id, dto) {
        return this.products.update(user, id, dto);
    }
    uploadImage(user, id, file) {
        return this.products.addImage(user, id, file);
    }
    publish(user, id) {
        return this.products.publish(user, id);
    }
    unpublish(user, id) {
        return this.products.unpublish(user, id);
    }
};
exports.ProductsController = ProductsController;
__decorate([
    (0, guards_1.Public)(),
    (0, common_1.Get)('products'),
    __param(0, (0, common_1.Query)('make')),
    __param(1, (0, common_1.Query)('model')),
    __param(2, (0, common_1.Query)('yearMin')),
    __param(3, (0, common_1.Query)('yearMax')),
    __param(4, (0, common_1.Query)('priceMin')),
    __param(5, (0, common_1.Query)('priceMax')),
    __param(6, (0, common_1.Query)('condition')),
    __param(7, (0, common_1.Query)('companyId')),
    __param(8, (0, common_1.Query)('transmission')),
    __param(9, (0, common_1.Query)('drivetrain')),
    __param(10, (0, common_1.Query)('bodyType')),
    __param(11, (0, common_1.Query)('cylinders')),
    __param(12, (0, common_1.Query)('mileageMax')),
    __param(13, (0, common_1.Query)('hasWarranty')),
    __param(14, (0, common_1.Query)('q')),
    __param(15, (0, common_1.Query)('limit')),
    __param(16, (0, common_1.Query)('offset')),
    __param(17, (0, common_1.Query)('sort')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Number, Number, Number, Number, String, String, String, String, String, Number, Number, String, String, Number, Number, String]),
    __metadata("design:returntype", void 0)
], ProductsController.prototype, "list", null);
__decorate([
    (0, guards_1.Public)(),
    (0, common_1.Get)('products/facet-options'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], ProductsController.prototype, "facetOptions", null);
__decorate([
    (0, guards_1.Public)(),
    (0, common_1.UseGuards)(guards_1.OptionalSessionGuard),
    (0, common_1.Get)('products/by-slug/:slug'),
    __param(0, (0, common_1.Param)('slug')),
    __param(1, (0, guards_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], ProductsController.prototype, "detail", null);
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.admin, client_1.UserRole.super_admin),
    (0, common_1.Get)('ops/products/:id'),
    __param(0, (0, guards_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ProductsController.prototype, "opsOne", null);
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.admin, client_1.UserRole.super_admin),
    (0, common_1.Patch)('ops/products/:id'),
    __param(0, (0, guards_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, AdminUpdateProductDto]),
    __metadata("design:returntype", void 0)
], ProductsController.prototype, "opsUpdate", null);
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.admin, client_1.UserRole.super_admin),
    (0, common_1.Delete)('ops/products/:id'),
    __param(0, (0, guards_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ProductsController.prototype, "opsDelete", null);
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.admin, client_1.UserRole.super_admin),
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('ops/products/bulk-status'),
    __param(0, (0, guards_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], ProductsController.prototype, "bulkStatus", null);
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.dealer_agent, client_1.UserRole.admin, client_1.UserRole.super_admin),
    (0, common_1.Get)('dealer/inventory'),
    __param(0, (0, guards_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, pagination_dto_1.PaginationQueryDto]),
    __metadata("design:returntype", void 0)
], ProductsController.prototype, "inventory", null);
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.dealer_agent, client_1.UserRole.admin, client_1.UserRole.super_admin),
    (0, common_1.Get)('dealer/inventory/:id'),
    __param(0, (0, guards_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ProductsController.prototype, "inventoryOne", null);
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.dealer_agent, client_1.UserRole.admin, client_1.UserRole.super_admin),
    (0, common_1.Post)('dealer/inventory'),
    __param(0, (0, guards_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, CreateProductDto]),
    __metadata("design:returntype", void 0)
], ProductsController.prototype, "create", null);
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.dealer_agent, client_1.UserRole.admin, client_1.UserRole.super_admin),
    (0, common_1.Patch)('dealer/inventory/:id'),
    __param(0, (0, guards_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, UpdateProductDto]),
    __metadata("design:returntype", void 0)
], ProductsController.prototype, "update", null);
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.dealer_agent, client_1.UserRole.admin, client_1.UserRole.super_admin),
    (0, common_1.Post)('dealer/inventory/:id/images'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', (0, multer_options_1.multerUploadOptions)())),
    __param(0, (0, guards_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.UploadedFile)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], ProductsController.prototype, "uploadImage", null);
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.dealer_agent, client_1.UserRole.admin, client_1.UserRole.super_admin),
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('dealer/inventory/:id/publish'),
    __param(0, (0, guards_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ProductsController.prototype, "publish", null);
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.dealer_agent, client_1.UserRole.admin, client_1.UserRole.super_admin),
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('dealer/inventory/:id/unpublish'),
    __param(0, (0, guards_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ProductsController.prototype, "unpublish", null);
exports.ProductsController = ProductsController = __decorate([
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [products_service_1.ProductsService])
], ProductsController);
//# sourceMappingURL=products.controller.js.map