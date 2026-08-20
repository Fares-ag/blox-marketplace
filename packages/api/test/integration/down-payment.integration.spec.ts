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
  assignFinanceOfficer,
  buildPricingSnapshot,
  seedCompany,
  seedDownPaymentRequiredApplication,
  seedOffer,
  seedProduct,
  setUserRole,
} from './support/fixtures';

/** P1 regression: down-payment recording and activation gate. */
describe('down payment (integration)', () => {
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

  it('record → activate succeeds when the ledger satisfies the requirement', async () => {
    const company = await seedCompany(ctx.prisma, 'Down Pay Co');
    const offer = await seedOffer(ctx.prisma, company.id);
    const product = await seedProduct(ctx.prisma, { companyId: company.id, offerId: offer.id });
    const pricingSnapshot = buildPricingSnapshot(Number(product.price));
    const requiredDown = Number(pricingSnapshot.down_payment);

    const customerEmail = await signUpFresh(createAgent(ctx), 'downpay-customer');
    const customer = await ctx.prisma.user.findUniqueOrThrow({ where: { email: customerEmail } });
    const app = await seedDownPaymentRequiredApplication(ctx.prisma, {
      customer,
      company,
      product,
      offer,
    });

    const financeEmail = await signUpFresh(createAgent(ctx), 'downpay-finance');
    const financeUser = await ctx.prisma.user.findUniqueOrThrow({ where: { email: financeEmail } });
    await setUserRole(ctx.prisma, financeUser.id, 'finance_officer', { financeScope: 'assigned' });
    await assignFinanceOfficer(ctx.prisma, financeUser.id, company.id);

    const creditEmail = await signUpFresh(createAgent(ctx), 'downpay-credit');
    const creditUser = await ctx.prisma.user.findUniqueOrThrow({ where: { email: creditEmail } });
    await setUserRole(ctx.prisma, creditUser.id, 'credit_officer', { creditScope: 'assigned' });
    await assignCreditOfficer(ctx.prisma, creditUser.id, company.id);

    const financeAgent = createAgent(ctx);
    const creditAgent = createAgent(ctx);
    await signIn(financeAgent, financeEmail);
    await signIn(creditAgent, creditEmail);

    const recordRes = await authed(financeAgent)
      .post(`/api/v1/ops/applications/${app.id}/down-payment`)
      .send({ amount: requiredDown, method: 'bank_transfer', reference: 'DP-FULL' });
    expect(recordRes.status).toBe(200);
    expect(recordRes.body.status).toBe('down_payment_submitted');

    const downPaymentEvents = await ctx.prisma.paymentEvent.findMany({
      where: { applicationId: app.id, type: 'down_payment' },
    });
    expect(downPaymentEvents).toHaveLength(1);
    expect(Number(downPaymentEvents[0]?.amount)).toBe(requiredDown);

    const queueRes = await authed(creditAgent)
      .post(`/api/v1/ops/applications/${app.id}/transition`)
      .send({ toStatus: 'pending_finance_activation' });
    expect(queueRes.status).toBe(200);
    expect(queueRes.body.status).toBe('pending_finance_activation');

    const activateRes = await authed(creditAgent).post(`/api/v1/ops/applications/${app.id}/activate`);
    expect(activateRes.status).toBe(200);
    expect(activateRes.body.status).toBe('active');
  });

  it('blocks activation when recorded down payment is insufficient', async () => {
    const company = await seedCompany(ctx.prisma, 'Down Pay Short Co');
    const offer = await seedOffer(ctx.prisma, company.id);
    const product = await seedProduct(ctx.prisma, { companyId: company.id, offerId: offer.id });
    const pricingSnapshot = buildPricingSnapshot(Number(product.price));
    const requiredDown = Number(pricingSnapshot.down_payment);

    const customerEmail = await signUpFresh(createAgent(ctx), 'downpay-short-customer');
    const customer = await ctx.prisma.user.findUniqueOrThrow({ where: { email: customerEmail } });
    const app = await seedDownPaymentRequiredApplication(ctx.prisma, {
      customer,
      company,
      product,
      offer,
    });

    const financeEmail = await signUpFresh(createAgent(ctx), 'downpay-short-finance');
    const financeUser = await ctx.prisma.user.findUniqueOrThrow({ where: { email: financeEmail } });
    await setUserRole(ctx.prisma, financeUser.id, 'finance_officer', { financeScope: 'assigned' });
    await assignFinanceOfficer(ctx.prisma, financeUser.id, company.id);

    const creditEmail = await signUpFresh(createAgent(ctx), 'downpay-short-credit');
    const creditUser = await ctx.prisma.user.findUniqueOrThrow({ where: { email: creditEmail } });
    await setUserRole(ctx.prisma, creditUser.id, 'credit_officer', { creditScope: 'assigned' });
    await assignCreditOfficer(ctx.prisma, creditUser.id, company.id);

    const financeAgent = createAgent(ctx);
    const creditAgent = createAgent(ctx);
    await signIn(financeAgent, financeEmail);
    await signIn(creditAgent, creditEmail);

    const recordRes = await authed(financeAgent)
      .post(`/api/v1/ops/applications/${app.id}/down-payment`)
      .send({ amount: requiredDown - 1, method: 'bank_transfer', reference: 'DP-SHORT' });
    expect(recordRes.status).toBe(200);
    expect(recordRes.body.status).toBe('down_payment_submitted');

    const queueRes = await authed(creditAgent)
      .post(`/api/v1/ops/applications/${app.id}/transition`)
      .send({ toStatus: 'pending_finance_activation' });
    expect(queueRes.status).toBe(200);

    const activateRes = await authed(creditAgent).post(`/api/v1/ops/applications/${app.id}/activate`);
    expect(activateRes.status).toBe(400);
    expect(activateRes.body.error.code).toBe('down_payment_incomplete');
  });
});
