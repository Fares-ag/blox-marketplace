import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  createAgent,
  createIntegrationApp,
  destroyIntegrationApp,
  type IntegrationContext,
} from './support/app';
import { authed, signIn, signUpFresh } from './support/auth';
import { resetDatabase } from './support/db';
import {
  seedActiveApplicationWithSchedule,
  seedCompany,
  seedOffer,
  seedProduct,
} from './support/fixtures';

describe('customer payment deferrals (integration)', () => {
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

  async function seedMemberApplication() {
    const company = await seedCompany(ctx.prisma, 'Defer Co');
    const offer = await seedOffer(ctx.prisma, company.id);
    const product = await seedProduct(ctx.prisma, { companyId: company.id, offerId: offer.id });
    const customerEmail = await signUpFresh(createAgent(ctx), 'defer-customer');
    const customer = await ctx.prisma.user.findUniqueOrThrow({ where: { email: customerEmail } });
    const { application, schedule } = await seedActiveApplicationWithSchedule(ctx.prisma, {
      customer,
      company,
      product,
      offer,
    });
    await ctx.prisma.application.update({
      where: { id: application.id },
      data: { bloxMembership: { isActive: true } },
    });
    return { customerEmail, application, schedule };
  }

  it('defers a pending schedule by one month and exposes updated hub', async () => {
    const { customerEmail, application, schedule } = await seedMemberApplication();
    const agent = createAgent(ctx);
    await signIn(agent, customerEmail);

    const beforeDue = schedule.dueDate.toISOString().slice(0, 10);
    const deferRes = await authed(agent)
      .post(`/api/v1/applications/${application.id}/schedules/${schedule.id}/defer`)
      .send({ reason: 'Travel month' });
    expect(deferRes.status).toBe(200);
    expect(deferRes.body.schedule.due_date).not.toBe(beforeDue);

    const hubRes = await authed(agent).get('/api/v1/customer/payments/hub');
    expect(hubRes.status).toBe(200);
    const row = (hubRes.body.schedules as Array<{ id: string; dueDate: string }>).find(
      (s) => s.id === schedule.id,
    );
    expect(row?.dueDate.slice(0, 10)).toBe(deferRes.body.schedule.due_date);

    const deferrals = await ctx.prisma.paymentDeferral.findMany({
      where: { userId: (await ctx.prisma.user.findUniqueOrThrow({ where: { email: customerEmail } })).id },
    });
    expect(deferrals).toHaveLength(1);
    expect(deferrals[0]?.reason).toBe('Travel month');
  });

  it('returns deferral quota status', async () => {
    const { customerEmail } = await seedMemberApplication();
    const agent = createAgent(ctx);
    await signIn(agent, customerEmail);

    const statusRes = await authed(agent).get('/api/v1/customer/payments/deferral-status');
    expect(statusRes.status).toBe(200);
    expect(statusRes.body.remaining).toBe(3);
    expect(statusRes.body.membership_active).toBe(true);
  });

  it('rejects defer without active membership', async () => {
    const company = await seedCompany(ctx.prisma, 'No Member Co');
    const offer = await seedOffer(ctx.prisma, company.id);
    const product = await seedProduct(ctx.prisma, { companyId: company.id, offerId: offer.id });
    const customerEmail = await signUpFresh(createAgent(ctx), 'defer-non-member');
    const customer = await ctx.prisma.user.findUniqueOrThrow({ where: { email: customerEmail } });
    const { application, schedule } = await seedActiveApplicationWithSchedule(ctx.prisma, {
      customer,
      company,
      product,
      offer,
    });

    const agent = createAgent(ctx);
    await signIn(agent, customerEmail);
    const res = await authed(agent)
      .post(`/api/v1/applications/${application.id}/schedules/${schedule.id}/defer`)
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.error?.code).toBe('membership_required');
  });

  it('rejects defer when quota is exhausted', async () => {
    const { customerEmail, application, schedule } = await seedMemberApplication();
    const customer = await ctx.prisma.user.findUniqueOrThrow({ where: { email: customerEmail } });
    const year = new Date().getFullYear();

    for (let i = 0; i < 3; i += 1) {
      await ctx.prisma.paymentDeferral.create({
        data: {
          applicationId: application.id,
          userId: customer.id,
          originalDueDate: new Date(`${year}-0${i + 1}-01`),
          deferredToDate: new Date(`${year}-0${i + 2}-01`),
          year,
          deferredAmount: 100,
          originalAmount: 100,
        },
      });
    }

    const agent = createAgent(ctx);
    await signIn(agent, customerEmail);
    const res = await authed(agent)
      .post(`/api/v1/applications/${application.id}/schedules/${schedule.id}/defer`)
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.error?.code).toBe('deferral_quota_exhausted');
  });

  it('refuses to defer an installment that is already overdue (wave 2)', async () => {
    const { customerEmail, application, schedule } = await seedMemberApplication();
    await ctx.prisma.paymentSchedule.update({
      where: { id: schedule.id },
      data: { dueDate: new Date(Date.now() - 3 * 86_400_000), status: 'overdue' },
    });
    const agent = createAgent(ctx);
    await signIn(agent, customerEmail);

    const res = await authed(agent)
      .post(`/api/v1/applications/${application.id}/schedules/${schedule.id}/defer`)
      .send({ reason: 'Late salary' });
    expect(res.status).toBe(409);
    expect(res.body.error?.code).toBe('schedule_overdue_not_deferrable');

    // A pending installment whose due date has already passed is overdue too, whatever its status says.
    await ctx.prisma.paymentSchedule.update({
      where: { id: schedule.id },
      data: { status: 'pending' },
    });
    const lateButPending = await authed(agent)
      .post(`/api/v1/applications/${application.id}/schedules/${schedule.id}/defer`)
      .send({});
    expect(lateButPending.status).toBe(409);
    expect(lateButPending.body.error?.code).toBe('schedule_overdue_not_deferrable');
    expect(await ctx.prisma.paymentDeferral.count({ where: { applicationId: application.id } })).toBe(0);
  });

  it('forbids deferring another customer schedule', async () => {
    const { application, schedule } = await seedMemberApplication();
    const otherEmail = await signUpFresh(createAgent(ctx), 'defer-other');
    const otherAgent = createAgent(ctx);
    await signIn(otherAgent, otherEmail);

    const res = await authed(otherAgent)
      .post(`/api/v1/applications/${application.id}/schedules/${schedule.id}/defer`)
      .send({});
    expect(res.status).toBe(403);
  });

  it('mobile payments hub alias returns same schedules', async () => {
    const { customerEmail, schedule } = await seedMemberApplication();
    const agent = createAgent(ctx);
    await signIn(agent, customerEmail);

    const customerHub = await authed(agent).get('/api/v1/customer/payments/hub');
    const mobileHub = await authed(agent).get('/api/v1/mobile/payments/hub');
    expect(customerHub.status).toBe(200);
    expect(mobileHub.status).toBe(200);
    expect(mobileHub.body.schedules).toHaveLength(customerHub.body.schedules.length);
    expect(mobileHub.body.schedules.some((s: { id: string }) => s.id === schedule.id)).toBe(true);
  });
});
