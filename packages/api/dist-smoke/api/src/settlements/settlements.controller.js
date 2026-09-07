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
exports.SettlementsController = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const class_validator_1 = require("class-validator");
const guards_1 = require("../auth/guards");
const pagination_dto_1 = require("../common/pagination.dto");
const settlements_service_1 = require("./settlements.service");
class ListSettlementsQuery extends pagination_dto_1.PaginationQueryDto {
    status;
}
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.SettlementStatus),
    __metadata("design:type", String)
], ListSettlementsQuery.prototype, "status", void 0);
class DecideSettlementDto {
    reason;
}
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], DecideSettlementDto.prototype, "reason", void 0);
let SettlementsController = class SettlementsController {
    settlements;
    constructor(settlements) {
        this.settlements = settlements;
    }
    quote(user, id) {
        return this.settlements.quote(user, id);
    }
    quoteOps(user, id) {
        return this.settlements.quote(user, id);
    }
    request(user, id) {
        return this.settlements.request(user, id);
    }
    list(user, query) {
        return this.settlements.list(user, query);
    }
    approve(user, id, dto) {
        return this.settlements.decide(user, id, 'approved', dto.reason);
    }
    reject(user, id, dto) {
        return this.settlements.decide(user, id, 'rejected', dto.reason);
    }
};
exports.SettlementsController = SettlementsController;
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.customer),
    (0, common_1.Get)('applications/:id/settlement-quote'),
    __param(0, (0, guards_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], SettlementsController.prototype, "quote", null);
__decorate([
    (0, guards_1.Roles)(...settlements_service_1.SETTLEMENT_QUOTE_OPS_ROLES),
    (0, common_1.Get)('ops/applications/:id/settlement-quote'),
    __param(0, (0, guards_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], SettlementsController.prototype, "quoteOps", null);
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.customer),
    (0, common_1.HttpCode)(201),
    (0, common_1.Post)('applications/:id/settlement-request'),
    __param(0, (0, guards_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], SettlementsController.prototype, "request", null);
__decorate([
    (0, guards_1.Roles)(...settlements_service_1.SETTLEMENT_DECISION_ROLES),
    (0, common_1.Get)('ops/settlements'),
    __param(0, (0, guards_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, ListSettlementsQuery]),
    __metadata("design:returntype", void 0)
], SettlementsController.prototype, "list", null);
__decorate([
    (0, guards_1.Roles)(...settlements_service_1.SETTLEMENT_DECISION_ROLES),
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('ops/settlements/:id/approve'),
    __param(0, (0, guards_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, DecideSettlementDto]),
    __metadata("design:returntype", void 0)
], SettlementsController.prototype, "approve", null);
__decorate([
    (0, guards_1.Roles)(...settlements_service_1.SETTLEMENT_DECISION_ROLES),
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('ops/settlements/:id/reject'),
    __param(0, (0, guards_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, DecideSettlementDto]),
    __metadata("design:returntype", void 0)
], SettlementsController.prototype, "reject", null);
exports.SettlementsController = SettlementsController = __decorate([
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [settlements_service_1.SettlementsService])
], SettlementsController);
//# sourceMappingURL=settlements.controller.js.map