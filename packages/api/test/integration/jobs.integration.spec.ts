import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { JobsService } from '../../src/jobs/jobs.service';
import { PaymentsService } from '../../src/payments/payments.service';
import { SYSTEM_ACTOR_USER_ID } from '../../src/common/system-actor';
import {
  createAgent,
  createIntegrationApp,
  destroyIntegrationApp,
  type IntegrationContext,
} from './support/app';
import { resetDatabase } from './support/db';
import {
  seedActiveApplicationWithSchedule,
  seedCompany,
  seedOffer,
  seedProduct,
} from './support/fixtures';
import { signUpFresh } from './support/auth';

function addDaysUtc(days: number): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + days));
}

function todayKeyUtc(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
    .toISOString()
    .slice(0, 10);
}

describe('system actor cron jobs (integration)', () => {
  let ctx: IntegrationContext;

  beforeAll(async () => {
    ctx = await createIntegrationApp();
  });

  afterAll(async () => {
    await destroyIntegrationApp(ctx);
  });

  beforeEach(async () => {
    await resetDatabase(ctx.prisma);
  });

  it('keeps the system user available after integration DB resets', async () => {
    const systemUser = await ctx.prisma.user.findUniqueOrThrow({
      where: { id: SYSTEM_ACTOR_USER_ID },
    });
    expect(systemUser.role).toBe('super_admin');
    expect(systemUser.isActive).toBe(true);
    expect(systemUser.email).toBe('system@internal.blox.invalid');
  });

  it('payment-reminder job writes dedup rows and skips repeat runs', async () => {
    const company = await seedCompany(ctx.prisma, 'Reminder Co');
    const offer = await seedOffer(ctx.prisma, company.id);
    const product = await seedProduct(ctx.prisma, { companyId: company.id, offerId: offer.id });

    const customerEmail = await signUpFresh(createAgent(ctx), 'reminder-customer');
    const customer = await ctx.prisma.user.findUniqueOrThrow({ where: { email: customerEmail } });
    const { application, schedule } = await seedActiveApplicationWithSchedule(ctx.prisma, {
      customer,
      company,
      product,
      offer,
    });

    await ctx.prisma.paymentSchedule.update({
      where: { id: schedule.id },
      data: { dueDate: addDaysUtc(2), status: 'pending' },
    });

    const jobs = ctx.app.get(JobsService);
    const first = await jobs.runPaymentReminders();
    expect(first.due_soon).toBe(1);
    expect(first.skipped).toBe(0);

    const dedupRow = await ctx.prisma.paymentReminderSent.findFirstOrThrow({
      where: { scheduleId: schedule.id, kind: 'due_soon', reminderDate: addDaysUtc(0) },
    });
    expect(dedupRow.scheduleId).toBe(schedule.id);

    const dedupAction = `payment_reminder:due_soon:${schedule.id}:${todayKeyUtc()}`;
    const dedupLog = await ctx.prisma.activityLog.findFirstOrThrow({
      where: { action: dedupAction },
    });
    expect(dedupLog.actorUserId).toBe(SYSTEM_ACTOR_USER_ID);

    const notificationsAfterFirst = await ctx.prisma.notification.count({
      where: { userId: customer.id },
    });
    expect(notificationsAfterFirst).toBe(1);

    const second = await jobs.runPaymentReminders();
    expect(second.skipped).toBe(1);
    expect(second.due_soon).toBe(0);

    const notificationsAfterSecond = await ctx.prisma.notification.count({
      where: { userId: customer.id },
    });
    expect(notificationsAfterSecond).toBe(1);

    const dedupLogs = await ctx.prisma.activityLog.count({
      where: { action: dedupAction },
    });
    expect(dedupLogs).toBe(1);
    expect(await ctx.prisma.paymentReminderSent.count({ where: { scheduleId: schedule.id } })).toBe(1);
    expect(application.id).toBeTruthy();
  });

  it('concurrent payment-reminder runs send at most one notification per schedule', async () => {
    const company = await seedCompany(ctx.prisma, 'Reminder Race Co');
    const offer = await seedOffer(ctx.prisma, company.id);
    const product = await seedProduct(ctx.prisma, { companyId: company.id, offerId: offer.id });

    const customerEmail = await signUpFresh(createAgent(ctx), 'reminder-race-customer');
    const customer = await ctx.prisma.user.findUniqueOrThrow({ where: { email: customerEmail } });
    const { schedule } = await seedActiveApplicationWithSchedule(ctx.prisma, {
      customer,
      company,
      product,
      offer,
    });

    await ctx.prisma.paymentSchedule.update({
      where: { id: schedule.id },
      data: { dueDate: addDaysUtc(2), status: 'pending' },
    });

    const jobs = ctx.app.get(JobsService);
    const [first, second] = await Promise.all([
      jobs.runPaymentReminders(),
      jobs.runPaymentReminders(),
    ]);

    const sent = first.due_soon + first.overdue + second.due_soon + second.overdue;
    const skipped = first.skipped + second.skipped;
    expect(sent).toBe(1);
    expect(skipped).toBe(1);

    expect(await ctx.prisma.notification.count({ where: { userId: customer.id } })).toBe(1);
    expect(await ctx.prisma.paymentReminderSent.count({ where: { scheduleId: schedule.id } })).toBe(1);
  });

  it('overdue sweep logs activity with the system actor', async () => {
    const company = await seedCompany(ctx.prisma, 'Overdue Co');
    const offer = await seedOffer(ctx.prisma, company.id);
    const product = await seedProduct(ctx.prisma, { companyId: company.id, offerId: offer.id });

    const customerEmail = await signUpFresh(createAgent(ctx), 'overdue-customer');
    const customer = await ctx.prisma.user.findUniqueOrThrow({ where: { email: customerEmail } });
    const { schedule } = await seedActiveApplicationWithSchedule(ctx.prisma, {
      customer,
      company,
      product,
      offer,
    });

    await ctx.prisma.paymentSchedule.update({
      where: { id: schedule.id },
      data: { dueDate: addDaysUtc(-1), status: 'pending' },
    });

    const payments = ctx.app.get(PaymentsService);
    const result = await payments.markOverdueSystem();
    expect(result.marked_overdue).toBe(1);

    const updatedSchedule = await ctx.prisma.paymentSchedule.findUniqueOrThrow({
      where: { id: schedule.id },
    });
    expect(updatedSchedule.status).toBe('overdue');

    const sweepLog = await ctx.prisma.activityLog.findFirstOrThrow({
      where: { action: 'overdue_sweep' },
    });
    expect(sweepLog.actorUserId).toBe(SYSTEM_ACTOR_USER_ID);
    expect(sweepLog.toValue).toBe('1');
  });
});
