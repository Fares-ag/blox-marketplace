import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  createAgent,
  createIntegrationApp,
  destroyIntegrationApp,
  type IntegrationContext,
} from './support/app';
import { authed, signUpFresh } from './support/auth';
import { countRows, resetDatabase } from './support/db';
import {
  buildPricingSnapshot,
  seedActiveApplicationWithSchedule,
  seedCompany,
  seedOffer,
  seedProduct,
} from './support/fixtures';

describe('client idempotency (integration)', () => {
  let ctx: IntegrationContext;

  beforeAll(async () => {
    ctx = await createIntegrationApp({ SKIPCASH_SANDBOX: 'true' });
  });

  afterAll(async () => {
    await destroyIntegrationApp(ctx);
  });

  beforeEach(async () => {
    await resetDatabase(ctx.prisma);
  });

  it('replays POST /applications with the same Idempotency-Key', async () => {
    const company = await seedCompany(ctx.prisma, 'Idempotency Co');
    const offer = await seedOffer(ctx.prisma, company.id);
    const product = await seedProduct(ctx.prisma, { companyId: company.id, offerId: offer.id });

    const customerAgent = createAgent(ctx);
    await signUpFresh(customerAgent, 'idempotency-customer');

    const pricingSnapshot = buildPricingSnapshot(Number(product.price));
    const body = {
      productId: product.id,
      offerId: offer.id,
      customerSnapshot: {
        full_name: 'Idempotent Customer',
        phone: '+97451112222',
        qid: '28012345678',
        employment: 'Acme',
        income: 12000,
      },
      pricingSnapshot,
    };

    const first = await authed(customerAgent)
      .post('/api/v1/applications')
      .set('Idempotency-Key', 'create-app-1')
      .send(body);
    expect(first.status).toBe(201);
    const appId = first.body.id as string;

    const second = await authed(customerAgent)
      .post('/api/v1/applications')
      .set('Idempotency-Key', 'create-app-1')
      .send(body);
    expect(second.status).toBe(201);
    expect(second.body.id).toBe(appId);

    expect(await countRows(ctx.prisma, 'applications')).toBe(1);
    expect(await countRows(ctx.prisma, 'idempotency_records')).toBe(1);
  });

  it('double SkipCash pay returns one pending transaction for the schedule', async () => {
    const customerAgent = createAgent(ctx);
    const customerEmail = await signUpFresh(customerAgent, 'skipcash-idempotent');
    const customer = await ctx.prisma.user.findUniqueOrThrow({ where: { email: customerEmail } });

    const company = await seedCompany(ctx.prisma, 'SkipCash Idempotency Co');
    await ctx.prisma.company.update({ where: { id: company.id }, data: { canPay: true } });
    const offer = await seedOffer(ctx.prisma, company.id);
    const product = await seedProduct(ctx.prisma, { companyId: company.id, offerId: offer.id });
    const { application, schedule } = await seedActiveApplicationWithSchedule(ctx.prisma, {
      customer,
      company,
      product,
      offer,
    });

    const first = await authed(customerAgent)
      .post(`/api/v1/applications/${application.id}/schedules/${schedule.id}/skipcash`)
      .set('Idempotency-Key', 'skipcash-pay-1');
    expect(first.status).toBe(201);
    expect(first.body.transaction_id).toBeTruthy();

    const second = await authed(customerAgent)
      .post(`/api/v1/applications/${application.id}/schedules/${schedule.id}/skipcash`)
      .set('Idempotency-Key', 'skipcash-pay-1');
    expect(second.status).toBe(201);
    expect(second.body.transaction_id).toBe(first.body.transaction_id);
    expect(second.body.idempotency_key).toBe(first.body.idempotency_key);

    const pending = await ctx.prisma.paymentTransaction.findMany({
      where: { scheduleId: schedule.id, status: 'pending', gateway: 'skipcash' },
    });
    expect(pending).toHaveLength(1);
  });

  it('SkipCash double-click without Idempotency-Key still reuses the open pending transaction', async () => {
    const customerAgent = createAgent(ctx);
    const customerEmail = await signUpFresh(customerAgent, 'skipcash-double-click');
    const customer = await ctx.prisma.user.findUniqueOrThrow({ where: { email: customerEmail } });

    const company = await seedCompany(ctx.prisma, 'SkipCash Window Co');
    await ctx.prisma.company.update({ where: { id: company.id }, data: { canPay: true } });
    const offer = await seedOffer(ctx.prisma, company.id);
    const product = await seedProduct(ctx.prisma, { companyId: company.id, offerId: offer.id });
    const { application, schedule } = await seedActiveApplicationWithSchedule(ctx.prisma, {
      customer,
      company,
      product,
      offer,
    });

    const first = await authed(customerAgent).post(
      `/api/v1/applications/${application.id}/schedules/${schedule.id}/skipcash`,
    );
    expect(first.status).toBe(201);

    const second = await authed(customerAgent).post(
      `/api/v1/applications/${application.id}/schedules/${schedule.id}/skipcash`,
    );
    expect(second.status).toBe(201);
    expect(second.body.transaction_id).toBe(first.body.transaction_id);

    const pending = await ctx.prisma.paymentTransaction.findMany({
      where: { scheduleId: schedule.id, status: 'pending', gateway: 'skipcash' },
    });
    expect(pending).toHaveLength(1);
  });
});
