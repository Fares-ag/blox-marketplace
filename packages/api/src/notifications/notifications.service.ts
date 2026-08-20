import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { User } from '@prisma/client';
import { toPaginatedResponse, resolvePagination, PaginationQueryDto } from '../common/pagination.dto';
import { toNotificationDto } from './notification-response.dto';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async listForUser(user: User, query: PaginationQueryDto = {}) {
    const { limit, offset } = resolvePagination(query, { defaultLimit: 50, maxLimit: 100 });
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
    return toPaginatedResponse(
      rows.map((row) => toNotificationDto(row)),
      total,
      limit,
      offset,
    );
  }

  async markRead(user: User, id: string) {
    const row = await this.prisma.notification.findFirst({
      where: { id, userId: user.id },
    });
    if (!row) return { id, read: false };
    await this.prisma.notification.update({
      where: { id },
      data: { readAt: new Date() },
    });
    return { id, read: true };
  }

  unreadCount(user: User) {
    return this.prisma.notification.count({
      where: { userId: user.id, readAt: null },
    });
  }
}
