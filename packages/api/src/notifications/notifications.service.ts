import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { User } from '@prisma/client';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  listForUser(user: User, limit = 50) {
    return this.prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 100),
    });
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
