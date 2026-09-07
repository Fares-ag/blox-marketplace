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
exports.PaymentsController = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const class_validator_1 = require("class-validator");
const guards_1 = require("../auth/guards");
const idempotency_constants_1 = require("../common/idempotency.constants");
const idempotency_service_1 = require("../common/idempotency.service");
const pagination_dto_1 = require("../common/pagination.dto");
const payments_service_1 = require("./payments.service");
class RecordPaymentDto {
    amount;
    method;
    reference;
}
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.IsPositive)(),
    __metadata("design:type", Number)
], RecordPaymentDto.prototype, "amount", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], RecordPaymentDto.prototype, "method", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], RecordPaymentDto.prototype, "reference", void 0);
class WaiveDto {
    reason;
}
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], WaiveDto.prototype, "reason", void 0);
class ListSchedulesQuery extends pagination_dto_1.PaginationQueryDto {
    status;
    applicationId;
}
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.ScheduleStatus),
    __metadata("design:type", String)
], ListSchedulesQuery.prototype, "status", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ListSchedulesQuery.prototype, "applicationId", void 0);
class ActiveBookQuery extends pagination_dto_1.PaginationQueryDto {
    q;
}
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ActiveBookQuery.prototype, "q", void 0);
class ListTransactionsQuery extends pagination_dto_1.PaginationQueryDto {
    status;
    applicationId;
}
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.PaymentTransactionStatus),
    __metadata("design:type", String)
], ListTransactionsQuery.prototype, "status", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ListTransactionsQuery.prototype, "applicationId", void 0);
class SkipCashCompleteDto {
    idempotency_key;
    gateway_payment_id;
}
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SkipCashCompleteDto.prototype, "idempotency_key", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SkipCashCompleteDto.prototype, "gateway_payment_id", void 0);
let PaymentsController = class PaymentsController {
    payments;
    idempotency;
    constructor(payments, idempotency) {
        this.payments = payments;
        this.idempotency = idempotency;
    }
    list(user, query) {
        return this.payments.listSchedules(user, query);
    }
    book(user, query) {
        return this.payments.listActiveBook(user, query);
    }
    transactions(user, query) {
        return this.payments.listTransactions(user, query);
    }
    pay(user, id, dto, idempotencyKey) {
        return this.idempotency.run({
            userId: user.id,
            scope: idempotency_constants_1.IDEMPOTENCY_SCOPES.opsSchedulePay(id),
            idempotencyKey,
            handler: () => this.payments.recordPayment(user, id, dto),
        });
    }
    requestWaive(user, id, dto) {
        return this.payments.requestWaiveSchedule(user, id, dto.reason);
    }
    confirmWaive(user, id) {
        return this.payments.confirmWaiveSchedule(user, id);
    }
    markOverdue(user) {
        return this.payments.markOverdue(user);
    }
    pendingBank(user, query) {
        return this.payments.listPendingBank(user, query);
    }
    createPendingBank(user, id, dto) {
        return this.payments.createPendingBank(user, id, dto);
    }
    confirmBank(user, id) {
        return this.payments.confirmBank(user, id);
    }
    createSkipCash(user, applicationId, scheduleId, idempotencyKey) {
        return this.idempotency.run({
            userId: user.id,
            scope: idempotency_constants_1.IDEMPOTENCY_SCOPES.skipCashCreate(applicationId, scheduleId),
            idempotencyKey,
            handler: () => this.payments.createSkipCashPayment(user, applicationId, scheduleId),
        });
    }
    completeSkipCash(dto) {
        return this.payments.completeSkipCashPayment(dto.idempotency_key, dto.gateway_payment_id);
    }
};
exports.PaymentsController = PaymentsController;
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.finance_officer, client_1.UserRole.credit_officer, client_1.UserRole.admin, client_1.UserRole.super_admin),
    (0, common_1.Get)('ops/payment-schedules'),
    __param(0, (0, guards_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, ListSchedulesQuery]),
    __metadata("design:returntype", void 0)
], PaymentsController.prototype, "list", null);
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.finance_officer, client_1.UserRole.credit_officer, client_1.UserRole.admin, client_1.UserRole.super_admin),
    (0, common_1.Get)('ops/finance/book'),
    __param(0, (0, guards_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, ActiveBookQuery]),
    __metadata("design:returntype", void 0)
], PaymentsController.prototype, "book", null);
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.finance_officer, client_1.UserRole.credit_officer, client_1.UserRole.admin, client_1.UserRole.super_admin),
    (0, common_1.Get)('ops/payment-transactions'),
    __param(0, (0, guards_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, ListTransactionsQuery]),
    __metadata("design:returntype", void 0)
], PaymentsController.prototype, "transactions", null);
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.finance_officer, client_1.UserRole.credit_officer, client_1.UserRole.admin, client_1.UserRole.super_admin),
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('ops/payment-schedules/:id/pay'),
    __param(0, (0, guards_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, common_1.Headers)(idempotency_constants_1.IDEMPOTENCY_KEY_HEADER)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, RecordPaymentDto, String]),
    __metadata("design:returntype", void 0)
], PaymentsController.prototype, "pay", null);
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.admin, client_1.UserRole.super_admin),
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('ops/payment-schedules/:id/waive/request'),
    __param(0, (0, guards_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, WaiveDto]),
    __metadata("design:returntype", void 0)
], PaymentsController.prototype, "requestWaive", null);
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.admin, client_1.UserRole.super_admin),
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('ops/payment-schedules/:id/waive/confirm'),
    __param(0, (0, guards_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], PaymentsController.prototype, "confirmWaive", null);
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.finance_officer, client_1.UserRole.admin, client_1.UserRole.super_admin),
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('ops/payment-schedules/mark-overdue'),
    __param(0, (0, guards_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], PaymentsController.prototype, "markOverdue", null);
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.finance_officer, client_1.UserRole.credit_officer, client_1.UserRole.admin, client_1.UserRole.super_admin),
    (0, common_1.Get)('ops/payments/pending-bank'),
    __param(0, (0, guards_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, pagination_dto_1.PaginationQueryDto]),
    __metadata("design:returntype", void 0)
], PaymentsController.prototype, "pendingBank", null);
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.finance_officer, client_1.UserRole.credit_officer, client_1.UserRole.admin, client_1.UserRole.super_admin),
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('ops/payment-schedules/:id/bank-pending'),
    __param(0, (0, guards_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, RecordPaymentDto]),
    __metadata("design:returntype", void 0)
], PaymentsController.prototype, "createPendingBank", null);
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.finance_officer, client_1.UserRole.credit_officer, client_1.UserRole.admin, client_1.UserRole.super_admin),
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('ops/payments/:id/confirm-bank'),
    __param(0, (0, guards_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], PaymentsController.prototype, "confirmBank", null);
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.customer),
    (0, common_1.Post)('applications/:applicationId/schedules/:scheduleId/skipcash'),
    __param(0, (0, guards_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('applicationId')),
    __param(2, (0, common_1.Param)('scheduleId')),
    __param(3, (0, common_1.Headers)(idempotency_constants_1.IDEMPOTENCY_KEY_HEADER)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String]),
    __metadata("design:returntype", void 0)
], PaymentsController.prototype, "createSkipCash", null);
__decorate([
    (0, guards_1.Public)(),
    (0, common_1.Post)('payments/skipcash/complete'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [SkipCashCompleteDto]),
    __metadata("design:returntype", void 0)
], PaymentsController.prototype, "completeSkipCash", null);
exports.PaymentsController = PaymentsController = __decorate([
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [payments_service_1.PaymentsService,
        idempotency_service_1.IdempotencyService])
], PaymentsController);
//# sourceMappingURL=payments.controller.js.map