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
exports.ConsentsController = exports.ConsentAcceptanceDto = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const guards_1 = require("../auth/guards");
const consent_logic_1 = require("./consent-logic");
const consents_service_1 = require("./consents.service");
const request_meta_1 = require("./request-meta");
class ConsentAcceptanceDto {
    code;
    version;
}
exports.ConsentAcceptanceDto = ConsentAcceptanceDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(1, 40),
    __metadata("design:type", String)
], ConsentAcceptanceDto.prototype, "code", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(1, 40),
    __metadata("design:type", String)
], ConsentAcceptanceDto.prototype, "version", void 0);
class RecordConsentsDto {
    acceptances;
    locale;
    application_id;
}
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMinSize)(1),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => ConsentAcceptanceDto),
    __metadata("design:type", Array)
], RecordConsentsDto.prototype, "acceptances", void 0);
__decorate([
    (0, class_validator_1.IsIn)(['en', 'ar']),
    __metadata("design:type", String)
], RecordConsentsDto.prototype, "locale", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], RecordConsentsDto.prototype, "application_id", void 0);
class WithdrawConsentDto {
    reason;
}
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(500),
    __metadata("design:type", String)
], WithdrawConsentDto.prototype, "reason", void 0);
let ConsentsController = class ConsentsController {
    consents;
    constructor(consents) {
        this.consents = consents;
    }
    status(user, applicationId) {
        return this.consents.statusFor(user.id, applicationId?.trim() || null);
    }
    record(user, dto, req) {
        return this.consents.record({
            userId: user.id,
            acceptances: dto.acceptances,
            locale: dto.locale,
            applicationId: dto.application_id?.trim() || null,
            channel: (0, consent_logic_1.consentChannelFromHeader)(req.headers['x-blox-channel']),
            ...(0, request_meta_1.requestMeta)(req),
        });
    }
    withdraw(user, code, dto) {
        return this.consents.withdraw({ userId: user.id, code, reason: dto.reason ?? null });
    }
    opsStatus(user, id) {
        return this.consents.statusForApplication(user, id);
    }
};
exports.ConsentsController = ConsentsController;
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.customer),
    (0, common_1.Get)('me/consents'),
    __param(0, (0, guards_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('application_id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ConsentsController.prototype, "status", null);
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.customer),
    (0, common_1.Post)('me/consents'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, guards_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, RecordConsentsDto, Object]),
    __metadata("design:returntype", void 0)
], ConsentsController.prototype, "record", null);
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.customer),
    (0, common_1.Post)('me/consents/:code/withdraw'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, guards_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('code')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, WithdrawConsentDto]),
    __metadata("design:returntype", void 0)
], ConsentsController.prototype, "withdraw", null);
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.credit_officer, client_1.UserRole.finance_officer, client_1.UserRole.admin, client_1.UserRole.super_admin, client_1.UserRole.group_admin, client_1.UserRole.dealer_agent),
    (0, common_1.Get)('ops/applications/:id/consents'),
    __param(0, (0, guards_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ConsentsController.prototype, "opsStatus", null);
exports.ConsentsController = ConsentsController = __decorate([
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [consents_service_1.ConsentsService])
], ConsentsController);
//# sourceMappingURL=consents.controller.js.map