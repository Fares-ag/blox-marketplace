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
var JobsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.JobsService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const schedule_1 = require("@nestjs/schedule");
const client_1 = require("@prisma/client");
const cron_1 = require("cron");
const activity_service_1 = require("../common/activity.service");
const pg_advisory_lock_1 = require("../common/pg-advisory-lock");
const prisma_errors_1 = require("../common/prisma-errors");
const system_actor_1 = require("../common/system-actor");
const app_config_service_1 = require("../config/app-config.service");
const notification_preferences_1 = require("../customers/notification-preferences");
const vault_logic_1 = require("../customers/vault-logic");
const zoho_crm_service_1 = require("../integrations/zoho/zoho-crm.service");
const mail_service_1 = require("../mail/mail.service");
const notification_router_service_1 = require("../notifications/notification-router.service");
const notification_routing_1 = require("../notifications/notification-routing");
const notification_texts_1 = require("../notifications/notification-texts");
const payments_service_1 = require("../payments/payments.service");
const prisma_service_1 = require("../prisma/prisma.service");
const quotes_service_1 = require("../quotes/quotes.service");
const job_health_service_1 = require("./job-health.service");
const reminder_logic_1 = require("./reminder-logic");
const TAKAFUL_LIVE_STATUSES = [
    client_1.TakafulStatus.active,
    client_1.TakafulStatus.declared,
    client_1.TakafulStatus.pending_verification,
];
const DAY_MS = 24 * 60 * 60 * 1000;
const CRM_SYNC_STATUSES = [
    client_1.ApplicationStatus.partner_processing,
    client_1.ApplicationStatus.under_review,
    client_1.ApplicationStatus.resubmission_required,
    client_1.ApplicationStatus.contract_signing_required,
    client_1.ApplicationStatus.contracts_submitted,
    client_1.ApplicationStatus.contract_under_review,
    client_1.ApplicationStatus.down_payment_required,
    client_1.ApplicationStatus.down_payment_submitted,
    client_1.ApplicationStatus.pending_finance_activation,
    client_1.ApplicationStatus.active,
];
function parsePositiveInt(raw, fallback) {
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0)
        return fallback;
    return Math.floor(n);
}
function cronEveryNMinutes(minutes) {
    return `*/${minutes} * * * *`;
}
function startOfTodayUtc() {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}
function addDaysUtc(date, days) {
    const copy = new Date(date);
    copy.setUTCDate(copy.getUTCDate() + days);
    return copy;
}
function todayKeyUtc() {
    return startOfTodayUtc().toISOString().slice(0, 10);
}
let JobsService = JobsService_1 = class JobsService {
    config;
    schedulerRegistry;
    health;
    payments;
    quotes;
    mail;
    zoho;
    activity;
    prisma;
    appConfig;
    router;
    logger = new common_1.Logger(JobsService_1.name);
    constructor(config, schedulerRegistry, health, payments, quotes, mail, zoho, activity, prisma, appConfig, router) {
        this.config = config;
        this.schedulerRegistry = schedulerRegistry;
        this.health = health;
        this.payments = payments;
        this.quotes = quotes;
        this.mail = mail;
        this.zoho = zoho;
        this.activity = activity;
        this.prisma = prisma;
        this.appConfig = appConfig;
        this.router = router;
    }
    onModuleInit() {
        const overdueCron = this.config.get('OVERDUE_SWEEP_CRON') ?? '0 0 * * *';
        const remindersCron = this.config.get('PAYMENT_REMINDERS_CRON') ?? '0 8 * * *';
        const quoteCron = this.config.get('QUOTE_EXPIRY_CRON') ?? '0 * * * *';
        const documentRemindersCron = this.config.get('DOCUMENT_EXPIRY_REMINDERS_CRON') ?? '0 7 * * *';
        const takafulRemindersCron = this.config.get('TAKAFUL_REMINDERS_CRON') ?? '0 7 * * *';
        const zohoMinutes = parsePositiveInt(this.config.get('ZOHO_RETRY_CRON_MINUTES'), 5);
        const outboxMinutes = parsePositiveInt(this.config.get('EMAIL_OUTBOX_CRON_MINUTES'), 2);
        this.registerCron('overdue-sweep', overdueCron, () => this.runOverdueSweep());
        this.registerCron('payment-reminders', remindersCron, () => this.runPaymentReminders());
        this.registerCron('quote-expiry', quoteCron, () => this.runQuoteExpiry());
        this.registerCron('document-expiry-reminders', documentRemindersCron, () => this.runDocumentExpiryReminders());
        this.registerCron('takaful-expiry-reminders', takafulRemindersCron, () => this.runTakafulExpiryReminders());
        this.registerCron('zoho-retry', cronEveryNMinutes(zohoMinutes), () => this.runZohoRetry());
        this.registerCron('email-outbox', cronEveryNMinutes(outboxMinutes), () => this.runEmailOutbox());
        this.registerCron('job-health-check', cronEveryNMinutes(5), async () => {
            this.runHealthCheck();
        });
        this.health.registerJob('overdue-sweep', DAY_MS);
        this.health.registerJob('payment-reminders', DAY_MS);
        this.health.registerJob('quote-expiry', 60 * 60 * 1000);
        this.health.registerJob('document-expiry-reminders', DAY_MS);
        this.health.registerJob('takaful-expiry-reminders', DAY_MS);
        this.health.registerJob('zoho-retry', zohoMinutes * 60 * 1000);
        this.health.registerJob('email-outbox', outboxMinutes * 60 * 1000);
    }
    registerCron(name, expression, handler) {
        const lockKey = (0, pg_advisory_lock_1.cronJobLockKey)(`cron:${name}`);
        const job = new cron_1.CronJob(expression, () => {
            void (0, pg_advisory_lock_1.tryWithAdvisoryLock)(this.prisma, lockKey, handler)
                .then((result) => {
                if (result === null) {
                    this.logger.debug(`Job "${name}" skipped — advisory lock held by another instance`);
                }
            })
                .catch((err) => {
                const message = err instanceof Error ? err.message : String(err);
                this.logger.error(`Job "${name}" failed: ${message}`);
            });
        });
        this.schedulerRegistry.addCronJob(name, job);
        job.start();
        this.logger.log(`Registered cron job "${name}" (${expression})`);
    }
    async runOverdueSweep() {
        this.logger.log('Starting overdue sweep');
        const result = await this.payments.markOverdueSystem();
        this.logger.log(`Overdue sweep finished — marked ${result.marked_overdue} schedule(s)`);
        this.health.recordSuccess('overdue-sweep');
        return result;
    }
    async runPaymentReminders() {
        this.logger.log('Starting payment reminders');
        const daysAhead = parsePositiveInt(this.config.get('PAYMENT_REMINDER_DAYS_AHEAD'), 3);
        const today = startOfTodayUtc();
        const horizon = addDaysUtc(today, daysAhead);
        const dateKey = todayKeyUtc();
        const schedules = await this.prisma.paymentSchedule.findMany({
            where: {
                application: { status: client_1.ApplicationStatus.active },
                status: { in: [client_1.ScheduleStatus.pending, client_1.ScheduleStatus.overdue] },
                OR: [
                    { status: client_1.ScheduleStatus.overdue },
                    { status: client_1.ScheduleStatus.pending, dueDate: { lt: today } },
                    { status: client_1.ScheduleStatus.pending, dueDate: { gte: today, lte: horizon } },
                ],
            },
            include: {
                application: {
                    select: {
                        id: true,
                        customerUserId: true,
                        customerEmail: true,
                        product: { select: { make: true, model: true, modelYear: true } },
                    },
                },
            },
        });
        let dueSoon = 0;
        let overdue = 0;
        let skipped = 0;
        for (const schedule of schedules) {
            const isOverdue = schedule.status === client_1.ScheduleStatus.overdue ||
                (schedule.status === client_1.ScheduleStatus.pending && schedule.dueDate < today);
            const kind = isOverdue ? 'overdue' : 'due_soon';
            const dedupAction = `payment_reminder:${kind}:${schedule.id}:${dateKey}`;
            try {
                await this.prisma.paymentReminderSent.create({
                    data: {
                        scheduleId: schedule.id,
                        kind,
                        reminderDate: today,
                    },
                });
            }
            catch (err) {
                if ((0, prisma_errors_1.isUniqueConstraintError)(err)) {
                    skipped += 1;
                    continue;
                }
                throw err;
            }
            const vehicle = `${schedule.application.product.make} ${schedule.application.product.model} ${schedule.application.product.modelYear}`;
            const dueDate = schedule.dueDate.toISOString().slice(0, 10);
            const amount = Number(schedule.remainingAmount).toFixed(2);
            const dispatch = await this.router.dispatch({
                userId: schedule.application.customerUserId,
                category: 'payments',
                title: (0, notification_texts_1.localizedText)((t) => t.paymentTitle(kind)),
                body: (0, notification_texts_1.localizedText)((t) => t.paymentBody(kind, { vehicle, amount, dueDate })),
                linkPath: `/app/applications/${schedule.application.id}`,
                data: { schedule_id: schedule.id, application_id: schedule.application.id, kind, due_date: dueDate, amount },
            });
            await this.activity.log({
                actorUserId: system_actor_1.SYSTEM_ACTOR_USER_ID,
                entityType: 'payment_schedule',
                entityId: schedule.id,
                action: dedupAction,
                metadata: {
                    applicationId: schedule.application.id,
                    kind,
                    dueDate,
                    channels: (0, notification_routing_1.dispatchSummary)(dispatch),
                },
            });
            if (isOverdue)
                overdue += 1;
            else
                dueSoon += 1;
        }
        this.logger.log(`Payment reminders finished — due_soon=${dueSoon}, overdue=${overdue}, skipped=${skipped}`);
        this.health.recordSuccess('payment-reminders');
        return { due_soon: dueSoon, overdue, skipped };
    }
    async runZohoRetry() {
        this.logger.log('Starting Zoho retry sweep');
        const maxAttempts = parsePositiveInt(this.config.get('ZOHO_MAX_SYNC_ATTEMPTS'), 10);
        const batchSize = parsePositiveInt(this.config.get('ZOHO_RETRY_BATCH_SIZE'), 5);
        const now = new Date();
        const apps = await this.prisma.application.findMany({
            where: {
                AND: [
                    {
                        OR: [
                            { zohoSyncError: { not: null } },
                            {
                                zohoLeadId: null,
                                status: { in: CRM_SYNC_STATUSES },
                                financePartner: { crmAdapter: 'zoho' },
                            },
                        ],
                    },
                    { zohoSyncAttempts: { lt: maxAttempts } },
                    {
                        OR: [{ zohoNextRetryAt: null }, { zohoNextRetryAt: { lte: now } }],
                    },
                ],
            },
            select: { id: true },
            orderBy: { updatedAt: 'asc' },
            take: batchSize,
        });
        let succeeded = 0;
        let failed = 0;
        for (const app of apps) {
            try {
                const result = await this.zoho.syncApplicationToZoho(app.id, system_actor_1.SYSTEM_ACTOR_USER_ID);
                if (result.error)
                    failed += 1;
                else
                    succeeded += 1;
            }
            catch (err) {
                failed += 1;
                const message = err instanceof Error ? err.message : 'zoho_sync_failed';
                this.logger.error(`Zoho retry item failed for ${app.id}: ${message}`);
            }
        }
        this.logger.log(`Zoho retry finished — attempted=${apps.length}, succeeded=${succeeded}, failed=${failed}`);
        this.health.recordSuccess('zoho-retry');
        return { attempted: apps.length, succeeded, failed };
    }
    async runDocumentExpiryReminders() {
        this.logger.log('Starting document expiry reminders');
        const today = startOfTodayUtc();
        const horizon = addDaysUtc(today, Math.max(...reminder_logic_1.DOCUMENT_REMINDER_THRESHOLDS));
        const docs = await this.prisma.customerDocument.findMany({
            where: { deletedAt: null, expiresAt: { not: null, lte: horizon } },
            include: {
                user: { select: { id: true, name: true, email: true, isActive: true, notificationPreferences: true } },
            },
            orderBy: { expiresAt: 'asc' },
        });
        let notified = 0;
        let skipped = 0;
        for (const doc of docs) {
            if (!doc.expiresAt || !doc.user.isActive) {
                skipped += 1;
                continue;
            }
            const days = (0, vault_logic_1.daysBetweenUtc)(today, doc.expiresAt);
            const kind = (0, reminder_logic_1.reminderKindFor)(days, reminder_logic_1.DOCUMENT_REMINDER_THRESHOLDS);
            if (!(0, reminder_logic_1.shouldSendReminder)(kind, doc.lastReminderKind, reminder_logic_1.DOCUMENT_REMINDER_THRESHOLDS)) {
                skipped += 1;
                continue;
            }
            if (!(0, notification_preferences_1.reminderEnabled)(doc.user.notificationPreferences, 'documents')) {
                skipped += 1;
                continue;
            }
            const expiresOn = doc.expiresAt.toISOString().slice(0, 10);
            const linkPath = '/app/profile';
            const expiresAt = doc.expiresAt;
            try {
                const dispatch = await this.router.dispatch({
                    userId: doc.user.id,
                    category: 'documents',
                    title: (0, notification_texts_1.localizedText)((t) => t.documentTitle(days < 0)),
                    body: (0, notification_texts_1.localizedText)((t) => t.documentBody({ category: doc.category, days, date: expiresOn })),
                    linkPath,
                    data: { document_id: doc.id, document_category: doc.category, days_to_expiry: days, stage: kind },
                    email: (locale) => ({
                        ...(0, mail_service_1.renderDocumentExpiryEmail)({
                            name: doc.user.name,
                            documentCategory: doc.category,
                            expiresAt,
                            daysToExpiry: days,
                            url: this.appConfig.marketplacePath(linkPath),
                        }, locale),
                        template: 'document_expiry',
                    }),
                });
                await this.prisma.customerDocument.update({
                    where: { id: doc.id },
                    data: { lastReminderKind: kind, lastReminderAt: new Date() },
                });
                await this.activity.log({
                    actorUserId: system_actor_1.SYSTEM_ACTOR_USER_ID,
                    entityType: 'customer_document',
                    entityId: doc.id,
                    action: 'document_expiry_reminder',
                    fromValue: doc.lastReminderKind,
                    toValue: kind,
                    metadata: { user_id: doc.user.id, days_to_expiry: days, channels: (0, notification_routing_1.dispatchSummary)(dispatch) },
                });
                notified += 1;
            }
            catch (err) {
                skipped += 1;
                const message = err instanceof Error ? err.message : String(err);
                this.logger.error(`Document reminder failed for ${doc.id}: ${message}`);
            }
        }
        this.logger.log(`Document expiry reminders finished — notified=${notified}, skipped=${skipped}`);
        this.health.recordSuccess('document-expiry-reminders');
        return { notified, skipped };
    }
    async runTakafulExpiryReminders() {
        this.logger.log('Starting takaful expiry reminders');
        const today = startOfTodayUtc();
        const horizon = addDaysUtc(today, Math.max(...reminder_logic_1.TAKAFUL_REMINDER_THRESHOLDS));
        const policies = await this.prisma.takafulPolicy.findMany({
            where: { status: { in: TAKAFUL_LIVE_STATUSES }, expiresAt: { not: null, lte: horizon } },
            include: {
                application: {
                    select: {
                        id: true,
                        customerUserId: true,
                        customerEmail: true,
                        product: { select: { make: true, model: true, modelYear: true } },
                        customer: { select: { name: true, isActive: true, notificationPreferences: true } },
                    },
                },
            },
            orderBy: { expiresAt: 'asc' },
        });
        let notified = 0;
        let expired = 0;
        let skipped = 0;
        for (const policy of policies) {
            if (!policy.expiresAt) {
                skipped += 1;
                continue;
            }
            const days = (0, vault_logic_1.daysBetweenUtc)(today, policy.expiresAt);
            const app = policy.application;
            try {
                if (days < 0) {
                    await this.prisma.takafulPolicy.update({
                        where: { id: policy.id },
                        data: { status: client_1.TakafulStatus.expired },
                    });
                    await this.activity.log({
                        actorUserId: system_actor_1.SYSTEM_ACTOR_USER_ID,
                        entityType: 'takaful_policy',
                        entityId: policy.id,
                        action: 'takaful_expired',
                        fromValue: policy.status,
                        toValue: client_1.TakafulStatus.expired,
                        metadata: { application_id: app.id, expires_at: policy.expiresAt.toISOString().slice(0, 10) },
                    });
                    expired += 1;
                }
                const kind = (0, reminder_logic_1.reminderKindFor)(days, reminder_logic_1.TAKAFUL_REMINDER_THRESHOLDS);
                if (!(0, reminder_logic_1.shouldSendReminder)(kind, policy.lastReminderKind, reminder_logic_1.TAKAFUL_REMINDER_THRESHOLDS) ||
                    !app.customer.isActive ||
                    !(0, notification_preferences_1.reminderEnabled)(app.customer.notificationPreferences, 'takaful')) {
                    skipped += 1;
                    continue;
                }
                const vehicle = `${app.product.make} ${app.product.model} ${app.product.modelYear}`;
                const expiresOn = policy.expiresAt.toISOString().slice(0, 10);
                const expiresAt = policy.expiresAt;
                const link = `/app/applications/${app.id}`;
                const dispatch = await this.router.dispatch({
                    userId: app.customerUserId,
                    category: 'takaful',
                    title: (0, notification_texts_1.localizedText)((t) => t.takafulTitle(days < 0)),
                    body: (0, notification_texts_1.localizedText)((t) => t.takafulBody({ vehicle, days, date: expiresOn })),
                    linkPath: link,
                    data: { policy_id: policy.id, application_id: app.id, days_to_expiry: days, stage: kind },
                    email: (locale) => ({
                        ...(0, mail_service_1.renderTakafulRenewalEmail)({
                            name: app.customer.name,
                            vehicleLabel: vehicle,
                            provider: policy.provider || null,
                            expiresAt,
                            daysToExpiry: days,
                            url: this.appConfig.marketplacePath(link),
                        }, locale),
                        template: 'takaful_renewal',
                    }),
                });
                await this.prisma.takafulPolicy.update({
                    where: { id: policy.id },
                    data: { lastReminderKind: kind, lastReminderAt: new Date() },
                });
                await this.activity.log({
                    actorUserId: system_actor_1.SYSTEM_ACTOR_USER_ID,
                    entityType: 'takaful_policy',
                    entityId: policy.id,
                    action: 'takaful_expiry_reminder',
                    fromValue: policy.lastReminderKind,
                    toValue: kind,
                    metadata: { application_id: app.id, days_to_expiry: days, channels: (0, notification_routing_1.dispatchSummary)(dispatch) },
                });
                notified += 1;
            }
            catch (err) {
                skipped += 1;
                const message = err instanceof Error ? err.message : String(err);
                this.logger.error(`Takaful reminder failed for ${policy.id}: ${message}`);
            }
        }
        this.logger.log(`Takaful expiry reminders finished — notified=${notified}, expired=${expired}, skipped=${skipped}`);
        this.health.recordSuccess('takaful-expiry-reminders');
        return { notified, expired, skipped };
    }
    async runQuoteExpiry() {
        this.logger.log('Starting quote expiry sweep');
        const result = await this.quotes.expirePastQuotes();
        this.logger.log(`Quote expiry finished — expired=${result.expired}`);
        this.health.recordSuccess('quote-expiry');
        return result;
    }
    async runEmailOutbox() {
        this.logger.log('Starting email outbox worker');
        const limit = parsePositiveInt(this.config.get('EMAIL_OUTBOX_BATCH_SIZE'), 20);
        const result = await this.mail.processOutbox(limit);
        this.logger.log(`Email outbox finished — processed=${result.processed}, sent=${result.sent}, failed=${result.failed}`);
        this.health.recordSuccess('email-outbox');
        return result;
    }
    runHealthCheck() {
        this.health.checkStale();
    }
};
exports.JobsService = JobsService;
exports.JobsService = JobsService = JobsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService,
        schedule_1.SchedulerRegistry,
        job_health_service_1.JobHealthService,
        payments_service_1.PaymentsService,
        quotes_service_1.QuotesService,
        mail_service_1.MailService,
        zoho_crm_service_1.ZohoCrmService,
        activity_service_1.ActivityService,
        prisma_service_1.PrismaService,
        app_config_service_1.AppConfigService,
        notification_router_service_1.NotificationRouterService])
], JobsService);
//# sourceMappingURL=jobs.service.js.map