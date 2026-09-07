import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { ApplicationStatus, ScheduleStatus, TakafulStatus } from '@prisma/client';
import { CronJob } from 'cron';
import { ActivityService } from '../common/activity.service';
import { cronJobLockKey, tryWithAdvisoryLock } from '../common/pg-advisory-lock';
import { isUniqueConstraintError } from '../common/prisma-errors';
import { SYSTEM_ACTOR_USER_ID } from '../common/system-actor';
import { AppConfigService } from '../config/app-config.service';
import { reminderEnabled } from '../customers/notification-preferences';
import { daysBetweenUtc } from '../customers/vault-logic';
import { ZohoCrmService } from '../integrations/zoho/zoho-crm.service';
import { MailService, renderDocumentExpiryEmail, renderTakafulRenewalEmail } from '../mail/mail.service';
import { NotificationRouterService } from '../notifications/notification-router.service';
import { dispatchSummary } from '../notifications/notification-routing';
import { localizedText } from '../notifications/notification-texts';
import { PaymentsService } from '../payments/payments.service';
import { PrismaService } from '../prisma/prisma.service';
import { QuotesService } from '../quotes/quotes.service';
import { JobHealthService } from './job-health.service';
import {
  DOCUMENT_REMINDER_THRESHOLDS,
  reminderKindFor,
  shouldSendReminder,
  TAKAFUL_REMINDER_THRESHOLDS,
} from './reminder-logic';

/** Takaful policies that can still lapse (verified or awaiting verification). */
const TAKAFUL_LIVE_STATUSES: TakafulStatus[] = [
  TakafulStatus.active,
  TakafulStatus.declared,
  TakafulStatus.pending_verification,
];

const DAY_MS = 24 * 60 * 60 * 1000;

/** Statuses where a Zoho-partner application should already have a CRM lead. */
const CRM_SYNC_STATUSES: ApplicationStatus[] = [
  // Every partner-financed application sits in partner_processing by
  // construction (submittedStatusForPartner), so omitting it made the retry
  // sweep structurally incapable of recovering the one kind of application it
  // exists to protect: an Al Jazeera lead that missed its single sync attempt
  // was never retried, and the admin "run zoho-retry" button did nothing for it.
  ApplicationStatus.partner_processing,
  ApplicationStatus.under_review,
  ApplicationStatus.resubmission_required,
  ApplicationStatus.contract_signing_required,
  ApplicationStatus.contracts_submitted,
  ApplicationStatus.contract_under_review,
  ApplicationStatus.down_payment_required,
  ApplicationStatus.down_payment_submitted,
  ApplicationStatus.pending_finance_activation,
  ApplicationStatus.active,
];

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.floor(n);
}

function cronEveryNMinutes(minutes: number): string {
  return `*/${minutes} * * * *`;
}

function startOfTodayUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function addDaysUtc(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

function todayKeyUtc(): string {
  return startOfTodayUtc().toISOString().slice(0, 10);
}

@Injectable()
export class JobsService implements OnModuleInit {
  private readonly logger = new Logger(JobsService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly schedulerRegistry: SchedulerRegistry,
    private readonly health: JobHealthService,
    private readonly payments: PaymentsService,
    private readonly quotes: QuotesService,
    private readonly mail: MailService,
    private readonly zoho: ZohoCrmService,
    private readonly activity: ActivityService,
    private readonly prisma: PrismaService,
    private readonly appConfig: AppConfigService,
    private readonly router: NotificationRouterService,
  ) {}

  onModuleInit(): void {
    const overdueCron = this.config.get<string>('OVERDUE_SWEEP_CRON') ?? '0 0 * * *';
    const remindersCron = this.config.get<string>('PAYMENT_REMINDERS_CRON') ?? '0 8 * * *';
    const quoteCron = this.config.get<string>('QUOTE_EXPIRY_CRON') ?? '0 * * * *';
    const documentRemindersCron = this.config.get<string>('DOCUMENT_EXPIRY_REMINDERS_CRON') ?? '0 7 * * *';
    const takafulRemindersCron = this.config.get<string>('TAKAFUL_REMINDERS_CRON') ?? '0 7 * * *';
    const zohoMinutes = parsePositiveInt(this.config.get<string>('ZOHO_RETRY_CRON_MINUTES'), 5);
    const outboxMinutes = parsePositiveInt(this.config.get<string>('EMAIL_OUTBOX_CRON_MINUTES'), 2);

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

  private registerCron(name: string, expression: string, handler: () => Promise<unknown>): void {
    const lockKey = cronJobLockKey(`cron:${name}`);
    const job = new CronJob(expression, () => {
      void tryWithAdvisoryLock(this.prisma, lockKey, handler)
        .then((result) => {
          if (result === null) {
            this.logger.debug(`Job "${name}" skipped — advisory lock held by another instance`);
          }
        })
        .catch((err: unknown) => {
          const message = err instanceof Error ? err.message : String(err);
          this.logger.error(`Job "${name}" failed: ${message}`);
        });
    });
    this.schedulerRegistry.addCronJob(name, job);
    job.start();
    this.logger.log(`Registered cron job "${name}" (${expression})`);
  }

  async runOverdueSweep(): Promise<{ marked_overdue: number }> {
    this.logger.log('Starting overdue sweep');
    const result = await this.payments.markOverdueSystem();
    this.logger.log(`Overdue sweep finished — marked ${result.marked_overdue} schedule(s)`);
    this.health.recordSuccess('overdue-sweep');
    return result;
  }

  async runPaymentReminders(): Promise<{ due_soon: number; overdue: number; skipped: number }> {
    this.logger.log('Starting payment reminders');
    const daysAhead = parsePositiveInt(this.config.get<string>('PAYMENT_REMINDER_DAYS_AHEAD'), 3);
    const today = startOfTodayUtc();
    const horizon = addDaysUtc(today, daysAhead);
    const dateKey = todayKeyUtc();

    const schedules = await this.prisma.paymentSchedule.findMany({
      where: {
        application: { status: ApplicationStatus.active },
        status: { in: [ScheduleStatus.pending, ScheduleStatus.overdue] },
        OR: [
          { status: ScheduleStatus.overdue },
          { status: ScheduleStatus.pending, dueDate: { lt: today } },
          { status: ScheduleStatus.pending, dueDate: { gte: today, lte: horizon } },
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
      const isOverdue =
        schedule.status === ScheduleStatus.overdue ||
        (schedule.status === ScheduleStatus.pending && schedule.dueDate < today);
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
      } catch (err) {
        if (isUniqueConstraintError(err)) {
          skipped += 1;
          continue;
        }
        throw err;
      }

      const vehicle = `${schedule.application.product.make} ${schedule.application.product.model} ${schedule.application.product.modelYear}`;
      const dueDate = schedule.dueDate.toISOString().slice(0, 10);
      const amount = Number(schedule.remainingAmount).toFixed(2);

      // Fan-out (email / SMS / WhatsApp / push) follows the customer's
      // `channels.*` and `reminders.payments` preferences; in-app is always
      // written. Texts are rendered in the customer's language by the router.
      const dispatch = await this.router.dispatch({
        userId: schedule.application.customerUserId,
        category: 'payments',
        title: localizedText((t) => t.paymentTitle(kind)),
        body: localizedText((t) => t.paymentBody(kind, { vehicle, amount, dueDate })),
        linkPath: `/app/applications/${schedule.application.id}`,
        data: { schedule_id: schedule.id, application_id: schedule.application.id, kind, due_date: dueDate, amount },
      });

      await this.activity.log({
        actorUserId: SYSTEM_ACTOR_USER_ID,
        entityType: 'payment_schedule',
        entityId: schedule.id,
        action: dedupAction,
        metadata: {
          applicationId: schedule.application.id,
          kind,
          dueDate,
          channels: dispatchSummary(dispatch),
        },
      });

      if (isOverdue) overdue += 1;
      else dueSoon += 1;
    }

    this.logger.log(
      `Payment reminders finished — due_soon=${dueSoon}, overdue=${overdue}, skipped=${skipped}`,
    );
    this.health.recordSuccess('payment-reminders');
    return { due_soon: dueSoon, overdue, skipped };
  }

  async runZohoRetry(): Promise<{ attempted: number; succeeded: number; failed: number }> {
    this.logger.log('Starting Zoho retry sweep');
    const maxAttempts = parsePositiveInt(this.config.get<string>('ZOHO_MAX_SYNC_ATTEMPTS'), 10);
    const batchSize = parsePositiveInt(this.config.get<string>('ZOHO_RETRY_BATCH_SIZE'), 5);
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
        const result = await this.zoho.syncApplicationToZoho(app.id, SYSTEM_ACTOR_USER_ID);
        if (result.error) failed += 1;
        else succeeded += 1;
      } catch (err) {
        failed += 1;
        const message = err instanceof Error ? err.message : 'zoho_sync_failed';
        this.logger.error(`Zoho retry item failed for ${app.id}: ${message}`);
      }
    }

    this.logger.log(
      `Zoho retry finished — attempted=${apps.length}, succeeded=${succeeded}, failed=${failed}`,
    );
    this.health.recordSuccess('zoho-retry');
    return { attempted: apps.length, succeeded, failed };
  }

  /**
   * Document vault reminders: 60/30/7 days before a document expires and once
   * when it has. Each stage is sent once (`lastReminderKind`) and honours the
   * customer's `notificationPreferences.reminders.documents`.
   */
  async runDocumentExpiryReminders(): Promise<{ notified: number; skipped: number }> {
    this.logger.log('Starting document expiry reminders');
    const today = startOfTodayUtc();
    const horizon = addDaysUtc(today, Math.max(...DOCUMENT_REMINDER_THRESHOLDS));

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
      const days = daysBetweenUtc(today, doc.expiresAt);
      const kind = reminderKindFor(days, DOCUMENT_REMINDER_THRESHOLDS);
      if (!shouldSendReminder(kind, doc.lastReminderKind, DOCUMENT_REMINDER_THRESHOLDS)) {
        skipped += 1;
        continue;
      }
      if (!reminderEnabled(doc.user.notificationPreferences, 'documents')) {
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
          title: localizedText((t) => t.documentTitle(days < 0)),
          body: localizedText((t) => t.documentBody({ category: doc.category, days, date: expiresOn })),
          linkPath,
          data: { document_id: doc.id, document_category: doc.category, days_to_expiry: days, stage: kind },
          email: (locale) => ({
            ...renderDocumentExpiryEmail(
              {
                name: doc.user.name,
                documentCategory: doc.category,
                expiresAt,
                daysToExpiry: days,
                url: this.appConfig.marketplacePath(linkPath),
              },
              locale,
            ),
            template: 'document_expiry',
          }),
        });
        await this.prisma.customerDocument.update({
          where: { id: doc.id },
          data: { lastReminderKind: kind, lastReminderAt: new Date() },
        });
        await this.activity.log({
          actorUserId: SYSTEM_ACTOR_USER_ID,
          entityType: 'customer_document',
          entityId: doc.id,
          action: 'document_expiry_reminder',
          fromValue: doc.lastReminderKind,
          toValue: kind,
          metadata: { user_id: doc.user.id, days_to_expiry: days, channels: dispatchSummary(dispatch) },
        });
        notified += 1;
      } catch (err) {
        skipped += 1;
        const message = err instanceof Error ? err.message : String(err);
        this.logger.error(`Document reminder failed for ${doc.id}: ${message}`);
      }
    }

    this.logger.log(`Document expiry reminders finished — notified=${notified}, skipped=${skipped}`);
    this.health.recordSuccess('document-expiry-reminders');
    return { notified, skipped };
  }

  /**
   * Takaful renewals: 30/14/3 days before a policy lapses and once when it
   * has; lapsed policies are marked `expired` regardless of preferences.
   */
  async runTakafulExpiryReminders(): Promise<{ notified: number; expired: number; skipped: number }> {
    this.logger.log('Starting takaful expiry reminders');
    const today = startOfTodayUtc();
    const horizon = addDaysUtc(today, Math.max(...TAKAFUL_REMINDER_THRESHOLDS));

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
      const days = daysBetweenUtc(today, policy.expiresAt);
      const app = policy.application;

      try {
        if (days < 0) {
          await this.prisma.takafulPolicy.update({
            where: { id: policy.id },
            data: { status: TakafulStatus.expired },
          });
          await this.activity.log({
            actorUserId: SYSTEM_ACTOR_USER_ID,
            entityType: 'takaful_policy',
            entityId: policy.id,
            action: 'takaful_expired',
            fromValue: policy.status,
            toValue: TakafulStatus.expired,
            metadata: { application_id: app.id, expires_at: policy.expiresAt.toISOString().slice(0, 10) },
          });
          expired += 1;
        }

        const kind = reminderKindFor(days, TAKAFUL_REMINDER_THRESHOLDS);
        if (
          !shouldSendReminder(kind, policy.lastReminderKind, TAKAFUL_REMINDER_THRESHOLDS) ||
          !app.customer.isActive ||
          !reminderEnabled(app.customer.notificationPreferences, 'takaful')
        ) {
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
          title: localizedText((t) => t.takafulTitle(days < 0)),
          body: localizedText((t) => t.takafulBody({ vehicle, days, date: expiresOn })),
          linkPath: link,
          data: { policy_id: policy.id, application_id: app.id, days_to_expiry: days, stage: kind },
          email: (locale) => ({
            ...renderTakafulRenewalEmail(
              {
                name: app.customer.name,
                vehicleLabel: vehicle,
                provider: policy.provider || null,
                expiresAt,
                daysToExpiry: days,
                url: this.appConfig.marketplacePath(link),
              },
              locale,
            ),
            template: 'takaful_renewal',
          }),
        });
        await this.prisma.takafulPolicy.update({
          where: { id: policy.id },
          data: { lastReminderKind: kind, lastReminderAt: new Date() },
        });
        await this.activity.log({
          actorUserId: SYSTEM_ACTOR_USER_ID,
          entityType: 'takaful_policy',
          entityId: policy.id,
          action: 'takaful_expiry_reminder',
          fromValue: policy.lastReminderKind,
          toValue: kind,
          metadata: { application_id: app.id, days_to_expiry: days, channels: dispatchSummary(dispatch) },
        });
        notified += 1;
      } catch (err) {
        skipped += 1;
        const message = err instanceof Error ? err.message : String(err);
        this.logger.error(`Takaful reminder failed for ${policy.id}: ${message}`);
      }
    }

    this.logger.log(
      `Takaful expiry reminders finished — notified=${notified}, expired=${expired}, skipped=${skipped}`,
    );
    this.health.recordSuccess('takaful-expiry-reminders');
    return { notified, expired, skipped };
  }

  async runQuoteExpiry(): Promise<{ expired: number }> {
    this.logger.log('Starting quote expiry sweep');
    const result = await this.quotes.expirePastQuotes();
    this.logger.log(`Quote expiry finished — expired=${result.expired}`);
    this.health.recordSuccess('quote-expiry');
    return result;
  }

  async runEmailOutbox(): Promise<{ processed: number; sent: number; failed: number }> {
    this.logger.log('Starting email outbox worker');
    const limit = parsePositiveInt(this.config.get<string>('EMAIL_OUTBOX_BATCH_SIZE'), 20);
    const result = await this.mail.processOutbox(limit);
    this.logger.log(
      `Email outbox finished — processed=${result.processed}, sent=${result.sent}, failed=${result.failed}`,
    );
    this.health.recordSuccess('email-outbox');
    return result;
  }

  runHealthCheck(): void {
    this.health.checkStale();
  }
}
