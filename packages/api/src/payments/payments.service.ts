import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, ScheduleStatus, User, UserRole } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityService } from '../common/activity.service';

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

/**
 * P0-6: installment servicing. Payments happen offline (bank transfer / card at
 * dealer); finance officers record them here. Recording is transactional and
 * idempotent-safe: a fully-paid schedule cannot be paid again, and application
 * completion fires exactly once (guarded by the application status check).
 */
@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityService,
    private readonly config: ConfigService,
  ) {}

  private assertPaymentRole(user: User) {
    if (!PAYMENT_ROLES.includes(user.role)) {
      throw new ForbiddenException('forbidden_role');
    }
  }

  async listSchedules(
    user: User,
    query: { status?: ScheduleStatus; applicationId?: string; limit?: number; offset?: number },
  ) {
    if (!VIEW_ROLES.includes(user.role)) {
      throw new ForbiddenException('forbidden_role');
    }
    const take = Math.min(Math.max(query.limit ?? 50, 1), 200);
    const skip = Math.max(query.offset ?? 0, 0);
    const where: Prisma.PaymentScheduleWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.applicationId ? { applicationId: query.applicationId } : {}),
    };
    const [items, total] = await Promise.all([
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
        take,
        skip,
      }),
      this.prisma.paymentSchedule.count({ where }),
    ]);
    const today = startOfTodayUtc();
    return {
      total,
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

    const result = await this.prisma.$transaction(async (tx) => {
      const schedule = await tx.paymentSchedule.findUnique({
        where: { id: scheduleId },
        include: { application: { select: { id: true, status: true, customerUserId: true } } },
      });
      if (!schedule) throw new NotFoundException();
      if (schedule.application.status !== 'active') {
        throw new BadRequestException('application_not_active');
      }
      if (
        schedule.status === ScheduleStatus.paid ||
        schedule.status === ScheduleStatus.waived
      ) {
        throw new BadRequestException('schedule_already_settled');
      }

      const remaining = Number(schedule.remainingAmount);
      const amount = body.amount ?? remaining;
      if (!Number.isFinite(amount) || amount <= 0) {
        throw new BadRequestException('validation_failed');
      }
      if (amount > remaining + 0.005) {
        throw new BadRequestException('amount_exceeds_remaining');
      }

      const newPaid = Number(schedule.paidAmount) + amount;
      const newRemaining = Math.max(remaining - amount, 0);
      const fullyPaid = newRemaining < 0.005;

      const updated = await tx.paymentSchedule.update({
        where: { id: scheduleId },
        data: {
          paidAmount: new Prisma.Decimal(newPaid.toFixed(2)),
          remainingAmount: new Prisma.Decimal(newRemaining.toFixed(2)),
          status: fullyPaid ? ScheduleStatus.paid : schedule.status,
          paymentMethod: body.method ?? schedule.paymentMethod,
          paymentReference: body.reference ?? schedule.paymentReference,
          paidAt: fullyPaid ? new Date() : schedule.paidAt,
        },
      });

      let applicationCompleted = false;
      if (fullyPaid) {
        const unsettled = await tx.paymentSchedule.count({
          where: {
            applicationId: schedule.applicationId,
            status: { in: [ScheduleStatus.pending, ScheduleStatus.overdue] },
          },
        });
        if (unsettled === 0) {
          await tx.application.update({
            where: { id: schedule.applicationId },
            data: { status: 'completed', completedAt: new Date() },
          });
          applicationCompleted = true;
        }
      }

      return {
        updated,
        applicationCompleted,
        applicationId: schedule.applicationId,
        customerUserId: schedule.application.customerUserId,
        amount,
      };
    });

    await this.activity.log({
      actorUserId: user.id,
      entityType: 'payment_schedule',
      entityId: scheduleId,
      action: 'payment_recorded',
      toValue: result.updated.status,
      metadata: {
        applicationId: result.applicationId,
        amount: result.amount,
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

    return {
      schedule: serializeSchedule(result.updated),
      application_completed: result.applicationCompleted,
    };
  }

  async waiveSchedule(user: User, scheduleId: string, reason?: string) {
    const waiveRoles: UserRole[] = [UserRole.admin, UserRole.super_admin];
    if (!waiveRoles.includes(user.role)) {
      throw new ForbiddenException('forbidden_role');
    }
    if (!reason?.trim()) throw new BadRequestException('validation_failed');

    const result = await this.prisma.$transaction(async (tx) => {
      const schedule = await tx.paymentSchedule.findUnique({
        where: { id: scheduleId },
        include: { application: { select: { id: true, status: true, customerUserId: true } } },
      });
      if (!schedule) throw new NotFoundException();
      if (
        schedule.status === ScheduleStatus.paid ||
        schedule.status === ScheduleStatus.waived
      ) {
        throw new BadRequestException('schedule_already_settled');
      }

      const updated = await tx.paymentSchedule.update({
        where: { id: scheduleId },
        data: {
          status: ScheduleStatus.waived,
          remainingAmount: new Prisma.Decimal(0),
        },
      });

      let applicationCompleted = false;
      const unsettled = await tx.paymentSchedule.count({
        where: {
          applicationId: schedule.applicationId,
          status: { in: [ScheduleStatus.pending, ScheduleStatus.overdue] },
        },
      });
      if (unsettled === 0 && schedule.application.status === 'active') {
        await tx.application.update({
          where: { id: schedule.applicationId },
          data: { status: 'completed', completedAt: new Date() },
        });
        applicationCompleted = true;
      }

      return { updated, applicationCompleted, applicationId: schedule.applicationId };
    });

    await this.activity.log({
      actorUserId: user.id,
      entityType: 'payment_schedule',
      entityId: scheduleId,
      action: 'payment_waived',
      toValue: 'waived',
      metadata: { applicationId: result.applicationId, reason },
    });

    return {
      schedule: serializeSchedule(result.updated),
      application_completed: result.applicationCompleted,
    };
  }

  /**
   * Persists overdue status for schedules past due. Safe to run repeatedly;
   * call from an external scheduler (e.g. Railway cron) or the ops UI.
   */
  async markOverdue(user: User) {
    this.assertPaymentRole(user);
    const today = startOfTodayUtc();
    const result = await this.prisma.paymentSchedule.updateMany({
      where: { status: ScheduleStatus.pending, dueDate: { lt: today } },
      data: { status: ScheduleStatus.overdue },
    });
    if (result.count > 0) {
      await this.activity.log({
        actorUserId: user.id,
        entityType: 'payment_schedule',
        entityId: 'bulk',
        action: 'overdue_sweep',
        toValue: String(result.count),
      });
    }
    return { marked_overdue: result.count };
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

    const idempotencyKey = `skipcash:${scheduleId}:${randomUUID()}`;
    const amount = Number(schedule.remainingAmount);

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

    const marketplace =
      this.config.get<string>('MARKETPLACE_URL') ??
      this.config.get<string>('VITE_MARKETPLACE_URL') ??
      'http://localhost:5173';
    const returnUrl = `${marketplace.replace(/\/$/, '')}/app/applications/${applicationId}?skipcash_key=${encodeURIComponent(idempotencyKey)}`;
    const redirectUrl = returnUrl;

    return {
      transaction_id: txn.id,
      idempotency_key: idempotencyKey,
      amount,
      currency: 'QAR',
      redirect_url: redirectUrl,
      sandbox: true,
    };
  }

  /**
   * Idempotent completion for SkipCash verify/webhook (sandbox uses idempotency key).
   */
  async completeSkipCashPayment(idempotencyKey: string, gatewayPaymentId?: string) {
    const txn = await this.prisma.paymentTransaction.findFirst({
      where: {
        OR: [{ idempotencyKey }, { id: idempotencyKey }],
      },
    });
    if (!txn) throw new NotFoundException();
    if (txn.status === 'completed') {
      return { transaction: txn, already_completed: true };
    }
    if (!txn.scheduleId) throw new BadRequestException('validation_failed');

    await this.prisma.paymentTransaction.update({
      where: { id: txn.id },
      data: {
        status: 'completed',
        gatewayPaymentId: gatewayPaymentId ?? txn.id,
      },
    });

    const result = await this.recordPayment(
      { id: 'system', role: UserRole.super_admin } as User,
      txn.scheduleId,
      { amount: Number(txn.amount), method: 'skipcash', reference: gatewayPaymentId ?? txn.id },
    );

    return { transaction_id: txn.id, ...result, already_completed: false };
  }
}

function startOfTodayUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function serializeSchedule(s: {
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
}) {
  return {
    id: s.id,
    application_id: s.applicationId,
    sequence: s.sequence,
    due_date: s.dueDate.toISOString().slice(0, 10),
    amount: Number(s.amount),
    paid_amount: Number(s.paidAmount),
    remaining_amount: Number(s.remainingAmount),
    status: s.status,
    payment_method: s.paymentMethod,
    payment_reference: s.paymentReference,
    paid_at: s.paidAt?.toISOString() ?? null,
  };
}
