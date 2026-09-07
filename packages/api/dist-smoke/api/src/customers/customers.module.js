"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomersModule = void 0;
const common_1 = require("@nestjs/common");
const common_module_1 = require("../common/common.module");
const consents_module_1 = require("../consents/consents.module");
const customer_documents_service_1 = require("./customer-documents.service");
const customers_controller_1 = require("./customers.controller");
const customers_service_1 = require("./customers.service");
const data_rights_controller_1 = require("./data-rights.controller");
const data_rights_service_1 = require("./data-rights.service");
let CustomersModule = class CustomersModule {
};
exports.CustomersModule = CustomersModule;
exports.CustomersModule = CustomersModule = __decorate([
    (0, common_1.Module)({
        imports: [common_module_1.CommonModule, consents_module_1.ConsentsModule],
        controllers: [customers_controller_1.CustomersController, data_rights_controller_1.DataRightsController],
        providers: [customers_service_1.CustomersService, customer_documents_service_1.CustomerDocumentsService, data_rights_service_1.DataRightsService],
        exports: [customers_service_1.CustomersService, customer_documents_service_1.CustomerDocumentsService, data_rights_service_1.DataRightsService],
    })
], CustomersModule);
//# sourceMappingURL=customers.module.js.map