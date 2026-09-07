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
exports.PartnerController = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const class_validator_1 = require("class-validator");
const guards_1 = require("../auth/guards");
const pagination_dto_1 = require("../common/pagination.dto");
const partner_service_1 = require("./partner.service");
class PartnerApplicationsQueryDto extends pagination_dto_1.PaginationQueryDto {
    status;
}
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.ApplicationStatus),
    __metadata("design:type", String)
], PartnerApplicationsQueryDto.prototype, "status", void 0);
let PartnerController = class PartnerController {
    partner;
    constructor(partner) {
        this.partner = partner;
    }
    list(user, query) {
        const { limit, offset } = (0, pagination_dto_1.resolvePagination)(query, { defaultLimit: 50, maxLimit: 100 });
        return this.partner.list(user, { status: query.status ?? null, limit, offset });
    }
    summary(user) {
        return this.partner.summary(user);
    }
    detail(user, id) {
        return this.partner.detail(user, id);
    }
    async documentFile(user, id, docId, res) {
        const file = await this.partner.documentFile(user, id, docId);
        const safeName = file.filename.replace(/[^\w.\-() ]+/g, '_');
        res.setHeader('Content-Type', file.contentType);
        res.setHeader('Content-Disposition', `inline; filename="${safeName}"`);
        res.send(file.buffer);
    }
};
exports.PartnerController = PartnerController;
__decorate([
    (0, common_1.Get)('applications'),
    __param(0, (0, guards_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, PartnerApplicationsQueryDto]),
    __metadata("design:returntype", void 0)
], PartnerController.prototype, "list", null);
__decorate([
    (0, common_1.Get)('summary'),
    __param(0, (0, guards_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], PartnerController.prototype, "summary", null);
__decorate([
    (0, common_1.Get)('applications/:id'),
    __param(0, (0, guards_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], PartnerController.prototype, "detail", null);
__decorate([
    (0, common_1.Get)('applications/:id/documents/:docId/file'),
    __param(0, (0, guards_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Param)('docId')),
    __param(3, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, Object]),
    __metadata("design:returntype", Promise)
], PartnerController.prototype, "documentFile", null);
exports.PartnerController = PartnerController = __decorate([
    (0, guards_1.Roles)(client_1.UserRole.partner_viewer),
    (0, common_1.Controller)('partner'),
    __metadata("design:paramtypes", [partner_service_1.PartnerService])
], PartnerController);
//# sourceMappingURL=partner.controller.js.map