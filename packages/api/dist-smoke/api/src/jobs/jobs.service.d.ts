import { OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { ActivityService } from '../common/activity.service';
import { AppConfigService } from '../config/app-config.service';
import { ZohoCrmService } from '../integrations/zoho/zoho-crm.service';
import { MailService } from '../mail/mail.service';
import { NotificationRouterService } from '../notifications/notification-router.service';
import { PaymentsService } from '../payments/payments.service';
import { PrismaService } from '../prisma/prisma.service';
import { QuotesService } from '../quotes/quotes.service';
import { JobHealthService } from './job-health.service';
export declare class JobsService implements OnModuleInit {
    private readonly config;
    private readonly schedulerRegistry;
    private readonly health;
    private readonly payments;
    private readonly quotes;
    private readonly mail;
    private readonly zoho;
    private readonly activity;
    private readonly prisma;
    private readonly appConfig;
    private readonly router;
    private readonly logger;
    constructor(config: ConfigService, schedulerRegistry: SchedulerRegistry, health: JobHealthService, payments: PaymentsService, quotes: QuotesService, mail: MailService, zoho: ZohoCrmService, activity: ActivityService, prisma: PrismaService, appConfig: AppConfigService, router: NotificationRouterService);
    onModuleInit(): void;
    private registerCron;
    runOverdueSweep(): Promise<{
        marked_overdue: number;
    }>;
    runPaymentReminders(): Promise<{
        due_soon: number;
        overdue: number;
        skipped: number;
    }>;
    runZohoRetry(): Promise<{
        attempted: number;
        succeeded: number;
        failed: number;
    }>;
    runDocumentExpiryReminders(): Promise<{
        notified: number;
        skipped: number;
    }>;
    runTakafulExpiryReminders(): Promise<{
        notified: number;
        expired: number;
        skipped: number;
    }>;
    runQuoteExpiry(): Promise<{
        expired: number;
    }>;
    runEmailOutbox(): Promise<{
        processed: number;
        sent: number;
        failed: number;
    }>;
    runHealthCheck(): void;
}
