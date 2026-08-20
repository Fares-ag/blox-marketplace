import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import {
  createAgent,
  createIntegrationApp,
  destroyIntegrationApp,
  type IntegrationContext,
} from './support/app';
import { authed, signIn, signUpFresh } from './support/auth';
import { countRows, resetDatabase } from './support/db';
import {
  assignCreditOfficer,
  assignFinanceOfficer,
  seedActiveApplicationWithSchedule,
  seedApplicationWithContractPdf,
  seedCompany,
  seedOffer,
  seedPassingComplianceCheck,
  seedPendingFinanceActivationApplication,
  seedProduct,
  seedRequiredDocuments,
  seedUnderReviewApplication,
  setUserRole,
} from './support/fixtures';

describe('regression locks (integration)', () => {
  let ctx: IntegrationContext;

  beforeAll(async () => {
    ctx = await createIntegrationApp({ SKIPCASH_SANDBOX: 'false' });
  });

  afterAll(async () => {
    await destroyIntegrationApp(ctx);
  });

  beforeEach(async () => {
    await resetDatabase(ctx.prisma);
  });

  it('P0-A: SkipCash complete is forbidden when SKIPCASH_SANDBOX is false and changes no rows', async () => {
    const customerEmail = await signUpFresh(createAgent(ctx), 'skipcash-customer');
    const customer = await ctx.prisma.user.findUniqueOrThrow({ where: { email: customerEmail } });

    const company = await seedCompany(ctx.prisma, 'SkipCash Co');
    const offer = await seedOffer(ctx.prisma, company.id);
    const product = await seedProduct(ctx.prisma, { companyId: company.id, offerId: offer.id });
    const { application, schedule } = await seedActiveApplicationWithSchedule(ctx.prisma, {
      customer,
      company,
      product,
      offer,
    });

    const idempotencyKey = `skipcash-regression-${application.id}`;
    await ctx.prisma.paymentTransaction.create({
      data: {
        idempotencyKey,
        amount: schedule.remainingAmount,
        applicationId: application.id,
        scheduleId: schedule.id,
        status: 'pending',
      },
    });

    const txnBefore = await ctx.prisma.paymentTransaction.findFirstOrThrow({
      where: { idempotencyKey },
    });
    const scheduleBefore = await ctx.prisma.paymentSchedule.findUniqueOrThrow({
      where: { id: schedule.id },
    });

    const res = await request(ctx.app.getHttpServer())
      .post('/api/v1/payments/skipcash/complete')
      .send({ idempotency_key: idempotencyKey, gateway_payment_id: 'gw-fake-123' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('gateway_verification_required');
    expect(res.body.error.requestId).toBeTruthy();

    const txnAfter = await ctx.prisma.paymentTransaction.findFirstOrThrow({
      where: { idempotencyKey },
    });
    const scheduleAfter = await ctx.prisma.paymentSchedule.findUniqueOrThrow({
      where: { id: schedule.id },
    });

    expect(txnAfter.status).toBe(txnBefore.status);
    expect(Number(txnAfter.amount)).toBe(Number(txnBefore.amount));
    expect(Number(scheduleAfter.paidAmount)).toBe(Number(scheduleBefore.paidAmount));
    expect(Number(scheduleAfter.remainingAmount)).toBe(Number(scheduleBefore.remainingAmount));
    expect(scheduleAfter.status).toBe(scheduleBefore.status);
    expect(await countRows(ctx.prisma, 'payment_events')).toBe(0);
  });

  it('P0-1: credit officer scoped to Company A cannot lifecycle-mutate Company B or download its contract', async () => {
    const companyA = await seedCompany(ctx.prisma, 'Lifecycle Co A');
    const companyB = await seedCompany(ctx.prisma, 'Lifecycle Co B');
    const offerA = await seedOffer(ctx.prisma, companyA.id);
    const offerB = await seedOffer(ctx.prisma, companyB.id);

    async function customer(prefix: string) {
      const email = await signUpFresh(createAgent(ctx), prefix);
      return ctx.prisma.user.findUniqueOrThrow({ where: { email } });
    }

    const productAReview = await seedProduct(ctx.prisma, { companyId: companyA.id, offerId: offerA.id });
    const productBReview = await seedProduct(ctx.prisma, { companyId: companyB.id, offerId: offerB.id });
    const productAActivate = await seedProduct(ctx.prisma, { companyId: companyA.id, offerId: offerA.id });
    const productBActivate = await seedProduct(ctx.prisma, { companyId: companyB.id, offerId: offerB.id });
    const productATransition = await seedProduct(ctx.prisma, { companyId: companyA.id, offerId: offerA.id });
    const productBTransition = await seedProduct(ctx.prisma, { companyId: companyB.id, offerId: offerB.id });
    const productAContract = await seedProduct(ctx.prisma, { companyId: companyA.id, offerId: offerA.id });
    const productBContract = await seedProduct(ctx.prisma, { companyId: companyB.id, offerId: offerB.id });

    const appAReview = await seedUnderReviewApplication(ctx.prisma, {
      customer: await customer('lifecycle-a-review'),
      company: companyA,
      product: productAReview,
      offer: offerA,
    });
    const appBReview = await seedUnderReviewApplication(ctx.prisma, {
      customer: await customer('lifecycle-b-review'),
      company: companyB,
      product: productBReview,
      offer: offerB,
    });
    await seedPassingComplianceCheck(ctx.prisma, appAReview.id);

    const appAActivate = await seedPendingFinanceActivationApplication(ctx.prisma, {
      customer: await customer('lifecycle-a-activate'),
      company: companyA,
      product: productAActivate,
      offer: offerA,
    });
    const appBActivate = await seedPendingFinanceActivationApplication(ctx.prisma, {
      customer: await customer('lifecycle-b-activate'),
      company: companyB,
      product: productBActivate,
      offer: offerB,
    });

    const appATransition = await seedUnderReviewApplication(ctx.prisma, {
      customer: await customer('lifecycle-a-transition'),
      company: companyA,
      product: productATransition,
      offer: offerA,
    });
    const appBTransition = await seedUnderReviewApplication(ctx.prisma, {
      customer: await customer('lifecycle-b-transition'),
      company: companyB,
      product: productBTransition,
      offer: offerB,
    });

    const appAContract = await seedApplicationWithContractPdf(ctx.prisma, {
      customer: await customer('lifecycle-a-contract'),
      company: companyA,
      product: productAContract,
      offer: offerA,
    });
    const appBContract = await seedApplicationWithContractPdf(ctx.prisma, {
      customer: await customer('lifecycle-b-contract'),
      company: companyB,
      product: productBContract,
      offer: offerB,
    });

    const creditEmail = await signUpFresh(createAgent(ctx), 'lifecycle-credit');
    const creditUser = await ctx.prisma.user.findUniqueOrThrow({ where: { email: creditEmail } });
    await setUserRole(ctx.prisma, creditUser.id, 'credit_officer', { creditScope: 'assigned' });
    await assignCreditOfficer(ctx.prisma, creditUser.id, companyA.id);

    const creditAgent = createAgent(ctx);
    await signIn(creditAgent, creditEmail);

    const approveB = await authed(creditAgent).post(
      `/api/v1/ops/applications/${appBReview.id}/approve-contract`,
    );
    expect(approveB.status).toBe(403);

    const activateB = await authed(creditAgent).post(
      `/api/v1/ops/applications/${appBActivate.id}/activate`,
    );
    expect(activateB.status).toBe(403);

    const transitionB = await authed(creditAgent)
      .post(`/api/v1/ops/applications/${appBTransition.id}/transition`)
      .send({ toStatus: 'rejected', reason: 'Out of scope regression check' });
    expect(transitionB.status).toBe(403);

    const contractB = await authed(creditAgent).get(
      `/api/v1/applications/${appBContract.id}/contract/file`,
    );
    expect(contractB.status).toBe(404);

    const approveA = await authed(creditAgent).post(
      `/api/v1/ops/applications/${appAReview.id}/approve-contract`,
    );
    expect(approveA.status).toBe(200);
    expect(approveA.body.status).toBe('contract_signing_required');

    const activateA = await authed(creditAgent).post(
      `/api/v1/ops/applications/${appAActivate.id}/activate`,
    );
    expect(activateA.status).toBe(200);
    expect(activateA.body.status).toBe('active');

    const transitionA = await authed(creditAgent)
      .post(`/api/v1/ops/applications/${appATransition.id}/transition`)
      .send({ toStatus: 'rejected', reason: 'In-scope regression check' });
    expect(transitionA.status).toBe(200);
    expect(transitionA.body.status).toBe('rejected');

    const contractA = await authed(creditAgent).get(
      `/api/v1/applications/${appAContract.id}/contract/file`,
    );
    expect(contractA.status).toBe(200);
    expect(contractA.headers['content-type']).toMatch(/pdf/i);
  });

  it('P0-B: finance officer scoped to Company A cannot read or mutate Company B records', async () => {
    const companyA = await seedCompany(ctx.prisma, 'Company A');
    const companyB = await seedCompany(ctx.prisma, 'Company B');
    const offerA = await seedOffer(ctx.prisma, companyA.id);
    const offerB = await seedOffer(ctx.prisma, companyB.id);
    const productA = await seedProduct(ctx.prisma, { companyId: companyA.id, offerId: offerA.id });
    const productB = await seedProduct(ctx.prisma, { companyId: companyB.id, offerId: offerB.id });

    const customerAEmail = await signUpFresh(createAgent(ctx), 'cust-a');
    const customerBEmail = await signUpFresh(createAgent(ctx), 'cust-b');
    const customerA = await ctx.prisma.user.findUniqueOrThrow({ where: { email: customerAEmail } });
    const customerB = await ctx.prisma.user.findUniqueOrThrow({ where: { email: customerBEmail } });

    const { application: appA, schedule: scheduleA } = await seedActiveApplicationWithSchedule(
      ctx.prisma,
      { customer: customerA, company: companyA, product: productA, offer: offerA },
    );
    const { application: appB, schedule: scheduleB } = await seedActiveApplicationWithSchedule(
      ctx.prisma,
      { customer: customerB, company: companyB, product: productB, offer: offerB },
    );

    await seedRequiredDocuments(ctx.prisma, appB.id, customerB.id);
    const docB = await ctx.prisma.applicationDocument.findFirstOrThrow({
      where: { applicationId: appB.id },
    });

    const financeEmail = await signUpFresh(createAgent(ctx), 'finance-officer');
    const financeUser = await ctx.prisma.user.findUniqueOrThrow({ where: { email: financeEmail } });
    await setUserRole(ctx.prisma, financeUser.id, 'finance_officer', { financeScope: 'assigned' });
    await assignFinanceOfficer(ctx.prisma, financeUser.id, companyA.id);

    const financeAgent = createAgent(ctx);
    await signIn(financeAgent, financeEmail);

    const detailB = await authed(financeAgent).get(`/api/v1/applications/${appB.id}`);
    expect(detailB.status).toBe(404);

    const docFileB = await authed(financeAgent).get(
      `/api/v1/applications/${appB.id}/documents/${docB.id}/file`,
    );
    expect(docFileB.status).toBe(404);

    const payB = await authed(financeAgent)
      .post(`/api/v1/ops/payment-schedules/${scheduleB.id}/pay`)
      .send({ method: 'bank_transfer', reference: 'REF-B' });
    expect(payB.status).toBe(403);

    const transitionB = await authed(financeAgent)
      .post(`/api/v1/ops/applications/${appB.id}/transition`)
      .send({ toStatus: 'down_payment_submitted' });
    expect(transitionB.status).toBe(403);

    const detailA = await authed(financeAgent).get(`/api/v1/applications/${appA.id}`);
    expect(detailA.status).toBe(200);
    expect(detailA.body.id).toBe(appA.id);

    const payA = await authed(financeAgent)
      .post(`/api/v1/ops/payment-schedules/${scheduleA.id}/pay`)
      .send({ amount: Number(scheduleA.remainingAmount), method: 'bank_transfer', reference: 'REF-A' });
    expect(payA.status).toBe(200);
  });
});
