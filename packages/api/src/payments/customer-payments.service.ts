import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ScheduleStatus, User } from '@prisma/client';
import type { InstallmentPlan, PaymentScheduleRow } from '@drivemarket/shared/installment-plan';
import { PrismaService } from '../prisma/prisma.service';
import { CreditsService } from '../credits/credits.service';
import { DEFERRALS_PER_CALENDAR_YEAR } from './customer-payments.constants';

const DEFERRABLE_STATUSES: ScheduleStatus[] = ['pending', 'overdue'];

export function hasActiveBloxMembership(bloxMembership: unknown): boolean {
  if (!bloxMembership || typeof bloxMembership !== 'object') return false;
  const m = bloxMembership as Record<string, unknown>;
  const active = m.isActive ?? m.is_active;
  return active === true;
}

function addOneCalendarMonth(date: Date): Date {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth();
  const d = date.getUTCDate();
  return new Date(Date.UTC(y, m + 1, d));
}

function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

@Injectable()
export class CustomerPaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly credits: CreditsService,
  ) {}

  async paymentsHub(user: User) {
    const schedules = await this.prisma.paymentSchedule.findMany({
      where: { application: { customerUserId: user.id } },
      include: {
        application: {
          select: {
            id: true,
            status: true,
            productId: true,
            bloxMembership: true,
            product: { select: { make: true, model: true, modelYear: true } },
          },
        },
      },
      orderBy: { dueDate: 'asc' },
    });
    const credits = await this.credits.getBalance(user);
    return { schedules, credits };
  }

  async deferralStatus(user: User) {
    const year = new Date().getFullYear();
    const used = await this.prisma.paymentDeferral.count({
      where: { userId: user.id, year },
    });
    const activeApps = await this.prisma.application.findMany({
      where: { customerUserId: user.id, status: 'active' },
      select: { bloxMembership: true },
    });
    const membershipActive = activeApps.some((app) => hasActiveBloxMembership(app.bloxMembership));

    return {
      year,
      used,
      remaining: Math.max(DEFERRALS_PER_CALENDAR_YEAR - used, 0),
      limit: DEFERRALS_PER_CALENDAR_YEAR,
      membership_active: membershipActive,
    };
  }

  async deferPayment(
    user: User,
    applicationId: string,
    scheduleId: string,
    reason?: string,
  ) {
    const app = await this.prisma.application.findUnique({
      where: { id: applicationId },
      select: {
        id: true,
        customerUserId: true,
        bloxMembership: true,
        installmentPlan: true,
      },
    });
    if (!app) throw new NotFoundException('application_not_found');
    if (app.customerUserId !== user.id) throw new ForbiddenException('forbidden_role');

    if (!hasActiveBloxMembership(app.bloxMembership)) {
      throw new BadRequestException('membership_required');
    }

    const quota = await this.deferralStatus(user);
    if (quota.remaining <= 0) {
      throw new BadRequestException('deferral_quota_exhausted');
    }

    const schedule = await this.prisma.paymentSchedule.findFirst({
      where: { id: scheduleId, applicationId },
    });
    if (!schedule) throw new NotFoundException('schedule_not_found');

    if (!DEFERRABLE_STATUSES.includes(schedule.status)) {
      throw new BadRequestException('schedule_not_deferrable');
    }

    const originalDueDate = schedule.dueDate;
    const deferredToDate = addOneCalendarMonth(originalDueDate);
    const year = new Date().getFullYear();
    const amount = Number(schedule.remainingAmount);

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.paymentDeferral.create({
        data: {
          applicationId,
          userId: user.id,
          paymentId: scheduleId,
          originalDueDate,
          deferredToDate,
          reason: reason?.trim() || null,
          year,
          deferredAmount: amount,
          originalAmount: Number(schedule.amount),
        },
      });

      const row = await tx.paymentSchedule.update({
        where: { id: scheduleId },
        data: { dueDate: deferredToDate },
      });

      const planRaw = app.installmentPlan;
      if (planRaw && typeof planRaw === 'object') {
        const plan = planRaw as InstallmentPlan;
        const origKey = formatDateOnly(originalDueDate);
        const updatedSchedule = (plan.schedule ?? []).map((entry: PaymentScheduleRow) => {
          const entryDue = entry.dueDate?.split('T')[0];
          const matches =
            entryDue === origKey ||
            (entry.sequence != null && entry.sequence === schedule.sequence);
          if (!matches) return entry;
          return {
            ...entry,
            dueDate: formatDateOnly(deferredToDate),
            isDeferred: true,
            originalDueDate: entry.originalDueDate ?? origKey,
          };
        });
        await tx.application.update({
          where: { id: applicationId },
          data: {
            installmentPlan: {
              ...plan,
              schedule: updatedSchedule,
            },
          },
        });
      }

      return row;
    });

    return {
      schedule: {
        id: updated.id,
        application_id: updated.applicationId,
        sequence: updated.sequence,
        due_date: formatDateOnly(updated.dueDate),
        amount: Number(updated.amount),
        remaining_amount: Number(updated.remainingAmount),
        status: updated.status,
      },
      deferral_status: await this.deferralStatus(user),
    };
  }
}
