"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SecurityModule = void 0;
const common_1 = require("@nestjs/common");
const encryption_service_1 = require("./encryption.service");
const identity_service_1 = require("./identity.service");
const sms_service_1 = require("../sms/sms.service");
let SecurityModule = class SecurityModule {
};
exports.SecurityModule = SecurityModule;
exports.SecurityModule = SecurityModule = __decorate([
    (0, common_1.Global)(),
    (0, common_1.Module)({
        providers: [encryption_service_1.EncryptionService, identity_service_1.IdentityService, sms_service_1.SmsService],
        exports: [encryption_service_1.EncryptionService, identity_service_1.IdentityService, sms_service_1.SmsService],
    })
], SecurityModule);
//# sourceMappingURL=security.module.js.map