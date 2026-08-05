import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ActivityService {
  constructor(private readonly prisma: PrismaService) {}

  async log(opts: {
    actorUserId?: string | null;
    entityType: string;
    entityId: string;
    action: string;
    fromValue?: string | null;
    toValue?: string | null;
    metadata?: object | null;
  }) {
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

  async notify(userId: string, title: string, body?: string, linkPath?: string) {
    await this.prisma.notification.create({
      data: { userId, title, body, linkPath },
    });
  }
}
