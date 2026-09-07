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
exports.TakafulProvidersController = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const guards_1 = require("../auth/guards");
const takaful_quote_1 = require("./takaful-quote");
const takaful_providers_service_1 = require("./takaful-providers.service");
const CODE_PATTERN = /^[a-z0-9][a-z0-9_-]*$/i;
class TakafulRiderDto {
    code;
    label;
    label_ar;
    annual_amount;
}
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(1, 40),
    __metadata("design:type", String)
], TakafulRiderDto.prototype, "code", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(1, 120),
    __metadata("design:type", String)
], TakafulRiderDto.prototype, "label", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", Object)
], TakafulRiderDto.prototype, "label_ar", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], TakafulRiderDto.prototype, "annual_amount", void 0);
class UpdateTakafulProviderDto {
    code;
    name;
    name_ar;
    comprehensive_rate_pct;
    third_party_annual;
    min_contribution;
    riders;
    contact_phone;
    contact_email;
    website;
    notes;
    active;
    sort_order;
}
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.MaxLength)(40),
    (0, class_validator_1.Matches)(CODE_PATTERN),
    __metadata("design:type", String)
], UpdateTakafulProviderDto.prototype, "code", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], UpdateTakafulProviderDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", Object)
], UpdateTakafulProviderDto.prototype, "name_ar", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(100),
    __metadata("design:type", Number)
], UpdateTakafulProviderDto.prototype, "comprehensive_rate_pct", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Object)
], UpdateTakafulProviderDto.prototype, "third_party_annual", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Object)
], UpdateTakafulProviderDto.prototype, "min_contribution", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(20),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => TakafulRiderDto),
    __metadata("design:type", Array)
], UpdateTakafulProviderDto.prototype, "riders", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(40),
    __metadata("design:type", Object)
], UpdateTakafulProviderDto.prototype, "contact_phone", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(160),
    __metadata("design:type", Object)
], UpdateTakafulProviderDto.prototype, "contact_email", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", Object)
], UpdateTakafulProviderDto.prototype, "website", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(2000),
    __metadata("design:type", Object)
], UpdateTakafulProviderDto.prototype, "notes", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpdateTakafulProviderDto.prototype, "active", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], UpdateTakafulProviderDto.prototype, "sort_order", void 0);
class CreateTakafulProviderDto extends UpdateTakafulProviderDto {
}
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.MaxLength)(40),
    (0, class_validator_1.Matches)(CODE_PATTERN),
    __metadata("design:type", String)
], CreateTakafulProviderDto.prototype, "code", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], CreateTakafulProviderDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(100),
    __metadata("design:type", Number)
], CreateTakafulProviderDto.prototype, "comprehensive_rate_pct", void 0);
class TakafulQuoteQueryDto {
    vehicle_price;
    coverage;
}
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], TakafulQuoteQueryDto.prototype, "vehicle_price", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(takaful_quote_1.TAKAFUL_COVERAGES),
    __metadata("design:type", String)
], TakafulQuoteQueryDto.prototype, "coverage", void 0);
let TakafulProvidersController = class TakafulProvidersController {
    providers;
    constructor(providers) {
        this.providers = providers;
    }
    quotes(query) {
        return this.providers.quotes(query.coverage ?? 'comprehensive', query.vehicle_price ?? null);
    }
    list() {
        return this.providers.list();
    }
    one(id) {
        return this.providers.get(id);
    }
    create(actor, dto) {
        return this.providers.create(actor, dto);
    }
    update(actor, id, dto) {
        return this.providers.update(actor, id, dto);
    }
};
exports.TakafulProvidersController = TakafulProvidersController;
__decorate([
    (0, guards_1.Public)(),
    (0, common_1.Get)('takaful/providers'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [TakafulQuoteQueryDto]),
    __metadata("design:returntype", void 0)
], TakafulProvidersController.prototype, "quotes", null);
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.admin, client_1.UserRole.super_admin),
    (0, common_1.Get)('ops/takaful-providers'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], TakafulProvidersController.prototype, "list", null);
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.admin, client_1.UserRole.super_admin),
    (0, common_1.Get)('ops/takaful-providers/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], TakafulProvidersController.prototype, "one", null);
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.admin, client_1.UserRole.super_admin),
    (0, common_1.Post)('ops/takaful-providers'),
    __param(0, (0, guards_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, CreateTakafulProviderDto]),
    __metadata("design:returntype", void 0)
], TakafulProvidersController.prototype, "create", null);
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.admin, client_1.UserRole.super_admin),
    (0, common_1.Patch)('ops/takaful-providers/:id'),
    __param(0, (0, guards_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, UpdateTakafulProviderDto]),
    __metadata("design:returntype", void 0)
], TakafulProvidersController.prototype, "update", null);
exports.TakafulProvidersController = TakafulProvidersController = __decorate([
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [takaful_providers_service_1.TakafulProvidersService])
], TakafulProvidersController);
//# sourceMappingURL=takaful-providers.controller.js.map