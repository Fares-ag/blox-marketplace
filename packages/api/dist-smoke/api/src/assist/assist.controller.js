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
exports.AssistController = exports.ASSIST_PROOF_HEADER = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const guards_1 = require("../auth/guards");
const consents_controller_1 = require("../consents/consents.controller");
const request_meta_1 = require("../consents/request-meta");
const assist_service_1 = require("./assist.service");
class CreateAssistedSessionDto {
    application_id;
    phone;
    email;
}
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(1, 64),
    __metadata("design:type", String)
], CreateAssistedSessionDto.prototype, "application_id", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(6, 24),
    __metadata("design:type", String)
], CreateAssistedSessionDto.prototype, "phone", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEmail)(),
    __metadata("design:type", String)
], CreateAssistedSessionDto.prototype, "email", void 0);
class VerifyOtpDto {
    code;
}
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(/^\d{6}$/, { message: 'code must be 6 digits' }),
    __metadata("design:type", String)
], VerifyOtpDto.prototype, "code", void 0);
class AssistConsentsDto {
    acceptances;
    locale;
}
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMinSize)(1),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => consents_controller_1.ConsentAcceptanceDto),
    __metadata("design:type", Array)
], AssistConsentsDto.prototype, "acceptances", void 0);
__decorate([
    (0, class_validator_1.IsIn)(['en', 'ar']),
    __metadata("design:type", String)
], AssistConsentsDto.prototype, "locale", void 0);
const STAFF_ROLES = [client_1.UserRole.dealer_agent, client_1.UserRole.admin, client_1.UserRole.super_admin];
exports.ASSIST_PROOF_HEADER = 'x-assist-proof';
let AssistController = class AssistController {
    assist;
    constructor(assist) {
        this.assist = assist;
    }
    create(user, dto) {
        return this.assist.create(user, {
            applicationId: dto.application_id,
            phone: dto.phone,
            email: dto.email ?? null,
        });
    }
    list(user, applicationId) {
        const id = applicationId?.trim();
        if (!id)
            throw new common_1.BadRequestException('validation_failed');
        return this.assist.list(user, id);
    }
    resend(user, id) {
        return this.assist.resend(user, id);
    }
    cancel(user, id) {
        return this.assist.cancel(user, id);
    }
    view(token) {
        return this.assist.publicView(token);
    }
    verifyOtp(token, dto) {
        return this.assist.verifyOtp(token, dto.code);
    }
    resendOtp(token) {
        return this.assist.resendPublic(token);
    }
    consents(token, proof, dto, req) {
        return this.assist.recordConsents(token, proof, dto, (0, request_meta_1.requestMeta)(req));
    }
    startIdentity(token, proof) {
        return this.assist.startIdentity(token, proof);
    }
    complete(token, proof) {
        return this.assist.complete(token, proof);
    }
};
exports.AssistController = AssistController;
__decorate([
    (0, guards_1.Roles)(...STAFF_ROLES),
    (0, common_1.Post)('assist-sessions'),
    __param(0, (0, guards_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, CreateAssistedSessionDto]),
    __metadata("design:returntype", void 0)
], AssistController.prototype, "create", null);
__decorate([
    (0, guards_1.Roles)(...STAFF_ROLES),
    (0, common_1.Get)('assist-sessions'),
    __param(0, (0, guards_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('application_id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], AssistController.prototype, "list", null);
__decorate([
    (0, guards_1.Roles)(...STAFF_ROLES),
    (0, common_1.Post)('assist-sessions/:id/resend'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, guards_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], AssistController.prototype, "resend", null);
__decorate([
    (0, guards_1.Roles)(...STAFF_ROLES),
    (0, common_1.Post)('assist-sessions/:id/cancel'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, guards_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], AssistController.prototype, "cancel", null);
__decorate([
    (0, guards_1.Public)(),
    (0, common_1.Get)('assist/:token'),
    __param(0, (0, common_1.Param)('token')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AssistController.prototype, "view", null);
__decorate([
    (0, guards_1.Public)(),
    (0, common_1.Post)('assist/:token/otp/verify'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Param)('token')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, VerifyOtpDto]),
    __metadata("design:returntype", void 0)
], AssistController.prototype, "verifyOtp", null);
__decorate([
    (0, guards_1.Public)(),
    (0, common_1.Post)('assist/:token/otp/resend'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Param)('token')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AssistController.prototype, "resendOtp", null);
__decorate([
    (0, guards_1.Public)(),
    (0, common_1.Post)('assist/:token/consents'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Param)('token')),
    __param(1, (0, common_1.Headers)(exports.ASSIST_PROOF_HEADER)),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, AssistConsentsDto, Object]),
    __metadata("design:returntype", void 0)
], AssistController.prototype, "consents", null);
__decorate([
    (0, guards_1.Public)(),
    (0, common_1.Post)('assist/:token/identity/start'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Param)('token')),
    __param(1, (0, common_1.Headers)(exports.ASSIST_PROOF_HEADER)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], AssistController.prototype, "startIdentity", null);
__decorate([
    (0, guards_1.Public)(),
    (0, common_1.Post)('assist/:token/complete'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Param)('token')),
    __param(1, (0, common_1.Headers)(exports.ASSIST_PROOF_HEADER)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], AssistController.prototype, "complete", null);
exports.AssistController = AssistController = __decorate([
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [assist_service_1.AssistService])
], AssistController);
//# sourceMappingURL=assist.controller.js.map