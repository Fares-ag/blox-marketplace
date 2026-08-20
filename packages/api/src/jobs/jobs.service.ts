import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { ApplicationStatus, ScheduleStatus } from '@prisma/client';
import { CronJob } from 'cron';
import { ActivityService } from '../common/activity.service';
import { SYSTEM_ACTOR_USER_ID } from '../common/system-actor';
import { ZohoCrmService } from '../integrations/zoho/zoho-crm.service';
import { MailService } from '../mail/mail.service';
import { PaymentsService } from '../payments/payments.service';
import { PrismaService } from '../prisma/prisma.service';
import { QuotesService } from '../quotes/quotes.service';
import { JobHealthService } from './job-health.service';

/** Statuses where a Zoho-partner application should already have a CRM lead. */
const CRM_SYNC_STATUSES: ApplicationStatus[] = [
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
  ) {}

  onModuleInit(): void {
    const overdueCron = this.config.get<string>('OVERDUE_SWEEP_CRON') ?? '0 0 * * *';
    const remindersCron = this.config.get<string>('PAYMENT_REMINDERS_CRON') ?? '0 8 * * *';
    const quoteCron = this.config.get<string>('QUOTE_EXPIRY_CRON') ?? '0 * * * *';
    const zohoMinutes = parsePositiveInt(this.config.get<string>('ZOHO_RETRY_CRON_MINUTES'), 5);
    const outboxMinutes = parsePositiveInt(this.config.get<string>('EMAIL_OUTBOX_CRON_MINUTES'), 2);

    this.registerCron('overdue-sweep', overdueCron, () => this.runOverdueSweep());
    this.registerCron('payment-reminders', remindersCron, () => this.runPaymentReminders());
    this.registerCron('quote-expiry', quoteCron, () => this.runQuoteExpiry());
    this.registerCron('zoho-retry', cronEveryNMinutes(zohoMinutes), () => this.runZohoRetry());
    this.registerCron('email-outbox', cronEveryNMinutes(outboxMinutes), () => this.runEmailOutbox());
    this.registerCron('job-health-check', cronEveryNMinutes(5), async () => {
      this.runHealthCheck();
    });

    this.health.registerJob('overdue-sweep', 24 * 60 * 60 * 1000);
    this.health.registerJob('payment-reminders', 24 * 60 * 60 * 1000);
    this.health.registerJob('quote-expiry', 60 * 60 * 1000);
    this.health.registerJob('zoho-retry', zohoMinutes * 60 * 1000);
    this.health.registerJob('email-outbox', outboxMinutes * 60 * 1000);
  }

  private registerCron(name: string, expression: string, handler: () => Promise<unknown>): void {
    const job = new CronJob(expression, () => {
      void handler().catch((err: unknown) => {
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

      const existing = await this.prisma.activityLog.findFirst({
        where: { action: dedupAction },
        select: { id: true },
      });
      if (existing) {
        skipped += 1;
        continue;
      }

      const vehicle = `${schedule.application.product.make} ${schedule.application.product.model} ${schedule.application.product.modelYear}`;
      const dueDate = schedule.dueDate.toISOString().slice(0, 10);
      const amount = Number(schedule.remainingAmount).toFixed(2);

      const title = isOverdue
        ? 'Installment overdue'
        : 'Installment due soon';
      const body = isOverdue
        ? `Your ${vehicle} installment of QAR ${amount} was due on ${dueDate}. Please arrange payment.`
        : `Your ${vehicle} installment of QAR ${amount} is due on ${dueDate}.`;

      await this.activity.notify(
        schedule.application.customerUserId,
        title,
        body,
        `/app/applications/${schedule.application.id}`,
      );

      if (this.mail.enabled) {
        await this.mail.send({
          to: schedule.application.customerEmail,
          subject: title,
          text: `${body}\n\nView your application: /app/applications/${schedule.application.id}`,
          template: 'transactional',
          payload: {
            scheduleId: schedule.id,
            kind,
            dueDate,
            amount,
          },
        });
      }

      await this.activity.log({
        actorUserId: SYSTEM_ACTOR_USER_ID,
        entityType: 'payment_schedule',
        entityId: schedule.id,
        action: dedupAction,
        metadata: {
          applicationId: schedule.application.id,
          kind,
          dueDate,
          emailSent: this.mail.enabled,
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
      const result = await this.zoho.syncApplicationToZoho(app.id, SYSTEM_ACTOR_USER_ID);
      if (result.error) failed += 1;
      else succeeded += 1;
    }

    this.logger.log(
      `Zoho retry finished — attempted=${apps.length}, succeeded=${succeeded}, failed=${failed}`,
    );
    this.health.recordSuccess('zoho-retry');
    return { attempted: apps.length, succeeded, failed };
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
