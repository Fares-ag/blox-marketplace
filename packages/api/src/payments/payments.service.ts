import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  NotImplementedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApplicationStatus,
  Prisma,
  PaymentEventType,
  ScheduleStatus,
  User,
  UserRole,
} from '@prisma/client';
import {
  principalAmountsFromPricingSnapshot,
  principalCollectedFromInstallment,
} from '@drivemarket/shared/pricing';
import { PrismaService } from '../prisma/prisma.service';
import { isUniqueConstraintError } from '../common/prisma-errors';
import { PaginationQueryDto, resolvePagination } from '../common/pagination.dto';
import { AppConfigService } from '../config/app-config.service';
import { ActivityService } from '../common/activity.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { SYSTEM_ACTOR, SYSTEM_ACTOR_USER_ID } from '../common/system-actor';
import { assertCompanyScope, opsCompanyFilter } from '../applications/company-scope';
import { assertRowsUpdated, transitionApplication } from '../applications/guarded-transitions';
import {
  assertDualControlWaive,
  assertSeparationOfDutiesForApplication,
  resolveSeparationOfDutiesEnabled,
} from '../applications/separation-of-duties';
import { computeScheduleAmountsFromEvents } from './payment-ledger';
import { toPaymentScheduleDto, toPaymentTransactionDto } from './payment-response.dto';

const PAYMENT_ROLES: UserRole[] = [
  UserRole.finance_officer,
  UserRole.admin,
  UserRole.super_admin,
];

const VIEW_ROLES: UserRole[] = [
  UserRole.finance_officer,
  UserRole.credit_officer,
  UserRole.admin,
  UserRole.super_admin,
];

const WAIVE_ROLES: UserRole[] = [UserRole.admin, UserRole.super_admin];

const DEFAULT_SKIPCASH_OPEN_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * P0-6: installment servicing. Payments happen offline (bank transfer / card at
 * dealer); finance officers record them here. Recording is transactional and
 * idempotent-safe: a fully-paid schedule cannot be paid again, and application
 * completion fires exactly once (guarded by the application status check).
 */
