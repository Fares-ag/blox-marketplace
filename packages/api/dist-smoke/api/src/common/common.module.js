"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommonModule = exports.IDEMPOTENCY_SCOPES = exports.IDEMPOTENCY_KEY_HEADER = exports.SYSTEM_USER_EMAIL = exports.ensureSystemUser = exports.SYSTEM_ACTOR_USER_ID = exports.SYSTEM_ACTOR = void 0;
const common_1 = require("@nestjs/common");
const activity_service_1 = require("./activity.service");
const idempotency_service_1 = require("./idempotency.service");
var system_actor_1 = require("./system-actor");
Object.defineProperty(exports, "SYSTEM_ACTOR", { enumerable: true, get: function () { return system_actor_1.SYSTEM_ACTOR; } });
Object.defineProperty(exports, "SYSTEM_ACTOR_USER_ID", { enumerable: true, get: function () { return system_actor_1.SYSTEM_ACTOR_USER_ID; } });
var ensure_system_user_1 = require("./ensure-system-user");
Object.defineProperty(exports, "ensureSystemUser", { enumerable: true, get: function () { return ensure_system_user_1.ensureSystemUser; } });
Object.defineProperty(exports, "SYSTEM_USER_EMAIL", { enumerable: true, get: function () { return ensure_system_user_1.SYSTEM_USER_EMAIL; } });
var idempotency_constants_1 = require("./idempotency.constants");
Object.defineProperty(exports, "IDEMPOTENCY_KEY_HEADER", { enumerable: true, get: function () { return idempotency_constants_1.IDEMPOTENCY_KEY_HEADER; } });
Object.defineProperty(exports, "IDEMPOTENCY_SCOPES", { enumerable: true, get: function () { return idempotency_constants_1.IDEMPOTENCY_SCOPES; } });
let CommonModule = class CommonModule {
};
exports.CommonModule = CommonModule;
exports.CommonModule = CommonModule = __decorate([
    (0, common_1.Module)({
        providers: [activity_service_1.ActivityService, idempotency_service_1.IdempotencyService],
        exports: [activity_service_1.ActivityService, idempotency_service_1.IdempotencyService],
    })
], CommonModule);
//# sourceMappingURL=common.module.js.map