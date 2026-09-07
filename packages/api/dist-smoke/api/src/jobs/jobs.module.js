"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.JobsModule = void 0;
const common_1 = require("@nestjs/common");
const common_module_1 = require("../common/common.module");
const zoho_module_1 = require("../integrations/zoho/zoho.module");
const payments_module_1 = require("../payments/payments.module");
const quotes_module_1 = require("../quotes/quotes.module");
const job_health_service_1 = require("./job-health.service");
const jobs_controller_1 = require("./jobs.controller");
const jobs_service_1 = require("./jobs.service");
let JobsModule = class JobsModule {
};
exports.JobsModule = JobsModule;
exports.JobsModule = JobsModule = __decorate([
    (0, common_1.Module)({
        imports: [
            common_module_1.CommonModule,
            payments_module_1.PaymentsModule,
            quotes_module_1.QuotesModule,
            zoho_module_1.ZohoModule,
        ],
        controllers: [jobs_controller_1.JobsController],
        providers: [jobs_service_1.JobsService, job_health_service_1.JobHealthService],
        exports: [jobs_service_1.JobsService, job_health_service_1.JobHealthService],
    })
], JobsModule);
//# sourceMappingURL=jobs.module.js.map