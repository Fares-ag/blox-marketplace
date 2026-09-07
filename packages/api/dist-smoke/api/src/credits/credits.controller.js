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
exports.OpsCreditsListController = exports.OpsCreditsController = exports.CreditsController = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const class_validator_1 = require("class-validator");
const guards_1 = require("../auth/guards");
const credits_service_1 = require("./credits.service");
class PayInstallmentDto {
    applicationId;
    dueDate;
    amount;
}
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], PayInstallmentDto.prototype, "applicationId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], PayInstallmentDto.prototype, "dueDate", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.IsPositive)(),
    __metadata("design:type", Number)
], PayInstallmentDto.prototype, "amount", void 0);
class AdminCreditsDto {
    action;
    amount;
    description;
}
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], AdminCreditsDto.prototype, "action", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.IsPositive)(),
    __metadata("design:type", Number)
], AdminCreditsDto.prototype, "amount", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], AdminCreditsDto.prototype, "description", void 0);
class ClaimCreditsDto {
    transactionId;
    amount;
}
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ClaimCreditsDto.prototype, "transactionId", void 0);
__decorate([
    (0, class_validator_1.ValidateIf)((dto) => !dto.transactionId),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.IsPositive)(),
    __metadata("design:type", Number)
], ClaimCreditsDto.prototype, "amount", void 0);
let CreditsController = class CreditsController {
    credits;
    constructor(credits) {
        this.credits = credits;
    }
    balance(user) {
        return this.credits.getBalance(user);
    }
    pay(user, dto) {
        return this.credits.payInstallment(user, dto.applicationId, dto.dueDate, dto.amount);
    }
    claim(user, dto) {
        if (dto.transactionId?.trim()) {
            return this.credits.claimFromTopUp(user, dto.transactionId.trim());
        }
        if (dto.amount == null) {
            throw new common_1.BadRequestException('transactionId_or_amount_required');
        }
        return this.credits.claim(user, dto.amount);
    }
};
exports.CreditsController = CreditsController;
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.customer),
    (0, common_1.Get)('balance'),
    __param(0, (0, guards_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], CreditsController.prototype, "balance", null);
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.customer),
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('pay-installment'),
    __param(0, (0, guards_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, PayInstallmentDto]),
    __metadata("design:returntype", void 0)
], CreditsController.prototype, "pay", null);
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.customer),
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('claim'),
    __param(0, (0, guards_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, ClaimCreditsDto]),
    __metadata("design:returntype", void 0)
], CreditsController.prototype, "claim", null);
exports.CreditsController = CreditsController = __decorate([
    (0, common_1.Controller)('mobile/credits'),
    __metadata("design:paramtypes", [credits_service_1.CreditsService])
], CreditsController);
const CREDITS_OPS_ROLES = [client_1.UserRole.finance_officer, client_1.UserRole.admin, client_1.UserRole.super_admin];
class ListCreditsQuery {
    q;
    limit;
    offset;
}
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ListCreditsQuery.prototype, "q", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], ListCreditsQuery.prototype, "limit", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], ListCreditsQuery.prototype, "offset", void 0);
let OpsCreditsController = class OpsCreditsController {
    credits;
    constructor(credits) {
        this.credits = credits;
    }
    adminBalance(id) {
        return this.credits.adminBalance(id);
    }
    adminAdjust(actor, id, dto) {
        return this.credits.adminAdjust(actor, id, dto.action, dto.amount, dto.description);
    }
};
exports.OpsCreditsController = OpsCreditsController;
__decorate([
    (0, guards_1.Roles)(...CREDITS_OPS_ROLES),
    (0, common_1.Get)(':id/credits'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], OpsCreditsController.prototype, "adminBalance", null);
__decorate([
    (0, guards_1.Roles)(...CREDITS_OPS_ROLES),
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)(':id/credits'),
    __param(0, (0, guards_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, AdminCreditsDto]),
    __metadata("design:returntype", void 0)
], OpsCreditsController.prototype, "adminAdjust", null);
exports.OpsCreditsController = OpsCreditsController = __decorate([
    (0, common_1.Controller)('ops/users'),
    __metadata("design:paramtypes", [credits_service_1.CreditsService])
], OpsCreditsController);
let OpsCreditsListController = class OpsCreditsListController {
    credits;
    constructor(credits) {
        this.credits = credits;
    }
    list(query) {
        return this.credits.listBalances(query);
    }
};
exports.OpsCreditsListController = OpsCreditsListController;
__decorate([
    (0, guards_1.Roles)(...CREDITS_OPS_ROLES),
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [ListCreditsQuery]),
    __metadata("design:returntype", void 0)
], OpsCreditsListController.prototype, "list", null);
exports.OpsCreditsListController = OpsCreditsListController = __decorate([
    (0, common_1.Controller)('ops/credits'),
    __metadata("design:paramtypes", [credits_service_1.CreditsService])
], OpsCreditsListController);
//# sourceMappingURL=credits.controller.js.map