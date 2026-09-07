"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ZohoModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const common_module_1 = require("../../common/common.module");
const kyc_module_1 = require("../../kyc/kyc.module");
const prisma_module_1 = require("../../prisma/prisma.module");
const storage_module_1 = require("../../storage/storage.module");
const zoho_auth_service_1 = require("./zoho-auth.service");
const zoho_config_1 = require("./zoho-config");
const zoho_crm_service_1 = require("./zoho-crm.service");
let ZohoModule = class ZohoModule {
};
exports.ZohoModule = ZohoModule;
exports.ZohoModule = ZohoModule = __decorate([
    (0, common_1.Module)({
        imports: [config_1.ConfigModule, prisma_module_1.PrismaModule, common_module_1.CommonModule, kyc_module_1.KycModule, storage_module_1.StorageModule],
        providers: [zoho_config_1.ZohoConfig, zoho_auth_service_1.ZohoAuthService, zoho_crm_service_1.ZohoCrmService],
        exports: [zoho_crm_service_1.ZohoCrmService, zoho_config_1.ZohoConfig],
    })
], ZohoModule);
//# sourceMappingURL=zoho.module.js.map