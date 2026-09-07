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
exports.JobsController = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const guards_1 = require("../auth/guards");
const job_health_service_1 = require("./job-health.service");
const jobs_service_1 = require("./jobs.service");
let JobsController = class JobsController {
    jobs;
    health;
    constructor(jobs, health) {
        this.jobs = jobs;
        this.health = health;
    }
    jobHealth() {
        return { jobs: this.health.snapshot() };
    }
    overdueSweep() {
        return this.jobs.runOverdueSweep();
    }
    paymentReminders() {
        return this.jobs.runPaymentReminders();
    }
    zohoRetry() {
        return this.jobs.runZohoRetry();
    }
    quoteExpiry() {
        return this.jobs.runQuoteExpiry();
    }
    emailOutbox() {
        return this.jobs.runEmailOutbox();
    }
    documentExpiryReminders() {
        return this.jobs.runDocumentExpiryReminders();
    }
    takafulExpiryReminders() {
        return this.jobs.runTakafulExpiryReminders();
    }
};
exports.JobsController = JobsController;
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.admin, client_1.UserRole.super_admin),
    (0, common_1.Get)('health'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], JobsController.prototype, "jobHealth", null);
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.admin, client_1.UserRole.super_admin),
    (0, common_1.Post)('overdue-sweep'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], JobsController.prototype, "overdueSweep", null);
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.admin, client_1.UserRole.super_admin),
    (0, common_1.Post)('payment-reminders'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], JobsController.prototype, "paymentReminders", null);
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.admin, client_1.UserRole.super_admin),
    (0, common_1.Post)('zoho-retry'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], JobsController.prototype, "zohoRetry", null);
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.admin, client_1.UserRole.super_admin),
    (0, common_1.Post)('quote-expiry'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], JobsController.prototype, "quoteExpiry", null);
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.admin, client_1.UserRole.super_admin),
    (0, common_1.Post)('email-outbox'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], JobsController.prototype, "emailOutbox", null);
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.admin, client_1.UserRole.super_admin),
    (0, common_1.Post)('document-expiry-reminders'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], JobsController.prototype, "documentExpiryReminders", null);
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.admin, client_1.UserRole.super_admin),
    (0, common_1.Post)('takaful-expiry-reminders'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], JobsController.prototype, "takafulExpiryReminders", null);
exports.JobsController = JobsController = __decorate([
    (0, common_1.Controller)('ops/jobs'),
    __metadata("design:paramtypes", [jobs_service_1.JobsService,
        job_health_service_1.JobHealthService])
], JobsController);
//# sourceMappingURL=jobs.controller.js.map