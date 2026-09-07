"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentsModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const common_module_1 = require("../common/common.module");
const credits_module_1 = require("../credits/credits.module");
const customer_payments_controller_1 = require("./customer-payments.controller");
const customer_payments_service_1 = require("./customer-payments.service");
const payments_controller_1 = require("./payments.controller");
const payments_service_1 = require("./payments.service");
let PaymentsModule = class PaymentsModule {
};
exports.PaymentsModule = PaymentsModule;
exports.PaymentsModule = PaymentsModule = __decorate([
    (0, common_1.Module)({
        imports: [common_module_1.CommonModule, config_1.ConfigModule, credits_module_1.CreditsModule],
        controllers: [payments_controller_1.PaymentsController, customer_payments_controller_1.CustomerPaymentsController],
        providers: [payments_service_1.PaymentsService, customer_payments_service_1.CustomerPaymentsService],
        exports: [payments_service_1.PaymentsService, customer_payments_service_1.CustomerPaymentsService],
    })
], PaymentsModule);
//# sourceMappingURL=payments.module.js.map