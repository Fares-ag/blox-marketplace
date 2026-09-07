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
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaginationQueryDto = void 0;
exports.resolvePagination = resolvePagination;
exports.toPaginatedResponse = toPaginatedResponse;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
class PaginationQueryDto {
    limit;
    offset;
}
exports.PaginationQueryDto = PaginationQueryDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], PaginationQueryDto.prototype, "limit", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], PaginationQueryDto.prototype, "offset", void 0);
function resolvePagination(query, opts = {}) {
    const maxLimit = opts.maxLimit ?? 200;
    const defaultLimit = opts.defaultLimit ?? 50;
    const limit = Math.min(Math.max(query.limit ?? defaultLimit, 1), maxLimit);
    const offset = Math.max(query.offset ?? 0, 0);
    return { limit, offset };
}
function toPaginatedResponse(items, total, limit, offset) {
    return { total, limit, offset, items };
}
//# sourceMappingURL=pagination.dto.js.map