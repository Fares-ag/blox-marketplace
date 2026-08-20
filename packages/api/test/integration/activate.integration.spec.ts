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
  assignCreditOfficer,
  seedCompany,
  seedOffer,
  seedPendingFinanceActivationApplication,
  seedProduct,
  setUserRole,
} from './support/fixtures';
import { buildScheduleDrafts } from '../../src/applications/payment-schedules';

describe('activate (integration)', () => {
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

  it('duplicate concurrent activate creates schedules once and returns stale_transition', async () => {
    const company = await seedCompany(ctx.prisma, 'Activate Race Co');
    const offer = await seedOffer(ctx.prisma, company.id);
    const product = await seedProduct(ctx.prisma, { companyId: company.id, offerId: offer.id });

    const customerEmail = await signUpFresh(createAgent(ctx), 'activate-race-customer');
    const customer = await ctx.prisma.user.findUniqueOrThrow({ where: { email: customerEmail } });
    const app = await seedPendingFinanceActivationApplication(ctx.prisma, {
      customer,
      company,
      product,
      offer,
    });

    const creditEmail = await signUpFresh(createAgent(ctx), 'activate-race-credit');
    const creditUser = await ctx.prisma.user.findUniqueOrThrow({ where: { email: creditEmail } });
    await setUserRole(ctx.prisma, creditUser.id, 'credit_officer', { creditScope: 'assigned' });
    await assignCreditOfficer(ctx.prisma, creditUser.id, company.id);

    const creditAgent = createAgent(ctx);
    await signIn(creditAgent, creditEmail);

    const expectedScheduleCount = buildScheduleDrafts(
      app.pricingSnapshot as Record<string, unknown>,
    ).length;

    const [first, second] = await Promise.all([
      authed(creditAgent).post(`/api/v1/ops/applications/${app.id}/activate`),
      authed(creditAgent).post(`/api/v1/ops/applications/${app.id}/activate`),
    ]);

    const outcomes = [first, second];
    const succeeded = outcomes.filter((res) => res.status === 200);
    const failed = outcomes.filter((res) => res.status === 409);

    expect(succeeded).toHaveLength(1);
    expect(failed).toHaveLength(1);
    expect(succeeded[0]?.body.status).toBe('active');
    expect(failed[0]?.body.error.code).toBe('stale_transition');

    const scheduleCount = await ctx.prisma.paymentSchedule.count({
      where: { applicationId: app.id },
    });
    expect(scheduleCount).toBe(expectedScheduleCount);

    const updated = await ctx.prisma.application.findUniqueOrThrow({ where: { id: app.id } });
    expect(updated.status).toBe('active');
  });
});