@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityService,
    private readonly analytics: AnalyticsService,
    private readonly config: ConfigService,
    private readonly appConfig: AppConfigService,
  ) {}

  private isSkipCashSandbox(): boolean {
    const flag = this.config.get<string>('SKIPCASH_SANDBOX');
    return flag === 'true' || flag === '1';
  }

  private assertWaiveRole(user: User) {
    if (!WAIVE_ROLES.includes(user.role)) {
      throw new ForbiddenException('forbidden_role');
    }
  }

  private async resolveSodEnabled(companyId: string): Promise<boolean> {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { separationOfDutiesEnabled: true },
    });
    return resolveSeparationOfDutiesEnabled(this.config, company?.separationOfDutiesEnabled);
  }

  private assertPaymentRole(user: User) {
    if (!PAYMENT_ROLES.includes(user.role)) {
      throw new ForbiddenException('forbidden_role');
    }
  }

  async listSchedules(
    user: User,
    query: PaginationQueryDto & { status?: ScheduleStatus; applicationId?: string },
  ) {
    if (!VIEW_ROLES.includes(user.role)) {
      throw new ForbiddenException('forbidden_role');
    }
    const { limit, offset } = resolvePagination(query, { defaultLimit: 50, maxLimit: 200 });
    const companyFilter = await opsCompanyFilter(this.prisma, user);
    const baseWhere: Prisma.PaymentScheduleWhereInput = {
      ...(query.applicationId ? { applicationId: query.applicationId } : {}),
      ...(companyFilter ? { application: { companyId: { in: companyFilter } } } : {}),
    };
    const where: Prisma.PaymentScheduleWhereInput = {
      ...baseWhere,
      ...(query.status ? { status: query.status } : {}),
    };
    const today = startOfTodayUtc();
    const [items, total, pending, overdueStored, pendingPastDue, paid] = await Promise.all([
      this.prisma.paymentSchedule.findMany({
        where,
        include: {
          application: {
            select: {
              id: true,
              status: true,
              customerEmail: true,
              customer: { select: { name: true } },
              product: { select: { make: true, model: true, modelYear: true } },
              company: { select: { name: true } },
            },
          },
        },
        orderBy: [{ dueDate: 'asc' }, { sequence: 'asc' }],
        take: limit,
        skip: offset,
      }),
      this.prisma.paymentSchedule.count({ where }),
      this.prisma.paymentSchedule.count({
        where: { ...baseWhere, status: ScheduleStatus.pending, dueDate: { gte: today } },
      }),
      this.prisma.paymentSchedule.count({
        where: { ...baseWhere, status: ScheduleStatus.overdue },
      }),
      this.prisma.paymentSchedule.count({
        where: { ...baseWhere, status: ScheduleStatus.pending, dueDate: { lt: today } },
      }),
      this.prisma.paymentSchedule.count({
        where: { ...baseWhere, status: ScheduleStatus.paid },
      }),
    ]);
    return {
      total,
      limit,
      offset,
      summary: {
        pending,
        overdue: overdueStored + pendingPastDue,
        paid,
      },
      items: items.map((s) => ({
        id: s.id,
        application_id: s.applicationId,
        application_status: s.application.status,
        customer_name: s.application.customer?.name ?? null,
        customer_email: s.application.customerEmail,
        vehicle: `${s.application.product.make} ${s.application.product.model} ${s.application.product.modelYear}`,
        company_name: s.application.company.name,
        sequence: s.sequence,
        due_date: s.dueDate.toISOString().slice(0, 10),
        amount: Number(s.amount),
        paid_amount: Number(s.paidAmount),
        remaining_amount: Number(s.remainingAmount),
        status: s.status,
        // Overdue is also a derived view so the UI is correct even before the
        // persistence sweep (markOverdue) has run.
        effective_status:
          s.status === ScheduleStatus.pending && s.dueDate < today
            ? ScheduleStatus.overdue
            : s.status,
        payment_method: s.paymentMethod,
        payment_reference: s.paymentReference,
        paid_at: s.paidAt?.toISOString() ?? null,
      })),
    };
  }

  async recordPayment(
    user: User,
    scheduleId: string,
    body: { amount?: number; method?: string; reference?: string },
  ) {
    this.assertPaymentRole(user);

    const schedule = await this.prisma.paymentSchedule.findUnique({
      where: { id: scheduleId },
      include: { application: { select: { id: true, status: true, customerUserId: true, companyId: true } } },
    });
    if (!schedule) throw new NotFoundException();
    await assertCompanyScope(this.prisma, user, schedule.application.companyId);

    const sodEnabled = await this.resolveSodEnabled(schedule.application.companyId);
    await assertSeparationOfDutiesForApplication(
      this.prisma,
      user.id,
      schedule.application.id,
      sodEnabled,
    );

    const result = await this.prisma.$transaction(async (tx) => {
      const locked = await lockScheduleForUpdate(tx, scheduleId);
      if (!locked) throw new NotFoundException();

      const application = await tx.application.findUnique({
        where: { id: locked.applicationId },
        select: {
          id: true,
          status: true,
          customerUserId: true,
          companyId: true,
          pricingSnapshot: true,
        },
      });
      if (!application) throw new NotFoundException();
      if (application.status !== 'active') {
        throw new BadRequestException('application_not_active');
      }
      if (
        locked.status === ScheduleStatus.paid ||
        locked.status === ScheduleStatus.waived
      ) {
        throw new BadRequestException('schedule_already_settled');
      }

      return applyPaymentInTransaction(tx, user, locked, application, body);
    });

    await this.activity.log({
      actorUserId: user.id,
      entityType: 'payment_schedule',
      entityId: scheduleId,
      action: 'payment_recorded',
      toValue: result.updated.status,
      metadata: {
        applicationId: result.applicationId,
        amount: result.amount.toFixed(2),
        method: body.method ?? null,
        reference: body.reference ?? null,
      },
    });

    if (result.applicationCompleted) {
      await this.activity.log({
        actorUserId: user.id,
        entityType: 'application',
        entityId: result.applicationId,
        action: 'status_transition',
        fromValue: 'active',
        toValue: 'completed',
        metadata: { trigger: 'final_installment_paid' },
      });
      await this.activity.notify(
        result.customerUserId,
        'Congratulations — you own your vehicle!',
        'Your final installment is recorded. Your financing is complete.',
        `/app/applications/${result.applicationId}`,
      );
    }

    this.analytics.track('payment_completed', {
      application_id: result.applicationId,
      schedule_id: scheduleId,
      amount: result.amount.toNumber(),
      method: body.method ?? 'manual',
    });

    return {
      schedule: toPaymentScheduleDto(result.updated),
      application_completed: result.applicationCompleted,
    };
  }

  async requestWaiveSchedule(user: User, scheduleId: string, reason?: string) {
    this.assertWaiveRole(user);
    if (!reason?.trim()) throw new BadRequestException('validation_failed');

    const schedule = await this.prisma.paymentSchedule.findUnique({
      where: { id: scheduleId },
      include: { application: { select: { id: true, status: true, companyId: true } } },
    });
    if (!schedule) throw new NotFoundException();
    await assertCompanyScope(this.prisma, user, schedule.application.companyId);

    const sodEnabled = await this.resolveSodEnabled(schedule.application.companyId);
    await assertSeparationOfDutiesForApplication(
      this.prisma,
      user.id,
      schedule.application.id,
      sodEnabled,
    );

    const updated = await this.prisma.$transaction(async (tx) => {
      const locked = await lockScheduleForUpdate(tx, scheduleId);
      if (!locked) throw new NotFoundException();

      if (
        locked.status === ScheduleStatus.paid ||
        locked.status === ScheduleStatus.waived
      ) {
        throw new BadRequestException('schedule_already_settled');
      }
      if (locked.pendingWaiveRequestedById) {
        throw new BadRequestException('waive_already_pending');
      }

      return tx.paymentSchedule.update({
        where: { id: scheduleId },
        data: {
          pendingWaiveReason: reason.trim(),
          pendingWaiveRequestedById: user.id,
          pendingWaiveRequestedAt: new Date(),
        },
      });
    });

    await this.activity.log({
      actorUserId: user.id,
      entityType: 'payment_schedule',
      entityId: scheduleId,
      action: 'payment_waive_requested',
      metadata: {
        applicationId: schedule.application.id,
        reason: reason.trim(),
        requestedById: user.id,
      },
    });

    return { schedule: toPaymentScheduleDto(updated) };
  }

  async confirmWaiveSchedule(user: User, scheduleId: string) {
    this.assertWaiveRole(user);

    const schedule = await this.prisma.paymentSchedule.findUnique({
      where: { id: scheduleId },
      include: { application: { select: { id: true, status: true, customerUserId: true, companyId: true } } },
    });
    if (!schedule) throw new NotFoundException();
    await assertCompanyScope(this.prisma, user, schedule.application.companyId);

    const sodEnabled = await this.resolveSodEnabled(schedule.application.companyId);
    await assertSeparationOfDutiesForApplication(
      this.prisma,
      user.id,
      schedule.application.id,
      sodEnabled,
    );

    assertDualControlWaive(user.id, schedule.pendingWaiveRequestedById);

    const waiveReason = schedule.pendingWaiveReason?.trim();
    if (!waiveReason) throw new BadRequestException('waive_not_requested');

    const requestedById = schedule.pendingWaiveRequestedById!;

    const result = await this.prisma.$transaction(async (tx) => {
      const locked = await lockScheduleForUpdate(tx, scheduleId);
      if (!locked) throw new NotFoundException();

      if (!locked.pendingWaiveRequestedById || !locked.pendingWaiveReason?.trim()) {
        throw new BadRequestException('waive_not_requested');
      }
      assertDualControlWaive(user.id, locked.pendingWaiveRequestedById);

      const application = await tx.application.findUnique({
        where: { id: locked.applicationId },
        select: {
          id: true,
          status: true,
          customerUserId: true,
          companyId: true,
          pricingSnapshot: true,
        },
      });
      if (!application) throw new NotFoundException();

      return applyWaiveInTransaction(
        tx,
        user,
        locked,
        application,
        locked.pendingWaiveReason.trim(),
        requestedById,
      );
    });

    await this.activity.log({
      actorUserId: user.id,
      entityType: 'payment_schedule',
      entityId: scheduleId,
      action: 'payment_waived',
      toValue: 'waived',
      metadata: {
        applicationId: result.applicationId,
        reason: waiveReason,
        requestedById,
        confirmedById: user.id,
      },
    });

    return {
      schedule: toPaymentScheduleDto(result.updated),
      application_completed: result.applicationCompleted,
    };
  }

  /**
   * Persists overdue status for schedules past due. Safe to run repeatedly;
   * invoked by cron or the ops UI via {@link markOverdue}.
   */
  async markOverdueSystem(): Promise<{ marked_overdue: number }> {
    const today = startOfTodayUtc();
    const result = await this.prisma.paymentSchedule.updateMany({
      where: { status: ScheduleStatus.pending, dueDate: { lt: today } },
      data: { status: ScheduleStatus.overdue },
    });
    if (result.count > 0) {
      await this.activity.log({
        actorUserId: SYSTEM_ACTOR_USER_ID,
        entityType: 'payment_schedule',
        entityId: 'bulk',
        action: 'overdue_sweep',
        toValue: String(result.count),
      });
    }
    return { marked_overdue: result.count };
  }

  /** Finance-role entry point; delegates to {@link markOverdueSystem}. */
  async markOverdue(user: User) {
    this.assertPaymentRole(user);
    return this.markOverdueSystem();
  }

  /** Sandbox SkipCash: create pending transaction and return redirect URL. */
  async createSkipCashPayment(user: User, applicationId: string, scheduleId: string) {
    if (user.role !== UserRole.customer) throw new ForbiddenException('forbidden_role');

    const schedule = await this.prisma.paymentSchedule.findUnique({
      where: { id: scheduleId },
      include: {
        application: {
          include: { company: { select: { canPay: true } } },
        },
      },
    });
    if (!schedule || schedule.applicationId !== applicationId) throw new NotFoundException();
    if (schedule.application.customerUserId !== user.id) throw new ForbiddenException('forbidden_role');
    if (schedule.application.status !== 'active') {
      throw new BadRequestException('application_not_active');
    }
    if (!schedule.application.company.canPay) {
      throw new BadRequestException('payments_not_enabled');
    }
    if (schedule.status === ScheduleStatus.paid || schedule.status === ScheduleStatus.waived) {
      throw new BadRequestException('schedule_already_settled');
    }

    const windowMs = this.skipCashOpenWindowMs();
    const windowStart = new Date(Date.now() - windowMs);

    const existingPending = await this.prisma.paymentTransaction.findFirst({
      where: {
        scheduleId,
        gateway: 'skipcash',
        status: 'pending',
        createdAt: { gte: windowStart },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (existingPending) {
      return this.serializeSkipCashPayment(existingPending, applicationId);
    }

    const windowBucket = Math.floor(Date.now() / windowMs);
    const idempotencyKey = `skipcash:${scheduleId}:${windowBucket}`;
    const amount = schedule.remainingAmount;

    try {
      const txn = await this.prisma.paymentTransaction.create({
        data: {
          gateway: 'skipcash',
          idempotencyKey,
          amount,
          applicationId,
          scheduleId,
          status: 'pending',
        },
      });

      this.analytics.track('payment_started', {
        application_id: applicationId,
        schedule_id: scheduleId,
        amount: amount.toNumber(),
        gateway: 'skipcash',
      });

      return this.serializeSkipCashPayment(txn, applicationId);
    } catch (err) {
      if (!isUniqueConstraintError(err)) throw err;

      const txn =
        (await this.prisma.paymentTransaction.findUnique({ where: { idempotencyKey } })) ??
        (await this.prisma.paymentTransaction.findFirst({
          where: {
            scheduleId,
            gateway: 'skipcash',
            status: 'pending',
            createdAt: { gte: windowStart },
          },
          orderBy: { createdAt: 'desc' },
        }));
      if (txn) {
        return this.serializeSkipCashPayment(txn, applicationId);
      }
      throw err;
    }
  }

  private skipCashOpenWindowMs(): number {
    const raw = this.config.get<string>('SKIPCASH_OPEN_WINDOW_MS');
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : DEFAULT_SKIPCASH_OPEN_WINDOW_MS;
  }

  private serializeSkipCashPayment(
    txn: { id: string; idempotencyKey: string; amount: Prisma.Decimal },
    applicationId: string,
  ) {
    const returnUrl = `${this.appConfig.marketplacePath(`/app/applications/${applicationId}`)}?skipcash_key=${encodeURIComponent(txn.idempotencyKey)}`;

    return {
      transaction_id: txn.id,
      idempotency_key: txn.idempotencyKey,
      amount: txn.amount.toNumber(),
      currency: 'QAR',
      redirect_url: returnUrl,
      sandbox: true,
    };
  }

  /**
   * Production completion path — requires verified gateway payment id.
   * Client-supplied idempotency keys are never accepted as proof of payment.
   */
  async verifyAndComplete(_gatewayPaymentId: string) {
    // TODO: HTTP call to SkipCash gateway to verify payment status for gatewayPaymentId.
    throw new NotImplementedException('skipcash_verify_not_implemented');
  }

  /**
   * Client return URL handler. In production, payment completion must go through
   * verifyAndComplete after gateway verification — not this endpoint.
   */
  async completeSkipCashPayment(idempotencyKey: string, gatewayPaymentId?: string) {
    if (!this.isSkipCashSandbox()) {
      throw new ForbiddenException('gateway_verification_required');
    }

    this.logger.warn(
      `SkipCash SANDBOX completion for idempotency key ${idempotencyKey} — payment NOT verified against gateway`,
    );
    return this.sandboxCompleteSkipCashPayment(idempotencyKey, gatewayPaymentId);
  }

  /** Local/dev only — simulates gateway-confirmed payment without verification. */
  private async sandboxCompleteSkipCashPayment(idempotencyKey: string, gatewayPaymentId?: string) {
    const txn = await this.prisma.paymentTransaction.findFirst({
      where: { idempotencyKey },
    });
    if (!txn) throw new NotFoundException();
    if (txn.status === 'completed') {
      return { transaction: toPaymentTransactionDto(txn), already_completed: true };
    }
    if (!txn.scheduleId) throw new BadRequestException('validation_failed');

    const systemUser = SYSTEM_ACTOR;

    const result = await this.prisma.$transaction(async (tx) => {
      const completed = await tx.paymentTransaction.updateMany({
        where: { id: txn.id, status: 'pending' },
        data: {
          status: 'completed',
          gatewayPaymentId: gatewayPaymentId ?? txn.id,
        },
      });
      assertRowsUpdated(completed.count, 'stale_transition');

      const locked = await lockScheduleForUpdate(tx, txn.scheduleId!);
      if (!locked) throw new NotFoundException();

      const application = await tx.application.findUnique({
        where: { id: locked.applicationId },
        select: {
          id: true,
          status: true,
          customerUserId: true,
          companyId: true,
          pricingSnapshot: true,
        },
      });
      if (!application) throw new NotFoundException();

      return applyPaymentInTransaction(tx, systemUser, locked, application, {
        amount: txn.amount,
        method: 'skipcash',
        reference: gatewayPaymentId ?? txn.id,
      });
    });

    await this.activity.log({
      actorUserId: systemUser.id,
      entityType: 'payment_schedule',
      entityId: txn.scheduleId,
      action: 'payment_recorded',
      toValue: result.updated.status,
      metadata: {
        applicationId: result.applicationId,
        amount: result.amount.toFixed(2),
        method: 'skipcash',
        reference: gatewayPaymentId ?? txn.id,
        skipcash: true,
      },
    });

    if (result.applicationCompleted) {
      await this.activity.log({
        actorUserId: systemUser.id,
        entityType: 'application',
        entityId: result.applicationId,
        action: 'status_transition',
        fromValue: 'active',
        toValue: 'completed',
        metadata: { trigger: 'final_installment_paid', skipcash: true },
      });
      await this.activity.notify(
        result.customerUserId,
        'Congratulations — you own your vehicle!',
        'Your final installment is recorded. Your financing is complete.',
        `/app/applications/${result.applicationId}`,
      );
    }

    this.analytics.track('payment_completed', {
      application_id: result.applicationId,
      schedule_id: txn.scheduleId!,
      amount: result.amount.toNumber(),
      method: 'skipcash',
      gateway: 'skipcash',
    });

    return {
      transaction_id: txn.id,
      schedule: toPaymentScheduleDto(result.updated),
      application_completed: result.applicationCompleted,
      already_completed: false,
    };
  }
}

function startOfTodayUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

const ZERO = new Prisma.Decimal(0);

type LockedScheduleRow = {
  id: string;
  applicationId: string;
  sequence: number;
  dueDate: Date;
  amount: Prisma.Decimal;
  paidAmount: Prisma.Decimal;
  remainingAmount: Prisma.Decimal;
  status: ScheduleStatus;
  paymentMethod: string | null;
  paymentReference: string | null;
  paidAt: Date | null;
  pendingWaiveReason: string | null;
  pendingWaiveRequestedById: string | null;
  pendingWaiveRequestedAt: Date | null;
};

type LockedApplicationRow = {
  id: string;
  status: ApplicationStatus;
  customerUserId: string;
  companyId: string;
  pricingSnapshot: Prisma.JsonValue;
};

/** Row-level lock — serializes concurrent payments against the same schedule. */
async function lockScheduleForUpdate(
  tx: Prisma.TransactionClient,
  scheduleId: string,
): Promise<LockedScheduleRow | null> {
  const rows = await tx.$queryRaw<LockedScheduleRow[]>`
    SELECT
      id,
      "applicationId",
      sequence,
      "dueDate",
      amount,
      "paidAmount",
      "remainingAmount",
      status,
      "paymentMethod",
      "paymentReference",
      "paidAt",
      "pendingWaiveReason",
      "pendingWaiveRequestedById",
      "pendingWaiveRequestedAt"
    FROM payment_schedules
    WHERE id = ${scheduleId}
    FOR UPDATE
  `;
  return rows[0] ?? null;
}

async function applyWaiveInTransaction(
  tx: Prisma.TransactionClient,
  user: User,
  locked: LockedScheduleRow,
  application: LockedApplicationRow,
  reason: string,
  requestedById: string,
) {
  if (
    locked.status === ScheduleStatus.paid ||
    locked.status === ScheduleStatus.waived
  ) {
    throw new BadRequestException('schedule_already_settled');
  }

  const forgiven = locked.remainingAmount;

  await tx.paymentEvent.create({
    data: {
      applicationId: locked.applicationId,
      scheduleId: locked.id,
      type: PaymentEventType.waive,
      amount: forgiven,
      currency: 'QAR',
      actorUserId: user.id,
      reason,
      metadata: { requestedById, confirmedById: user.id },
    },
  });

  const ledger = await computeScheduleAmountsFromEvents(tx, locked.id, locked.amount);

  const updated = await tx.paymentSchedule.update({
    where: { id: locked.id },
    data: {
      paidAmount: ledger.paidAmount,
      remainingAmount: ledger.remainingAmount,
      status: ScheduleStatus.waived,
      pendingWaiveReason: null,
      pendingWaiveRequestedById: null,
      pendingWaiveRequestedAt: null,
    },
  });

  assertLedgerMatchesCache(ledger, updated);

  let applicationCompleted = false;
  const unsettled = await tx.paymentSchedule.count({
    where: {
      applicationId: locked.applicationId,
      status: { in: [ScheduleStatus.pending, ScheduleStatus.overdue] },
    },
  });
  if (unsettled === 0 && application.status === 'active') {
    await transitionApplication(tx, locked.applicationId, ApplicationStatus.active, {
      status: ApplicationStatus.completed,
      completedAt: new Date(),
    });
    applicationCompleted = true;
  }

  return {
    updated,
    applicationCompleted,
    applicationId: locked.applicationId,
    customerUserId: application.customerUserId,
  };
}

async function applyPaymentInTransaction(
  tx: Prisma.TransactionClient,
  user: User,
  locked: LockedScheduleRow,
  application: LockedApplicationRow,
  body: { amount?: number | Prisma.Decimal; method?: string; reference?: string },
) {
  if (application.status !== 'active') {
    throw new BadRequestException('application_not_active');
  }
  if (
    locked.status === ScheduleStatus.paid ||
    locked.status === ScheduleStatus.waived
  ) {
    throw new BadRequestException('schedule_already_settled');
  }

  const remaining = locked.remainingAmount;
  const payAmount =
    body.amount != null
      ? body.amount instanceof Prisma.Decimal
        ? body.amount
        : new Prisma.Decimal(String(body.amount))
      : remaining;
  if (payAmount.lte(0)) {
    throw new BadRequestException('validation_failed');
  }
  if (payAmount.gt(remaining)) {
    throw new BadRequestException('amount_exceeds_remaining');
  }

  const pricingSnapshot =
    application.pricingSnapshot != null &&
    typeof application.pricingSnapshot === 'object' &&
    !Array.isArray(application.pricingSnapshot)
      ? (application.pricingSnapshot as Record<string, unknown>)
      : null;
  const scheduledPrincipal = pricingSnapshot
    ? (principalAmountsFromPricingSnapshot(pricingSnapshot)[locked.sequence - 1] ?? 0)
    : 0;
  const principalAmount = pricingSnapshot
    ? principalCollectedFromInstallment(
        payAmount.toNumber(),
        locked.amount.toNumber(),
        scheduledPrincipal,
      )
    : payAmount.toNumber();

  await tx.paymentEvent.create({
    data: {
      applicationId: locked.applicationId,
      scheduleId: locked.id,
      type: PaymentEventType.installment,
      amount: payAmount,
      currency: 'QAR',
      actorUserId: user.id,
      metadata: {
        method: body.method ?? null,
        reference: body.reference ?? null,
        principalAmount,
      },
    },
  });

  const ledger = await computeScheduleAmountsFromEvents(tx, locked.id, locked.amount);
  const fullyPaid = ledger.remainingAmount.lte(0);

  const updated = await tx.paymentSchedule.update({
    where: { id: locked.id },
    data: {
      paidAmount: ledger.paidAmount,
      remainingAmount: ledger.remainingAmount,
      status: fullyPaid ? ScheduleStatus.paid : locked.status,
      paymentMethod: body.method ?? locked.paymentMethod,
      paymentReference: body.reference ?? locked.paymentReference,
      paidAt: fullyPaid ? new Date() : locked.paidAt,
    },
  });

  assertLedgerMatchesCache(ledger, updated);

  let applicationCompleted = false;
  if (fullyPaid) {
    const unsettled = await tx.paymentSchedule.count({
      where: {
        applicationId: locked.applicationId,
        status: { in: [ScheduleStatus.pending, ScheduleStatus.overdue] },
      },
    });
    if (unsettled === 0) {
      await transitionApplication(tx, locked.applicationId, ApplicationStatus.active, {
        status: ApplicationStatus.completed,
        completedAt: new Date(),
      });
      applicationCompleted = true;
    }
  }

  return {
    updated,
    applicationCompleted,
    applicationId: locked.applicationId,
    customerUserId: application.customerUserId,
    amount: payAmount,
  };
}

function decimalEq(a: Prisma.Decimal, b: Prisma.Decimal): boolean {
  return a.toFixed(2) === b.toFixed(2);
}

function assertLedgerMatchesCache(
  ledger: { paidAmount: Prisma.Decimal; remainingAmount: Prisma.Decimal },
  cache: { paidAmount: Prisma.Decimal; remainingAmount: Prisma.Decimal },
): void {
  if (!decimalEq(ledger.paidAmount, cache.paidAmount)) {
    throw new BadRequestException('ledger_cache_mismatch');
  }
  if (!decimalEq(ledger.remainingAmount, cache.remainingAmount)) {
    throw new BadRequestException('ledger_cache_mismatch');
  }
}
