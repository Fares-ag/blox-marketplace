"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApplicationsModule = void 0;
const common_1 = require("@nestjs/common");
const common_module_1 = require("../common/common.module");
const compliance_module_1 = require("../compliance/compliance.module");
const kyc_module_1 = require("../kyc/kyc.module");
const storage_module_1 = require("../storage/storage.module");
const zoho_module_1 = require("../integrations/zoho/zoho.module");
const applications_controller_1 = require("./applications.controller");
const applications_service_1 = require("./applications.service");
const applications_lifecycle_service_1 = require("./applications-lifecycle.service");
const applications_staff_service_1 = require("./applications-staff.service");
const application_intake_service_1 = require("./application-intake.service");
const payments_module_1 = require("../payments/payments.module");
const quotes_module_1 = require("../quotes/quotes.module");
let ApplicationsModule = class ApplicationsModule {
};
exports.ApplicationsModule = ApplicationsModule;
exports.ApplicationsModule = ApplicationsModule = __decorate([
    (0, common_1.Module)({
        imports: [common_module_1.CommonModule, compliance_module_1.ComplianceModule, kyc_module_1.KycModule, storage_module_1.StorageModule, quotes_module_1.QuotesModule, zoho_module_1.ZohoModule, payments_module_1.PaymentsModule],
        controllers: [applications_controller_1.ApplicationsController],
        providers: [
            applications_service_1.ApplicationsService,
            applications_lifecycle_service_1.ApplicationsLifecycleService,
            applications_staff_service_1.ApplicationsStaffService,
            application_intake_service_1.ApplicationIntakeService,
        ],
        exports: [applications_service_1.ApplicationsService, applications_staff_service_1.ApplicationsStaffService, application_intake_service_1.ApplicationIntakeService],
    })
], ApplicationsModule);
//# sourceMappingURL=applications.module.js.map