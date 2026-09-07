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
exports.GuarantorsController = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const guards_1 = require("../auth/guards");
const request_meta_1 = require("../consents/request-meta");
const guarantor_logic_1 = require("./guarantor-logic");
const guarantors_service_1 = require("./guarantors.service");
class GuarantorAcceptanceDto {
    code;
    version;
}
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(1, 40),
    __metadata("design:type", String)
], GuarantorAcceptanceDto.prototype, "code", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(1, 40),
    __metadata("design:type", String)
], GuarantorAcceptanceDto.prototype, "version", void 0);
class VerifyGuarantorOtpDto {
    code;
}
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(/^\d{6}$/, { message: 'code must be 6 digits' }),
    __metadata("design:type", String)
], VerifyGuarantorOtpDto.prototype, "code", void 0);
class GuarantorConsentsDto {
    acceptances;
    locale;
}
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMinSize)(1),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => GuarantorAcceptanceDto),
    __metadata("design:type", Array)
], GuarantorConsentsDto.prototype, "acceptances", void 0);
__decorate([
    (0, class_validator_1.IsIn)(['en', 'ar']),
    __metadata("design:type", String)
], GuarantorConsentsDto.prototype, "locale", void 0);
const SESSION_ROLES = [
    client_1.UserRole.customer,
    client_1.UserRole.dealer_agent,
    client_1.UserRole.credit_officer,
    client_1.UserRole.admin,
    client_1.UserRole.super_admin,
];
let GuarantorsController = class GuarantorsController {
    guarantors;
    constructor(guarantors) {
        this.guarantors = guarantors;
    }
    create(user, id) {
        return this.guarantors.create(user, id);
    }
    async current(user, id, res) {
        const session = await this.guarantors.current(user, id);
        res.status(200).json(session);
    }
    resend(user, id) {
        return this.guarantors.resend(user, id);
    }
    cancel(user, id) {
        return this.guarantors.cancel(user, id);
    }
    view(token) {
        return this.guarantors.publicView(token);
    }
    verifyOtp(token, dto) {
        return this.guarantors.verifyOtp(token, dto.code);
    }
    resendOtp(token) {
        return this.guarantors.resendPublic(token);
    }
    consents(token, proof, dto, req) {
        return this.guarantors.recordConsents(token, proof, dto, (0, request_meta_1.requestMeta)(req));
    }
    startIdentity(token, proof) {
        return this.guarantors.startIdentity(token, proof);
    }
    complete(token, proof) {
        return this.guarantors.complete(token, proof);
    }
};
exports.GuarantorsController = GuarantorsController;
__decorate([
    (0, guards_1.Roles)(...SESSION_ROLES),
    (0, common_1.Post)('applications/:id/guarantor/session'),
    __param(0, (0, guards_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], GuarantorsController.prototype, "create", null);
__decorate([
    (0, guards_1.Roles)(...SESSION_ROLES),
    (0, common_1.Get)('applications/:id/guarantor/session'),
    __param(0, (0, guards_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], GuarantorsController.prototype, "current", null);
__decorate([
    (0, guards_1.Roles)(...SESSION_ROLES),
    (0, common_1.Post)('applications/:id/guarantor/session/resend'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, guards_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], GuarantorsController.prototype, "resend", null);
__decorate([
    (0, guards_1.Roles)(...SESSION_ROLES),
    (0, common_1.Post)('applications/:id/guarantor/session/cancel'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, guards_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], GuarantorsController.prototype, "cancel", null);
__decorate([
    (0, guards_1.Public)(),
    (0, common_1.Get)('guarantor/:token'),
    __param(0, (0, common_1.Param)('token')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], GuarantorsController.prototype, "view", null);
__decorate([
    (0, guards_1.Public)(),
    (0, common_1.Post)('guarantor/:token/otp/verify'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Param)('token')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, VerifyGuarantorOtpDto]),
    __metadata("design:returntype", void 0)
], GuarantorsController.prototype, "verifyOtp", null);
__decorate([
    (0, guards_1.Public)(),
    (0, common_1.Post)('guarantor/:token/otp/resend'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Param)('token')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], GuarantorsController.prototype, "resendOtp", null);
__decorate([
    (0, guards_1.Public)(),
    (0, common_1.Post)('guarantor/:token/consents'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Param)('token')),
    __param(1, (0, common_1.Headers)(guarantor_logic_1.GUARANTOR_PROOF_HEADER)),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, GuarantorConsentsDto, Object]),
    __metadata("design:returntype", void 0)
], GuarantorsController.prototype, "consents", null);
__decorate([
    (0, guards_1.Public)(),
    (0, common_1.Post)('guarantor/:token/identity/start'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Param)('token')),
    __param(1, (0, common_1.Headers)(guarantor_logic_1.GUARANTOR_PROOF_HEADER)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], GuarantorsController.prototype, "startIdentity", null);
__decorate([
    (0, guards_1.Public)(),
    (0, common_1.Post)('guarantor/:token/complete'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Param)('token')),
    __param(1, (0, common_1.Headers)(guarantor_logic_1.GUARANTOR_PROOF_HEADER)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], GuarantorsController.prototype, "complete", null);
exports.GuarantorsController = GuarantorsController = __decorate([
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [guarantors_service_1.GuarantorsService])
], GuarantorsController);
//# sourceMappingURL=guarantors.controller.js.map