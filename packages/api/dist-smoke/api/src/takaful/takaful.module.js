"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TakafulModule = void 0;
const common_1 = require("@nestjs/common");
const common_module_1 = require("../common/common.module");
const takaful_providers_controller_1 = require("./takaful-providers.controller");
const takaful_providers_service_1 = require("./takaful-providers.service");
const takaful_controller_1 = require("./takaful.controller");
const takaful_service_1 = require("./takaful.service");
let TakafulModule = class TakafulModule {
};
exports.TakafulModule = TakafulModule;
exports.TakafulModule = TakafulModule = __decorate([
    (0, common_1.Module)({
        imports: [common_module_1.CommonModule],
        controllers: [takaful_controller_1.TakafulController, takaful_providers_controller_1.TakafulProvidersController],
        providers: [takaful_service_1.TakafulService, takaful_providers_service_1.TakafulProvidersService],
        exports: [takaful_service_1.TakafulService, takaful_providers_service_1.TakafulProvidersService],
    })
], TakafulModule);
//# sourceMappingURL=takaful.module.js.map