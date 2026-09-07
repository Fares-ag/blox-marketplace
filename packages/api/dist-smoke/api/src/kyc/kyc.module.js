"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.KycModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const kyc_bridge_service_1 = require("./kyc-bridge.service");
const kyc_controller_1 = require("./kyc.controller");
const kyc_platform_client_1 = require("./kyc-platform.client");
let KycModule = class KycModule {
};
exports.KycModule = KycModule;
exports.KycModule = KycModule = __decorate([
    (0, common_1.Module)({
        imports: [config_1.ConfigModule],
        controllers: [kyc_controller_1.KycController],
        providers: [kyc_platform_client_1.KycPlatformClient, kyc_bridge_service_1.KycBridgeService],
        exports: [kyc_bridge_service_1.KycBridgeService],
    })
], KycModule);
//# sourceMappingURL=kyc.module.js.map