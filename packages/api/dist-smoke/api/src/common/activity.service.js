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
var ActivityService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ActivityService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const notification_router_contract_1 = require("../notifications/notification-router.contract");
const prisma_service_1 = require("../prisma/prisma.service");
let ActivityService = ActivityService_1 = class ActivityService {
    prisma;
    moduleRef;
    logger = new common_1.Logger(ActivityService_1.name);
    router = null;
    constructor(prisma, moduleRef) {
        this.prisma = prisma;
        this.moduleRef = moduleRef;
    }
    async log(opts) {
        await this.prisma.activityLog.create({
            data: {
                actorUserId: opts.actorUserId ?? null,
                entityType: opts.entityType,
                entityId: opts.entityId,
                action: opts.action,
                fromValue: opts.fromValue ?? null,
                toValue: opts.toValue ?? null,
                metadata: opts.metadata ?? undefined,
            },
        });
    }
    async notify(userId, title, body, linkPath, opts) {
        const router = this.resolveRouter();
        if (router) {
            return router.dispatch({
                userId,
                category: opts?.category ?? 'application',
                title,
                body: body ?? null,
                linkPath: linkPath ?? null,
                data: opts?.data,
                email: opts?.email,
            });
        }
        const row = await this.prisma.notification.create({
            data: {
                userId,
                title: (0, notification_router_contract_1.resolveLocalizedText)(title, 'en') ?? '',
                body: (0, notification_router_contract_1.resolveLocalizedText)(body, 'en') ?? undefined,
                linkPath,
            },
        });
        return (0, notification_router_contract_1.inAppOnlyDispatchResult)(row.id, 'router_unavailable');
    }
    resolveRouter() {
        if (this.router)
            return this.router;
        try {
            this.router = this.moduleRef?.get(notification_router_contract_1.NOTIFICATION_ROUTER, { strict: false }) ?? null;
        }
        catch {
            this.router = null;
        }
        if (!this.router)
            this.logger.debug('Notification router not registered — writing in-app notifications only');
        return this.router;
    }
};
exports.ActivityService = ActivityService;
exports.ActivityService = ActivityService = ActivityService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        core_1.ModuleRef])
], ActivityService);
//# sourceMappingURL=activity.service.js.map