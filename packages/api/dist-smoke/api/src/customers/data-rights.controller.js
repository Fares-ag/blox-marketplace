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
exports.DataRightsController = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const class_validator_1 = require("class-validator");
const guards_1 = require("../auth/guards");
const data_rights_service_1 = require("./data-rights.service");
class CreateDataRightsRequestDto {
    kind;
    details;
    consent_code;
}
__decorate([
    (0, class_validator_1.IsEnum)(client_1.DataRightsRequestKind),
    __metadata("design:type", String)
], CreateDataRightsRequestDto.prototype, "kind", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(2000),
    __metadata("design:type", String)
], CreateDataRightsRequestDto.prototype, "details", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.ConsentCode),
    __metadata("design:type", String)
], CreateDataRightsRequestDto.prototype, "consent_code", void 0);
class TransitionDataRightsRequestDto {
    status;
    resolution_note;
}
__decorate([
    (0, class_validator_1.IsEnum)(client_1.DataRightsRequestStatus),
    __metadata("design:type", String)
], TransitionDataRightsRequestDto.prototype, "status", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(2000),
    __metadata("design:type", String)
], TransitionDataRightsRequestDto.prototype, "resolution_note", void 0);
class DataRightsQueueQueryDto {
    status;
}
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.DataRightsRequestStatus),
    __metadata("design:type", String)
], DataRightsQueueQueryDto.prototype, "status", void 0);
let DataRightsController = class DataRightsController {
    dataRights;
    constructor(dataRights) {
        this.dataRights = dataRights;
    }
    listMine(user) {
        return this.dataRights.listMine(user.id);
    }
    create(user, dto) {
        return this.dataRights.create(user, dto);
    }
    exportMine(user) {
        return this.dataRights.exportFor(user);
    }
    queue(query) {
        return this.dataRights.listForOps(query.status ?? null);
    }
    transition(actor, id, dto) {
        return this.dataRights.transition(actor, id, dto);
    }
};
exports.DataRightsController = DataRightsController;
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.customer),
    (0, common_1.Get)('me/data-rights'),
    __param(0, (0, guards_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], DataRightsController.prototype, "listMine", null);
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.customer),
    (0, common_1.Post)('me/data-rights'),
    __param(0, (0, guards_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, CreateDataRightsRequestDto]),
    __metadata("design:returntype", void 0)
], DataRightsController.prototype, "create", null);
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.customer),
    (0, common_1.Get)('me/data-export'),
    __param(0, (0, guards_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], DataRightsController.prototype, "exportMine", null);
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.admin, client_1.UserRole.super_admin),
    (0, common_1.Get)('ops/data-rights'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [DataRightsQueueQueryDto]),
    __metadata("design:returntype", void 0)
], DataRightsController.prototype, "queue", null);
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.admin, client_1.UserRole.super_admin),
    (0, common_1.Post)('ops/data-rights/:id/transition'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, guards_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, TransitionDataRightsRequestDto]),
    __metadata("design:returntype", void 0)
], DataRightsController.prototype, "transition", null);
exports.DataRightsController = DataRightsController = __decorate([
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [data_rights_service_1.DataRightsService])
], DataRightsController);
//# sourceMappingURL=data-rights.controller.js.map