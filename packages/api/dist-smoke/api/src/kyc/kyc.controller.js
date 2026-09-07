"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.KycController = void 0;
const common_1 = require("@nestjs/common");
const guards_1 = require("../auth/guards");
const client_1 = require("@prisma/client");
const kyc_bridge_service_1 = require("./kyc-bridge.service");
let KycController = class KycController {
    kyc;
    constructor(kyc) {
        this.kyc = kyc;
    }
    session(user, applicationId) {
        return this.kyc.ensureSession(user, applicationId);
    }
    documents(user, applicationId) {
        return this.kyc.documentStatus(user, applicationId);
    }
    webhook(req, signature, body) {
        const raw = req.rawBody ?? JSON.stringify(body ?? {});
        return this.kyc.handleWebhook(raw, signature, body ?? {});
    }
};
exports.KycController = KycController;
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.customer),
    (0, common_1.Post)('applications/:applicationId/kyc/session'),
    __param(0, (0, guards_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('applicationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], KycController.prototype, "session", null);
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.customer),
    (0, common_1.Get)('applications/:applicationId/kyc/documents'),
    __param(0, (0, guards_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('applicationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], KycController.prototype, "documents", null);
__decorate([
    (0, guards_1.Public)(),
    (0, common_1.Post)('webhooks/kyc'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Headers)('x-kyc-signature')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object]),
    __metadata("design:returntype", void 0)
], KycController.prototype, "webhook", null);
exports.KycController = KycController = __decorate([
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [kyc_bridge_service_1.KycBridgeService])
], KycController);
//# sourceMappingURL=kyc.controller.js.map