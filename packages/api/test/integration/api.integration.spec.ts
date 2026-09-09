import { ApplicationStatus } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  createAgent,
  createIntegrationApp,
  destroyIntegrationApp,
  type IntegrationContext,
} from './support/app';
import { authed, signIn, signUpFresh } from './support/auth';
import { resetDatabase } from './support/db';
import { acceptConsents } from './support/flows';
import { transitionApplication } from '../../src/applications/guarded-transitions';
import {
  assignCreditOfficer,
  buildPricingSnapshot,
  seedCompany,
  seedDraftApplication,
  seedOffer,
  seedProduct,
  seedUnderReviewApplication,
  seedVerifiedEkycIdentity,
  setUserRole,
  seedActiveApplicationWithSchedule,
  assignFinanceOfficer,
} from './support/fixtures';

describe('API integration suite', () => {
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

  describe('auth / authz', () => {
    it('rejects unauthenticated access, wrong roles, and suspended sessions', async () => {
      const guest = createAgent(ctx);

      const unauth = await guest.get('/api/v1/me');
      expect(unauth.status).toBe(401);

      const customerEmail = await signUpFresh(guest, 'auth-customer');
      const customer = await ctx.prisma.user.findUniqueOrThrow({ where: { email: customerEmail } });

      const wrongRole = await authed(guest).get('/api/v1/ops/applications');
      expect(wrongRole.status).toBe(403);

      await ctx.prisma.user.update({
        where: { id: customer.id },
        data: { isActive: false },
      });

      const suspended = await authed(guest).get('/api/v1/me');
      expect(suspended.status).toBe(401);
    });
  });

  describe('customer application flow', () => {
    it('apply → upload KYC → submit, and blocks cross-customer access', async () => {
      const company = await seedCompany(ctx.prisma, 'Flow Co');
      const offer = await seedOffer(ctx.prisma, company.id);
      await ctx.prisma.offer.update({
        where: { id: offer.id },
        data: { profitRate: 3.5 },
      });
      const product = await seedProduct(ctx.prisma, { companyId: company.id, offerId: offer.id });

      const customerAAgent = createAgent(ctx);
      const customerBAgent = createAgent(ctx);

      const emailA = await signUpFresh(customerAAgent, 'flow-a');
      const emailB = await signUpFresh(customerBAgent, 'flow-b');
      const customerA = await ctx.prisma.user.findUniqueOrThrow({ where: { email: emailA } });

      const pricingSnapshot = buildPricingSnapshot(Number(product.price));
      const createRes = await authed(customerAAgent)
        .post('/api/v1/applications')
        .send({
          productId: product.id,
          offerId: offer.id,
          customerSnapshot: {
            full_name: 'Customer A',
            phone: '+97451111111',
            qid: '28012345678',
            employment: 'Acme',
            income: 12000,
          },
          pricingSnapshot,
        });
      expect(createRes.status).toBe(201);
      const appId = createRes.body.id as string;

      // The QID on the snapshot is an expatriate one, so the checklist asks for a
      // passport alongside the income documents.
      for (const category of ['qid', 'passport', 'salary', 'bank', 'other'] as const) {
        const upload = await authed(customerAAgent)
          .post(`/api/v1/applications/${appId}/documents`)
          .field('category', category)
          .attach('file', Buffer.from('%PDF test'), {
            filename: `${category}.pdf`,
            contentType: 'application/pdf',
          });
        expect(upload.status).toBe(201);
      }

      // BRD Qatar e-KYC BR-3: the customer's own QID photo is kept on file but
      // does not satisfy identity — the verified capture from the KYC platform does.
      await seedVerifiedEkycIdentity(ctx.prisma, appId);

      // Consents are the gate before documents.
      expect((await acceptConsents(customerAAgent, { applicationId: appId })).body.complete).toBe(true);

      const submit = await authed(customerAAgent).post(`/api/v1/applications/${appId}/submit`);
      expect(submit.status).toBe(200);
      expect(submit.body.status).toBe('under_review');

      const peekB = await authed(customerBAgent).get(`/api/v1/applications/${appId}`);
      expect(peekB.status).toBe(403);

      const mutateB = await authed(customerBAgent).post(`/api/v1/applications/${appId}/submit`);
      expect(mutateB.status).toBe(403);

      const uploadB = await authed(customerBAgent)
        .post(`/api/v1/applications/${appId}/documents`)
        .field('category', 'qid')
        .attach('file', Buffer.from('%PDF test'), {
          filename: 'qid.pdf',
          contentType: 'application/pdf',
        });
      expect(uploadB.status).toBe(403);

      const mineA = await authed(customerAAgent).get(`/api/v1/applications/${appId}`);
      expect(mineA.status).toBe(200);
      expect(mineA.body.customer_user_id ?? mineA.body.customer?.id ?? customerA.id).toBeTruthy();
      expect(mineA.body).not.toHaveProperty('profitRate');
      expect(mineA.body).not.toHaveProperty('contractData');
      expect(mineA.body).not.toHaveProperty('zohoLeadId');
      expect(mineA.body).not.toHaveProperty('zohoSyncError');
      expect(mineA.body.offer).toBeDefined();
      expect(mineA.body.offer).not.toHaveProperty('profitRate');
      expect(JSON.stringify(mineA.body)).not.toContain('profitRate');
    });
  });

  describe('credit transitions', () => {
    it('requires a reason for reject and accepts it when provided', async () => {
      const company = await seedCompany(ctx.prisma, 'Credit Co');
      const offer = await seedOffer(ctx.prisma, company.id);
      const product = await seedProduct(ctx.prisma, { companyId: company.id, offerId: offer.id });

      const customerEmail = await signUpFresh(createAgent(ctx), 'credit-customer');
      const customer = await ctx.prisma.user.findUniqueOrThrow({ where: { email: customerEmail } });
      const app = await seedUnderReviewApplication(ctx.prisma, {
        customer,
        company,
        product,
        offer,
      });

      const creditEmail = await signUpFresh(createAgent(ctx), 'credit-officer');
      const creditUser = await ctx.prisma.user.findUniqueOrThrow({ where: { email: creditEmail } });
      await setUserRole(ctx.prisma, creditUser.id, 'credit_officer', { creditScope: 'assigned' });
      await assignCreditOfficer(ctx.prisma, creditUser.id, company.id);

      const creditAgent = createAgent(ctx);
      await signIn(creditAgent, creditEmail);

      const missingReason = await authed(creditAgent)
        .post(`/api/v1/ops/applications/${app.id}/transition`)
        .send({ toStatus: 'rejected' });
      expect(missingReason.status).toBe(400);

      const withReason = await authed(creditAgent)
        .post(`/api/v1/ops/applications/${app.id}/transition`)
        .send({ toStatus: 'rejected', reason: 'Insufficient income documentation' });
      expect(withReason.status).toBe(200);
      expect(withReason.body.status).toBe('rejected');
    });

    it('returns conflict on stale duplicate transition', async () => {
      const company = await seedCompany(ctx.prisma, 'Stale Co');
      const offer = await seedOffer(ctx.prisma, company.id);
      const product = await seedProduct(ctx.prisma, { companyId: company.id, offerId: offer.id });

      const customerEmail = await signUpFresh(createAgent(ctx), 'stale-customer');
      const customer = await ctx.prisma.user.findUniqueOrThrow({ where: { email: customerEmail } });
      const app = await seedUnderReviewApplication(ctx.prisma, {
        customer,
        company,
        product,
        offer,
      });

      const outcomes = await Promise.allSettled([
        ctx.prisma.$transaction((tx) =>
          transitionApplication(tx, app.id, ApplicationStatus.under_review, {
            status: ApplicationStatus.rejected,
          }),
        ),
        ctx.prisma.$transaction((tx) =>
          transitionApplication(tx, app.id, ApplicationStatus.under_review, {
            status: ApplicationStatus.rejected,
          }),
        ),
      ]);

      const fulfilled = outcomes.filter((o) => o.status === 'fulfilled');
      const rejected = outcomes.filter((o) => o.status === 'rejected') as PromiseRejectedResult[];
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect(rejected[0]?.reason).toMatchObject({ message: 'stale_transition' });

      const updated = await ctx.prisma.application.findUniqueOrThrow({ where: { id: app.id } });
      expect(updated.status).toBe(ApplicationStatus.rejected);
    });
  });

  describe('payments', () => {
    it('recordPayment updates schedule ledger and writes PaymentEvent', async () => {
      const company = await seedCompany(ctx.prisma, 'Pay Co');
      const offer = await seedOffer(ctx.prisma, company.id);
      const product = await seedProduct(ctx.prisma, { companyId: company.id, offerId: offer.id });

      const customerEmail = await signUpFresh(createAgent(ctx), 'pay-customer');
      const customer = await ctx.prisma.user.findUniqueOrThrow({ where: { email: customerEmail } });
      const { application, schedule } = await seedActiveApplicationWithSchedule(ctx.prisma, {
        customer,
        company,
        product,
        offer,
      });

      const financeEmail = await signUpFresh(createAgent(ctx), 'pay-finance');
      const financeUser = await ctx.prisma.user.findUniqueOrThrow({ where: { email: financeEmail } });
      await setUserRole(ctx.prisma, financeUser.id, 'finance_officer', { financeScope: 'assigned' });
      await assignFinanceOfficer(ctx.prisma, financeUser.id, company.id);

      const financeAgent = createAgent(ctx);
      await signIn(financeAgent, financeEmail);

      const amount = Number(schedule.remainingAmount);
      const payRes = await authed(financeAgent)
        .post(`/api/v1/ops/payment-schedules/${schedule.id}/pay`)
        .send({ amount, method: 'bank_transfer', reference: 'BANK-001' });

      expect(payRes.status).toBe(200);
      expect(payRes.body.schedule.status).toBe('paid');
      expect(Number(payRes.body.schedule.remaining_amount)).toBe(0);

      const events = await ctx.prisma.paymentEvent.findMany({
        where: { applicationId: application.id, scheduleId: schedule.id },
      });
      expect(events).toHaveLength(1);
      expect(events[0]?.type).toBe('installment');
      expect(Number(events[0]?.amount)).toBe(amount);
    });
  });
});
