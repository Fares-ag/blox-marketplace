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
exports.MobileController = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const class_validator_1 = require("class-validator");
const guards_1 = require("../auth/guards");
const payments_service_1 = require("../payments/payments.service");
const mobile_service_1 = require("./mobile.service");
class MobileCreateApplicationDto {
    vehicleId;
    calculator;
    firstName;
    lastName;
    email;
    phone;
    nationalId;
    nationality;
    gender;
    dateOfBirth;
    residenceDuration;
}
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], MobileCreateApplicationDto.prototype, "vehicleId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], MobileCreateApplicationDto.prototype, "calculator", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], MobileCreateApplicationDto.prototype, "firstName", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], MobileCreateApplicationDto.prototype, "lastName", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], MobileCreateApplicationDto.prototype, "email", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], MobileCreateApplicationDto.prototype, "phone", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], MobileCreateApplicationDto.prototype, "nationalId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], MobileCreateApplicationDto.prototype, "nationality", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], MobileCreateApplicationDto.prototype, "gender", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.Matches)(/^\d{4}-\d{2}-\d{2}$/, { message: 'dateOfBirth must be YYYY-MM-DD' }),
    __metadata("design:type", String)
], MobileCreateApplicationDto.prototype, "dateOfBirth", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], MobileCreateApplicationDto.prototype, "residenceDuration", void 0);
class DeviceTokenDto {
    platform;
    fcmToken;
    appVersion;
}
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], DeviceTokenDto.prototype, "platform", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(8),
    __metadata("design:type", String)
], DeviceTokenDto.prototype, "fcmToken", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], DeviceTokenDto.prototype, "appVersion", void 0);
class SkipCashInitiateDto {
    applicationId;
    scheduleId;
    scheduleItemId;
    returnUrl;
    transactionId;
    firstName;
    lastName;
    phone;
    email;
    custom1;
    subject;
    description;
    onlyDebitCard;
}
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SkipCashInitiateDto.prototype, "applicationId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SkipCashInitiateDto.prototype, "scheduleId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SkipCashInitiateDto.prototype, "scheduleItemId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SkipCashInitiateDto.prototype, "returnUrl", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SkipCashInitiateDto.prototype, "transactionId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SkipCashInitiateDto.prototype, "firstName", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SkipCashInitiateDto.prototype, "lastName", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SkipCashInitiateDto.prototype, "phone", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SkipCashInitiateDto.prototype, "email", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SkipCashInitiateDto.prototype, "custom1", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SkipCashInitiateDto.prototype, "subject", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SkipCashInitiateDto.prototype, "description", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], SkipCashInitiateDto.prototype, "onlyDebitCard", void 0);
class SkipCashCreditTopUpDto {
    amount;
    transactionId;
    firstName;
    lastName;
    phone;
    email;
    returnUrl;
    custom1;
    subject;
    description;
}
__decorate([
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], SkipCashCreditTopUpDto.prototype, "amount", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SkipCashCreditTopUpDto.prototype, "transactionId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SkipCashCreditTopUpDto.prototype, "firstName", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SkipCashCreditTopUpDto.prototype, "lastName", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SkipCashCreditTopUpDto.prototype, "phone", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SkipCashCreditTopUpDto.prototype, "email", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SkipCashCreditTopUpDto.prototype, "returnUrl", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SkipCashCreditTopUpDto.prototype, "custom1", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SkipCashCreditTopUpDto.prototype, "subject", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SkipCashCreditTopUpDto.prototype, "description", void 0);
class SkipCashVerifyDto {
    gatewayPaymentId;
    paymentId;
    transactionId;
    idempotencyKey;
}
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SkipCashVerifyDto.prototype, "gatewayPaymentId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SkipCashVerifyDto.prototype, "paymentId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SkipCashVerifyDto.prototype, "transactionId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SkipCashVerifyDto.prototype, "idempotencyKey", void 0);
let MobileController = class MobileController {
    mobile;
    payments;
    constructor(mobile, payments) {
        this.mobile = mobile;
        this.payments = payments;
    }
    catalog(query) {
        return this.mobile.listVehicles(query);
    }
    vehicle(id) {
        return this.mobile.getVehicle(id);
    }
    dashboard(user) {
        return this.mobile.dashboard(user);
    }
    async create(user, dto, res) {
        const result = await this.mobile.createApplication(user, dto);
        if (result.resumed)
            res.status(200);
        return result;
    }
    offer(user, id) {
        return this.mobile.offer(user, id);
    }
    accept(user, id) {
        return this.mobile.acceptOffer(user, id);
    }
    pre(user, id) {
        return this.mobile.preDisbursal(user, id);
    }
    completePre(user, id) {
        return this.mobile.completePreDisbursal(user, id);
    }
    hub(user) {
        return this.mobile.paymentsHub(user);
    }
    device(user, dto) {
        return this.mobile.registerDeviceToken(user, dto);
    }
    initiate(user, dto) {
        return this.payments.initiateMobileInstallmentPayment(user, dto);
    }
    creditTopUp(user, dto) {
        return this.payments.createCreditTopUpPayment(user, dto);
    }
    verify(user, dto) {
        return this.payments.mobileVerifySkipCash(user, dto);
    }
};
exports.MobileController = MobileController;
__decorate([
    (0, guards_1.Public)(),
    (0, common_1.Get)('catalog/vehicles'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], MobileController.prototype, "catalog", null);
__decorate([
    (0, guards_1.Public)(),
    (0, common_1.Get)('catalog/vehicles/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], MobileController.prototype, "vehicle", null);
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.customer),
    (0, common_1.Get)('servicing/dashboard'),
    __param(0, (0, guards_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], MobileController.prototype, "dashboard", null);
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.customer),
    (0, common_1.Post)('applications'),
    __param(0, (0, guards_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, MobileCreateApplicationDto, Object]),
    __metadata("design:returntype", Promise)
], MobileController.prototype, "create", null);
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.customer),
    (0, common_1.Get)('applications/:id/offer'),
    __param(0, (0, guards_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], MobileController.prototype, "offer", null);
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.customer),
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('applications/:id/offer/accept'),
    __param(0, (0, guards_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], MobileController.prototype, "accept", null);
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.customer),
    (0, common_1.Get)('applications/:id/pre-disbursal'),
    __param(0, (0, guards_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], MobileController.prototype, "pre", null);
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.customer),
    (0, common_1.Patch)('applications/:id/pre-disbursal'),
    __param(0, (0, guards_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], MobileController.prototype, "completePre", null);
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.customer),
    (0, common_1.Get)('payments/hub'),
    __param(0, (0, guards_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], MobileController.prototype, "hub", null);
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.customer),
    (0, common_1.Post)('device-tokens'),
    __param(0, (0, guards_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, DeviceTokenDto]),
    __metadata("design:returntype", void 0)
], MobileController.prototype, "device", null);
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.customer),
    (0, common_1.Post)('payments/skipcash/initiate'),
    __param(0, (0, guards_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, SkipCashInitiateDto]),
    __metadata("design:returntype", void 0)
], MobileController.prototype, "initiate", null);
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.customer),
    (0, common_1.Post)('payments/skipcash/credit-topup'),
    __param(0, (0, guards_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, SkipCashCreditTopUpDto]),
    __metadata("design:returntype", void 0)
], MobileController.prototype, "creditTopUp", null);
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.customer),
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('payments/skipcash/verify'),
    __param(0, (0, guards_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, SkipCashVerifyDto]),
    __metadata("design:returntype", void 0)
], MobileController.prototype, "verify", null);
exports.MobileController = MobileController = __decorate([
    (0, common_1.Controller)('mobile'),
    __metadata("design:paramtypes", [mobile_service_1.MobileService,
        payments_service_1.PaymentsService])
], MobileController);
//# sourceMappingURL=mobile.controller.js.map