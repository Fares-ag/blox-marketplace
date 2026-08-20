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
  setUserRole,
} from './support/fixtures';

/** P1 regression: dual-control waive must settle schedules without breaking paid+remaining=amount. */
describe('dual-control waive (integration)', () => {
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

  it('request → confirm → waived preserves the schedule balance invariant', async () => {
    const company = await seedCompany(ctx.prisma, 'Waive Co');
    const offer = await seedOffer(ctx.prisma, company.id);
    const product = await seedProduct(ctx.prisma, { companyId: company.id, offerId: offer.id });

    const customerEmail = await signUpFresh(createAgent(ctx), 'waive-customer');
    const customer = await ctx.prisma.user.findUniqueOrThrow({ where: { email: customerEmail } });
    const { application, schedule } = await seedActiveApplicationWithSchedule(ctx.prisma, {
      customer,
      company,
      product,
      offer,
    });

    const requesterEmail = await signUpFresh(createAgent(ctx), 'waive-requester');
    const confirmerEmail = await signUpFresh(createAgent(ctx), 'waive-confirmer');
    const requester = await ctx.prisma.user.findUniqueOrThrow({ where: { email: requesterEmail } });
    const confirmer = await ctx.prisma.user.findUniqueOrThrow({ where: { email: confirmerEmail } });
    await setUserRole(ctx.prisma, requester.id, 'admin');
    await setUserRole(ctx.prisma, confirmer.id, 'admin');

    const requesterAgent = createAgent(ctx);
    const confirmerAgent = createAgent(ctx);
    await signIn(requesterAgent, requesterEmail);
    await signIn(confirmerAgent, confirmerEmail);

    const requestRes = await authed(requesterAgent)
      .post(`/api/ops/payment-schedules/${schedule.id}/waive/request`)
      .send({ reason: 'Customer hardship — dual-control test' });
    expect(requestRes.status).toBe(201);
    expect(requestRes.body.schedule.pending_waive_requested_by_id).toBe(requester.id);

    const confirmRes = await authed(confirmerAgent).post(
      `/api/ops/payment-schedules/${schedule.id}/waive/confirm`,
    );
    expect(confirmRes.status).toBe(201);
    expect(confirmRes.body.schedule.status).toBe('waived');
    expect(confirmRes.body.schedule.paid_amount).toBe(Number(schedule.amount));
    expect(confirmRes.body.schedule.remaining_amount).toBe(0);
    expect(
      confirmRes.body.schedule.paid_amount + confirmRes.body.schedule.remaining_amount,
    ).toBe(Number(schedule.amount));

    const updated = await ctx.prisma.paymentSchedule.findUniqueOrThrow({
      where: { id: schedule.id },
    });
    expect(updated.status).toBe('waived');
    expect(Number(updated.paidAmount)).toBe(Number(schedule.amount));
    expect(Number(updated.remainingAmount)).toBe(0);
    expect(Number(updated.paidAmount) + Number(updated.remainingAmount)).toBe(
      Number(schedule.amount),
    );

    const waiveEvents = await ctx.prisma.paymentEvent.findMany({
      where: { scheduleId: schedule.id, type: 'waive' },
    });
    expect(waiveEvents).toHaveLength(1);
    expect(Number(waiveEvents[0]?.amount)).toBe(Number(schedule.remainingAmount));
    expect(waiveEvents[0]?.applicationId).toBe(application.id);
  });
});
