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
exports.TakafulController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const client_1 = require("@prisma/client");
const class_validator_1 = require("class-validator");
const guards_1 = require("../auth/guards");
const multer_options_1 = require("../common/multer-options");
const takaful_dto_1 = require("./takaful-dto");
const takaful_service_1 = require("./takaful.service");
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const ISO_DATE_MESSAGE = 'dates must be YYYY-MM-DD';
class UpdateTakafulDto {
    provider;
    policy_number;
    coverage_type;
    coverage_amount;
    premium_amount;
    effective_from;
    expires_at;
    riders;
}
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(1, 120),
    __metadata("design:type", String)
], UpdateTakafulDto.prototype, "provider", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(1, 80),
    __metadata("design:type", String)
], UpdateTakafulDto.prototype, "policy_number", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(takaful_dto_1.TAKAFUL_COVERAGE_TYPES),
    __metadata("design:type", String)
], UpdateTakafulDto.prototype, "coverage_type", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Object)
], UpdateTakafulDto.prototype, "coverage_amount", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Object)
], UpdateTakafulDto.prototype, "premium_amount", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.Matches)(ISO_DATE_PATTERN, { message: ISO_DATE_MESSAGE }),
    __metadata("design:type", Object)
], UpdateTakafulDto.prototype, "effective_from", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.Matches)(ISO_DATE_PATTERN, { message: ISO_DATE_MESSAGE }),
    __metadata("design:type", Object)
], UpdateTakafulDto.prototype, "expires_at", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(20),
    (0, class_validator_1.IsString)({ each: true }),
    (0, class_validator_1.MaxLength)(80, { each: true }),
    __metadata("design:type", Array)
], UpdateTakafulDto.prototype, "riders", void 0);
class DeclareTakafulDto extends UpdateTakafulDto {
    declaration_accepted;
}
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(1, 120),
    __metadata("design:type", String)
], DeclareTakafulDto.prototype, "provider", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(1, 80),
    __metadata("design:type", String)
], DeclareTakafulDto.prototype, "policy_number", void 0);
__decorate([
    (0, class_validator_1.IsIn)(takaful_dto_1.TAKAFUL_COVERAGE_TYPES),
    __metadata("design:type", String)
], DeclareTakafulDto.prototype, "coverage_type", void 0);
__decorate([
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], DeclareTakafulDto.prototype, "declaration_accepted", void 0);
const OPS_READ_ROLES = [
    client_1.UserRole.credit_officer,
    client_1.UserRole.finance_officer,
    client_1.UserRole.admin,
    client_1.UserRole.super_admin,
    client_1.UserRole.group_admin,
    client_1.UserRole.dealer_agent,
];
const OPS_VERIFY_ROLES = [
    client_1.UserRole.credit_officer,
    client_1.UserRole.finance_officer,
    client_1.UserRole.admin,
    client_1.UserRole.super_admin,
];
function sendFile(res, file) {
    res.setHeader('Content-Type', file.contentType);
    res.setHeader('Content-Disposition', `inline; filename="${file.filename}"`);
    res.send(file.buffer);
}
let TakafulController = class TakafulController {
    takaful;
    constructor(takaful) {
        this.takaful = takaful;
    }
    list(user, id) {
        return this.takaful.listForCustomer(user, id);
    }
    declare(user, id, dto) {
        return this.takaful.declare(user, id, dto);
    }
    update(user, id, policyId, dto) {
        return this.takaful.update(user, id, policyId, dto);
    }
    uploadDocument(user, id, policyId, file) {
        return this.takaful.uploadDocument(user, id, policyId, file);
    }
    async downloadDocument(user, id, policyId, res) {
        sendFile(res, await this.takaful.downloadDocument(user, id, policyId));
    }
    opsList(user, id) {
        return this.takaful.listForOps(user, id);
    }
    async opsDownloadDocument(user, id, policyId, res) {
        sendFile(res, await this.takaful.downloadDocument(user, id, policyId));
    }
    opsVerify(user, id, policyId) {
        return this.takaful.verify(user, id, policyId);
    }
};
exports.TakafulController = TakafulController;
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.customer),
    (0, common_1.Get)('applications/:id/takaful'),
    __param(0, (0, guards_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], TakafulController.prototype, "list", null);
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.customer),
    (0, common_1.Post)('applications/:id/takaful'),
    __param(0, (0, guards_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, DeclareTakafulDto]),
    __metadata("design:returntype", void 0)
], TakafulController.prototype, "declare", null);
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.customer),
    (0, common_1.Patch)('applications/:id/takaful/:policyId'),
    __param(0, (0, guards_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Param)('policyId')),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, UpdateTakafulDto]),
    __metadata("design:returntype", void 0)
], TakafulController.prototype, "update", null);
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.customer),
    (0, common_1.Post)('applications/:id/takaful/:policyId/document'),
    (0, common_1.HttpCode)(200),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', (0, multer_options_1.multerUploadOptions)())),
    __param(0, (0, guards_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Param)('policyId')),
    __param(3, (0, common_1.UploadedFile)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, Object]),
    __metadata("design:returntype", void 0)
], TakafulController.prototype, "uploadDocument", null);
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.customer),
    (0, common_1.Get)('applications/:id/takaful/:policyId/document'),
    __param(0, (0, guards_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Param)('policyId')),
    __param(3, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, Object]),
    __metadata("design:returntype", Promise)
], TakafulController.prototype, "downloadDocument", null);
__decorate([
    (0, guards_1.Roles)(...OPS_READ_ROLES),
    (0, common_1.Get)('ops/applications/:id/takaful'),
    __param(0, (0, guards_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], TakafulController.prototype, "opsList", null);
__decorate([
    (0, guards_1.Roles)(...OPS_READ_ROLES),
    (0, common_1.Get)('ops/applications/:id/takaful/:policyId/document'),
    __param(0, (0, guards_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Param)('policyId')),
    __param(3, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, Object]),
    __metadata("design:returntype", Promise)
], TakafulController.prototype, "opsDownloadDocument", null);
__decorate([
    (0, guards_1.Roles)(...OPS_VERIFY_ROLES),
    (0, common_1.Post)('ops/applications/:id/takaful/:policyId/verify'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, guards_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Param)('policyId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], TakafulController.prototype, "opsVerify", null);
exports.TakafulController = TakafulController = __decorate([
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [takaful_service_1.TakafulService])
], TakafulController);
//# sourceMappingURL=takaful.controller.js.map