import { Injectable, Logger } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import {
  inAppOnlyDispatchResult,
  NOTIFICATION_ROUTER,
  resolveLocalizedText,
  type LocalizedText,
  type NotificationCategory,
  type NotificationData,
  type NotificationDispatchInput,
  type NotificationDispatchResult,
  type NotificationRouter,
} from '../notifications/notification-router.contract';
import { PrismaService } from '../prisma/prisma.service';

export type NotifyOptions = {
  /** Drives preference gating; defaults to `application` (transactional progress updates). */
  category?: NotificationCategory;
  data?: NotificationData;
  email?: NotificationDispatchInput['email'];
};

@Injectable()
export class ActivityService {
  private readonly logger = new Logger(ActivityService.name);
  private router: NotificationRouter | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly moduleRef: ModuleRef,
  ) {}

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

  /**
   * In-app notification plus preference-based fan-out (email / SMS / WhatsApp /
   * push) through the notification router. `title`/`body` may be plain strings
   * or `{ en, ar }` maps (see `notifications/notification-texts.ts`); the router
   * picks the recipient's language. The router is looked up lazily by token so
   * `CommonModule` never imports `NotificationsModule`; when it is not
   * registered (unit tests, partial module graphs) only the in-app row is written.
   */
  async notify(
    userId: string,
    title: LocalizedText,
    body?: LocalizedText | null,
    linkPath?: string,
    opts?: NotifyOptions,
  ): Promise<NotificationDispatchResult> {
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
        title: resolveLocalizedText(title, 'en') ?? '',
        body: resolveLocalizedText(body, 'en') ?? undefined,
        linkPath,
      },
    });
    return inAppOnlyDispatchResult(row.id, 'router_unavailable');
  }

  private resolveRouter(): NotificationRouter | null {
    if (this.router) return this.router;
    try {
      this.router = this.moduleRef?.get<NotificationRouter>(NOTIFICATION_ROUTER, { strict: false }) ?? null;
    } catch {
      this.router = null;
    }
    if (!this.router) this.logger.debug('Notification router not registered — writing in-app notifications only');
    return this.router;
  }
}
