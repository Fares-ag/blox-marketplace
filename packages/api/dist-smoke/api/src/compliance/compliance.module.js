"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ComplianceModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const common_module_1 = require("../common/common.module");
const prisma_module_1 = require("../prisma/prisma.module");
const compliance_provider_interface_1 = require("./compliance-provider.interface");
const compliance_provider_dev_1 = require("./compliance-provider.dev");
const compliance_provider_resolve_1 = require("./compliance-provider.resolve");
const compliance_provider_stub_1 = require("./compliance-provider.stub");
const compliance_service_1 = require("./compliance.service");
let ComplianceModule = class ComplianceModule {
};
exports.ComplianceModule = ComplianceModule;
exports.ComplianceModule = ComplianceModule = __decorate([
    (0, common_1.Module)({
        imports: [prisma_module_1.PrismaModule, common_module_1.CommonModule, config_1.ConfigModule],
        providers: [
            compliance_service_1.ComplianceService,
            compliance_provider_stub_1.StubComplianceProvider,
            compliance_provider_dev_1.DevRecordedComplianceProvider,
            {
                provide: compliance_provider_interface_1.COMPLIANCE_PROVIDER,
                useFactory: (config, stub, dev) => (0, compliance_provider_resolve_1.resolveComplianceProvider)(config, stub, dev),
                inject: [config_1.ConfigService, compliance_provider_stub_1.StubComplianceProvider, compliance_provider_dev_1.DevRecordedComplianceProvider],
            },
        ],
        exports: [compliance_service_1.ComplianceService],
    })
], ComplianceModule);
//# sourceMappingURL=compliance.module.js.map