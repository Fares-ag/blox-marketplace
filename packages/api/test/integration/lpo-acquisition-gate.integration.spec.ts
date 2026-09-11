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

describe('LPO acquisition gate (integration)', () => {
  let ctx: IntegrationContext;

  beforeAll(async () => {
    ctx = await createIntegrationApp({ LPO_GATE_ENABLED: 'true' });
  });

  afterAll(async () => {
    await destroyIntegrationApp(ctx);
    delete process.env.LPO_GATE_ENABLED;
  });

  beforeEach(async () => {
    await resetDatabase(ctx.prisma);
  });

  it('refuses activate from pending_finance_activation when the LPO gate is on', async () => {
    const company = await seedCompany(ctx.prisma, 'Lpo Gate Co');
    const offer = await seedOffer(ctx.prisma, company.id);
    const product = await seedProduct(ctx.prisma, { companyId: company.id, offerId: offer.id });
    const customerEmail = await signUpFresh(createAgent(ctx), 'lpo-gate-customer');
    const customer = await ctx.prisma.user.findUniqueOrThrow({ where: { email: customerEmail } });
    const app = await seedPendingFinanceActivationApplication(ctx.prisma, {
      customer,
      company,
      product,
      offer,
    });

    const creditEmail = await signUpFresh(createAgent(ctx), 'lpo-gate-credit');
    const creditUser = await ctx.prisma.user.findUniqueOrThrow({ where: { email: creditEmail } });
    await setUserRole(ctx.prisma, creditUser.id, 'credit_officer', { creditScope: 'assigned' });
    await assignCreditOfficer(ctx.prisma, creditUser.id, company.id);
    const creditAgent = createAgent(ctx);
    await signIn(creditAgent, creditEmail);

    const res = await authed(creditAgent).post(`/api/v1/ops/applications/${app.id}/activate`);
    expect(res.status).toBe(400);
    expect(res.body.error?.code ?? res.body.message).toMatch(/lpo_gate_requires_acquisition_pending/);
  });
});
