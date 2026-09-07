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
exports.NotificationsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const pagination_dto_1 = require("../common/pagination.dto");
const notification_response_dto_1 = require("./notification-response.dto");
let NotificationsService = class NotificationsService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async listForUser(user, query = {}) {
        const { limit, offset } = (0, pagination_dto_1.resolvePagination)(query, { defaultLimit: 50, maxLimit: 100 });
        const where = { userId: user.id };
        const [rows, total] = await Promise.all([
            this.prisma.notification.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                take: limit,
                skip: offset,
            }),
            this.prisma.notification.count({ where }),
        ]);
        return (0, pagination_dto_1.toPaginatedResponse)(rows.map((row) => (0, notification_response_dto_1.toNotificationDto)(row)), total, limit, offset);
    }
    async markRead(user, id) {
        const row = await this.prisma.notification.findFirst({
            where: { id, userId: user.id },
        });
        if (!row)
            return { id, read: false };
        await this.prisma.notification.update({
            where: { id },
            data: { readAt: new Date() },
        });
        return { id, read: true };
    }
    unreadCount(user) {
        return this.prisma.notification.count({
            where: { userId: user.id, readAt: null },
        });
    }
};
exports.NotificationsService = NotificationsService;
exports.NotificationsService = NotificationsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], NotificationsService);
//# sourceMappingURL=notifications.service.js.map