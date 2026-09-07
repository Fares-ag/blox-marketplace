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
exports.QuotesController = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const class_validator_1 = require("class-validator");
const guards_1 = require("../auth/guards");
const pagination_dto_1 = require("../common/pagination.dto");
const quotes_service_1 = require("./quotes.service");
class CreateQuoteDto {
    productId;
    customerEmail;
    negotiatedPrice;
    expiresAt;
}
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateQuoteDto.prototype, "productId", void 0);
__decorate([
    (0, class_validator_1.IsEmail)(),
    __metadata("design:type", String)
], CreateQuoteDto.prototype, "customerEmail", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], CreateQuoteDto.prototype, "negotiatedPrice", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateQuoteDto.prototype, "expiresAt", void 0);
let QuotesController = class QuotesController {
    quotes;
    constructor(quotes) {
        this.quotes = quotes;
    }
    create(user, dto) {
        return this.quotes.create(user, dto);
    }
    list(user, query) {
        return this.quotes.listForDealer(user, query);
    }
    revoke(user, id) {
        return this.quotes.revoke(user, id);
    }
    resolve(token, user) {
        return this.quotes.resolveByToken(token, user ?? null);
    }
};
exports.QuotesController = QuotesController;
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.dealer_agent),
    (0, common_1.Post)('dealer/quotes'),
    __param(0, (0, guards_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, CreateQuoteDto]),
    __metadata("design:returntype", void 0)
], QuotesController.prototype, "create", null);
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.dealer_agent),
    (0, common_1.Get)('dealer/quotes'),
    __param(0, (0, guards_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, pagination_dto_1.PaginationQueryDto]),
    __metadata("design:returntype", void 0)
], QuotesController.prototype, "list", null);
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.dealer_agent),
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('dealer/quotes/:id/revoke'),
    __param(0, (0, guards_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], QuotesController.prototype, "revoke", null);
__decorate([
    (0, guards_1.Public)(),
    (0, common_1.Get)('quotes/:token'),
    __param(0, (0, common_1.Param)('token')),
    __param(1, (0, guards_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], QuotesController.prototype, "resolve", null);
exports.QuotesController = QuotesController = __decorate([
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [quotes_service_1.QuotesService])
], QuotesController);
//# sourceMappingURL=quotes.controller.js.map