import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PushModule } from '../push/push.module';
import { WhatsAppService } from '../sms/whatsapp.service';
import { NOTIFICATION_ROUTER } from './notification-router.contract';
import { NotificationRouterService } from './notification-router.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

/**
 * Global so any module can inject `NotificationRouterService` (or the
 * `NOTIFICATION_ROUTER` token that `ActivityService` resolves lazily) without
 * importing this module and risking a cycle with `CommonModule`.
 */
@Global()
@Module({
  imports: [PrismaModule, PushModule],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    WhatsAppService,
    NotificationRouterService,
    { provide: NOTIFICATION_ROUTER, useExisting: NotificationRouterService },
  ],
  exports: [NotificationsService, NotificationRouterService, WhatsAppService, NOTIFICATION_ROUTER],
})
export class NotificationsModule {}
