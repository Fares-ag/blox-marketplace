import { ConfigService } from '@nestjs/config';
import { AppConfigService } from '../config/app-config.service';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { PushService } from '../push/push.service';
import { SmsService } from '../sms/sms.service';
import { WhatsAppService } from '../sms/whatsapp.service';
import { type NotificationDispatchInput, type NotificationDispatchResult, type NotificationRouter } from './notification-router.contract';
export declare class NotificationRouterService implements NotificationRouter {
    private readonly prisma;
    private readonly mail;
    private readonly sms;
    private readonly whatsapp;
    private readonly push;
    private readonly appConfig;
    private readonly logger;
    private readonly outboundEnabled;
    constructor(prisma: PrismaService, mail: MailService, sms: SmsService, whatsapp: WhatsAppService, push: PushService, appConfig: AppConfigService, config: ConfigService);
    dispatch(input: NotificationDispatchInput): Promise<NotificationDispatchResult>;
    private loadRecipient;
    private portalUrls;
    private deliver;
    private deliverEmail;
}
