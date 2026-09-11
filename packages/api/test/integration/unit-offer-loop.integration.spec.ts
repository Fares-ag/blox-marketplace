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

describe('unit offer loop (integration)', () => {
  let ctx: IntegrationContext;

  beforeAll(async () => {
    ctx = await createIntegrationApp({
      MUSHARAKAH_REGISTER_ENABLED: 'true',
      UNIT_OFFERS_ENABLED: 'true',
    });
  });

  afterAll(async () => {
    await destroyIntegrationApp(ctx);
    delete process.env.MUSHARAKAH_REGISTER_ENABLED;
    delete process.env.UNIT_OFFERS_ENABLED;
  });

  beforeEach(async () => {
    await resetDatabase(ctx.prisma);
  });

  it('creates period-1 unit offer on activate when both flags are on', async () => {
    const company = await seedCompany(ctx.prisma, 'Offer Loop Co');
    await ctx.prisma.company.update({
      where: { id: company.id },
      data: { unitOffersEnabled: true },
    });
    const offer = await seedOffer(ctx.prisma, company.id);
    const product = await seedProduct(ctx.prisma, { companyId: company.id, offerId: offer.id });
    const customerEmail = await signUpFresh(createAgent(ctx), 'offer-loop-customer');
    const customer = await ctx.prisma.user.findUniqueOrThrow({ where: { email: customerEmail } });
    const app = await seedPendingFinanceActivationApplication(ctx.prisma, {
      customer,
      company,
      product,
      offer,
    });

    const creditEmail = await signUpFresh(createAgent(ctx), 'offer-loop-credit');
    const creditUser = await ctx.prisma.user.findUniqueOrThrow({ where: { email: creditEmail } });
    await setUserRole(ctx.prisma, creditUser.id, 'credit_officer', { creditScope: 'assigned' });
    await assignCreditOfficer(ctx.prisma, creditUser.id, company.id);
    const creditAgent = createAgent(ctx);
    await signIn(creditAgent, creditEmail);

    const res = await authed(creditAgent).post(`/api/v1/ops/applications/${app.id}/activate`);
    expect(res.status).toBe(200);

    const unitOffer = await ctx.prisma.unitOffer.findUnique({
      where: { applicationId_period: { applicationId: app.id, period: 1 } },
    });
    expect(unitOffer).toBeTruthy();
    expect(unitOffer?.status).toBe('offered');
  });
});
