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
exports.MobileAuthController = void 0;
const common_1 = require("@nestjs/common");
const class_validator_1 = require("class-validator");
const guards_1 = require("../guards");
const mobile_auth_service_1 = require("./mobile-auth.service");
class MobileSignInDto {
    email;
    password;
}
__decorate([
    (0, class_validator_1.IsEmail)(),
    __metadata("design:type", String)
], MobileSignInDto.prototype, "email", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(8),
    __metadata("design:type", String)
], MobileSignInDto.prototype, "password", void 0);
class MobileSignUpDto {
    email;
    password;
    firstName;
    lastName;
    phone;
    qid;
}
__decorate([
    (0, class_validator_1.IsEmail)(),
    __metadata("design:type", String)
], MobileSignUpDto.prototype, "email", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(8),
    __metadata("design:type", String)
], MobileSignUpDto.prototype, "password", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], MobileSignUpDto.prototype, "firstName", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], MobileSignUpDto.prototype, "lastName", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], MobileSignUpDto.prototype, "phone", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], MobileSignUpDto.prototype, "qid", void 0);
class MobileRefreshDto {
    refresh_token;
}
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], MobileRefreshDto.prototype, "refresh_token", void 0);
class MobileSignOutDto {
    refresh_token;
}
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], MobileSignOutDto.prototype, "refresh_token", void 0);
class PasswordResetRequestDto {
    email;
}
__decorate([
    (0, class_validator_1.IsEmail)(),
    __metadata("design:type", String)
], PasswordResetRequestDto.prototype, "email", void 0);
class PasswordResetConfirmDto {
    token;
    password;
}
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], PasswordResetConfirmDto.prototype, "token", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(8),
    __metadata("design:type", String)
], PasswordResetConfirmDto.prototype, "password", void 0);
class ChangePasswordDto {
    currentPassword;
    newPassword;
}
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(8),
    __metadata("design:type", String)
], ChangePasswordDto.prototype, "currentPassword", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(8),
    __metadata("design:type", String)
], ChangePasswordDto.prototype, "newPassword", void 0);
let MobileAuthController = class MobileAuthController {
    auth;
    constructor(auth) {
        this.auth = auth;
    }
    signIn(dto) {
        return this.auth.signIn(dto.email, dto.password);
    }
    signUp(dto) {
        return this.auth.signUp(dto);
    }
    refresh(dto) {
        return this.auth.refresh(dto.refresh_token);
    }
    signOut(user, dto) {
        return this.auth.signOut(dto.refresh_token, user.id);
    }
    requestReset(dto) {
        return this.auth.requestPasswordReset(dto.email);
    }
    confirmReset(dto) {
        return this.auth.confirmPasswordReset(dto.token, dto.password);
    }
    changePassword(user, dto) {
        return this.auth.changePassword(user.id, dto.currentPassword, dto.newPassword);
    }
};
exports.MobileAuthController = MobileAuthController;
__decorate([
    (0, guards_1.Public)(),
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('sign-in'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [MobileSignInDto]),
    __metadata("design:returntype", void 0)
], MobileAuthController.prototype, "signIn", null);
__decorate([
    (0, guards_1.Public)(),
    (0, common_1.Post)('sign-up'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [MobileSignUpDto]),
    __metadata("design:returntype", void 0)
], MobileAuthController.prototype, "signUp", null);
__decorate([
    (0, guards_1.Public)(),
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('refresh'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [MobileRefreshDto]),
    __metadata("design:returntype", void 0)
], MobileAuthController.prototype, "refresh", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('sign-out'),
    __param(0, (0, guards_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, MobileSignOutDto]),
    __metadata("design:returntype", void 0)
], MobileAuthController.prototype, "signOut", null);
__decorate([
    (0, guards_1.Public)(),
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('password-reset/request'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [PasswordResetRequestDto]),
    __metadata("design:returntype", void 0)
], MobileAuthController.prototype, "requestReset", null);
__decorate([
    (0, guards_1.Public)(),
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('password-reset/confirm'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [PasswordResetConfirmDto]),
    __metadata("design:returntype", void 0)
], MobileAuthController.prototype, "confirmReset", null);
__decorate([
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('change-password'),
    __param(0, (0, guards_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, ChangePasswordDto]),
    __metadata("design:returntype", void 0)
], MobileAuthController.prototype, "changePassword", null);
exports.MobileAuthController = MobileAuthController = __decorate([
    (0, common_1.Controller)('auth/mobile'),
    __metadata("design:paramtypes", [mobile_auth_service_1.MobileAuthService])
], MobileAuthController);
//# sourceMappingURL=mobile-auth.controller.js.map