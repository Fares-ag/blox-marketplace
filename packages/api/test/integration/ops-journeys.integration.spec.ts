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
  seedActiveApplicationWithSchedule,
  seedCompany,
  seedConsentRecords,
  seedOffer,
  seedPassingComplianceCheck,
  seedPendingFinanceActivationApplication,
  seedProduct,
  seedRequiredDocuments,
  setUserRole,
} from './support/fixtures';

describe('ops role journeys', () => {
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

  async function staffUser(
    label: string,
    role: 'dealer_agent' | 'credit_officer' | 'finance_officer' | 'admin' | 'super_admin' | 'group_admin',
    extra: Parameters<typeof setUserRole>[3] = {},
  ) {
    const agent = createAgent(ctx);
    const email = await signUpFresh(agent, label);
    const user = await ctx.prisma.user.findUniqueOrThrow({ where: { email } });
    await setUserRole(ctx.prisma, user.id, role, extra);
    await signIn(agent, email);
    return { agent, user, email };
  }

  it('dealer creates a walk-in application that lands in the credit queue', async () => {
    const company = await seedCompany(ctx.prisma, 'Showroom Co');
    const offer = await seedOffer(ctx.prisma, company.id);
    const product = await seedProduct(ctx.prisma, { companyId: company.id, offerId: offer.id });
    const dealer = await staffUser('journey-dealer', 'dealer_agent', { companyId: company.id });

    const walkInEmail = `walkin-${Date.now()}@integration.test`;
    const create = await authed(dealer.agent)
      .post('/api/v1/ops/applications')
      .send({
        productId: product.id,
        offerId: offer.id,
        customerSnapshot: {
          full_name: 'Walk In Buyer',
          phone: '+97451112222',
          qid: '28012345678',
          email: walkInEmail,
          employment: 'Dealer desk',
          income: 14000,
          applicantType: 'individual',
        },
        pricingSnapshot: buildPricingSnapshot(Number(product.price)),
        agentUserId: dealer.user.id,
        listPrice: Number(product.price),
        sellingPrice: Number(product.price),
      });
    expect(create.status).toBeLessThan(300);
    expect(create.body.status).toBe('under_review');

    const walkIn = await ctx.prisma.user.findUnique({ where: { email: walkInEmail } });
    expect(walkIn?.role).toBe('customer');

    const credit = await staffUser('journey-credit-queue', 'credit_officer', { creditScope: 'assigned' });
    await assignCreditOfficer(ctx.prisma, credit.user.id, company.id);
    const queue = await authed(credit.agent).get('/api/v1/ops/applications?statusIn=under_review');
    expect(queue.status).toBe(200);
    expect(queue.body.items.some((row: { id: string }) => row.id === create.body.id)).toBe(true);
  });

  it('admin draft submit then credit approve-contract, reject/resubmit/reopen, and finance cannot activate', async () => {
    const company = await seedCompany(ctx.prisma, 'Admin Journey Co');
    const offer = await seedOffer(ctx.prisma, company.id);
    const product = await seedProduct(ctx.prisma, { companyId: company.id, offerId: offer.id });
    const admin = await staffUser('journey-admin', 'admin');
    const customerEmail = `draft-cust-${Date.now()}@integration.test`;

    const draft = await authed(admin.agent)
      .post('/api/v1/ops/applications')
      .send({
        productId: product.id,
        offerId: offer.id,
        customerSnapshot: {
          full_name: 'Draft Customer',
          phone: '+97451113333',
          qid: '28012345679',
          email: customerEmail,
          applicantType: 'individual',
        },
        pricingSnapshot: buildPricingSnapshot(Number(product.price)),
        companyId: company.id,
      });
    expect(draft.status).toBeLessThan(300);
    expect(draft.body.status).toBe('draft');

    await seedRequiredDocuments(ctx.prisma, draft.body.id, admin.user.id);
    // Staff submit runs the same gates as the customer submit: consents first.
    const walkIn = await ctx.prisma.user.findUniqueOrThrow({ where: { email: customerEmail } });
    await seedConsentRecords(ctx.prisma, { userId: walkIn.id, applicationId: draft.body.id });
    const submitted = await authed(admin.agent).post(`/api/v1/ops/applications/${draft.body.id}/submit`);
    expect(submitted.status).toBe(200);
    expect(submitted.body.status).toBe('under_review');

    const credit = await staffUser('journey-credit-decide', 'credit_officer', { creditScope: 'assigned' });
    await assignCreditOfficer(ctx.prisma, credit.user.id, company.id);
    await seedPassingComplianceCheck(ctx.prisma, draft.body.id, credit.user.id);

    const approved = await authed(credit.agent).post(`/api/v1/ops/applications/${draft.body.id}/approve-contract`);
    expect(approved.status).toBe(200);
    expect(approved.body.status).toBe('contract_signing_required');

    const reject = await authed(credit.agent)
      .post(`/api/v1/ops/applications/${draft.body.id}/transition`)
      .send({ toStatus: 'rejected', reason: 'Need more income evidence' });
    expect(reject.status).toBe(200);
    expect(reject.body.status).toBe('rejected');

    const reopen = await authed(credit.agent)
      .post(`/api/v1/ops/applications/${draft.body.id}/transition`)
      .send({ toStatus: 'under_review' });
    expect(reopen.status).toBe(200);
    expect(reopen.body.status).toBe('under_review');

    const resubmit = await authed(credit.agent)
      .post(`/api/v1/ops/applications/${draft.body.id}/transition`)
      .send({ toStatus: 'resubmission_required', reason: 'Missing bank statement' });
    expect(resubmit.status).toBe(200);
    expect(resubmit.body.status).toBe('resubmission_required');

    const finance = await staffUser('journey-finance-deny', 'finance_officer', { financeScope: 'assigned' });
    await assignFinanceOfficer(ctx.prisma, finance.user.id, company.id);
    const otherEmail = await signUpFresh(createAgent(ctx), 'journey-activate-customer');
    const pending = await seedPendingFinanceActivationApplication(ctx.prisma, {
      customer: await ctx.prisma.user.findUniqueOrThrow({ where: { email: otherEmail } }),
      company,
      product: await seedProduct(ctx.prisma, { companyId: company.id, offerId: offer.id, price: 110000 }),
      offer,
    });
    const activateDenied = await authed(finance.agent).post(`/api/v1/ops/applications/${pending.id}/activate`);
    expect(activateDenied.status).toBe(403);
  });

  it('direct activate is gated by company.allowDirectActivate', async () => {
    const company = await seedCompany(ctx.prisma, 'No Direct Co');
    await ctx.prisma.company.update({
      where: { id: company.id },
      data: { allowDirectActivate: false },
    });
    const offer = await seedOffer(ctx.prisma, company.id);
    const product = await seedProduct(ctx.prisma, { companyId: company.id, offerId: offer.id });
    const customerEmail = await signUpFresh(createAgent(ctx), 'direct-customer');
    const customer = await ctx.prisma.user.findUniqueOrThrow({ where: { email: customerEmail } });
    const dealer = await staffUser('direct-dealer', 'dealer_agent', { companyId: company.id });
    const created = await authed(dealer.agent)
      .post('/api/v1/ops/applications')
      .send({
        productId: product.id,
        offerId: offer.id,
        customerSnapshot: {
          full_name: customer.name,
          phone: '+97451114444',
          qid: '28012345680',
          email: customer.email,
          applicantType: 'individual',
        },
        pricingSnapshot: buildPricingSnapshot(Number(product.price)),
      });
    expect(created.body.status).toBe('under_review');

    const credit = await staffUser('direct-credit', 'credit_officer', { creditScope: 'assigned' });
    await assignCreditOfficer(ctx.prisma, credit.user.id, company.id);
    const denied = await authed(credit.agent)
      .post(`/api/v1/ops/applications/${created.body.id}/activate`)
      .send({ direct: true });
    expect(denied.status).toBe(400);
    expect(denied.body.error?.code ?? denied.body.message).toMatch(/direct_activate_disabled|invalid_status_transition|Bad Request/i);
  });

  it('finance confirms a pending bank transfer and super admin sees the activity', async () => {
    const company = await seedCompany(ctx.prisma, 'Bank Co');
    const offer = await seedOffer(ctx.prisma, company.id);
    const product = await seedProduct(ctx.prisma, { companyId: company.id, offerId: offer.id });
    const customerEmail = await signUpFresh(createAgent(ctx), 'bank-customer');
    const customer = await ctx.prisma.user.findUniqueOrThrow({ where: { email: customerEmail } });
    const { application, schedule } = await seedActiveApplicationWithSchedule(ctx.prisma, {
      customer,
      company,
      product,
      offer,
    });

    const finance = await staffUser('bank-finance', 'finance_officer', { financeScope: 'assigned' });
    await assignFinanceOfficer(ctx.prisma, finance.user.id, company.id);
    const pending = await authed(finance.agent)
      .post(`/api/v1/ops/payment-schedules/${schedule.id}/bank-pending`)
      .send({ amount: Number(schedule.remainingAmount), reference: 'TRX-1' });
    expect(pending.status).toBe(200);

    const list = await authed(finance.agent).get('/api/v1/ops/payments/pending-bank');
    expect(list.status).toBe(200);
    expect(list.body.items.some((row: { application_id: string }) => row.application_id === application.id)).toBe(true);

    const confirm = await authed(finance.agent).post(`/api/v1/ops/payments/${pending.body.id}/confirm-bank`);
    expect(confirm.status).toBe(200);

    const paid = await ctx.prisma.paymentSchedule.findUniqueOrThrow({ where: { id: schedule.id } });
    expect(paid.status === 'paid' || Number(paid.remainingAmount) === 0).toBe(true);

    const sa = await staffUser('bank-sa', 'super_admin');
    const logs = await authed(sa.agent).get('/api/v1/ops/activity-logs?entityType=payment_transaction');
    expect(logs.status).toBe(200);
    expect(logs.body.items.some((row: { action: string }) => row.action === 'bank_transfer_confirmed')).toBe(true);

    const stats = await authed(sa.agent).get('/api/v1/ops/activity-stats?range=7d');
    expect(stats.status).toBe(200);
    expect(stats.body.total_actions).toBeGreaterThan(0);
  });

  it('admin can create an offer and fetch a user + company agents', async () => {
    const company = await seedCompany(ctx.prisma, 'Catalog Co');
    const admin = await staffUser('catalog-admin', 'admin');
    const offer = await authed(admin.agent)
      .post('/api/v1/ops/offers')
      .send({
        name: 'Staff offer',
        annualRentRate: 11.5,
        profitRate: 2,
        tenureOptions: [24, 36],
        minDownPaymentPct: 15,
      });
    expect(offer.status).toBeLessThan(300);
    expect(offer.body.profit_rate).toBe(2);

    const one = await authed(admin.agent).get(`/api/v1/ops/offers/${offer.body.id}`);
    expect(one.status).toBe(200);
    expect(one.body.profit_rate).toBe(2);

    const createdUser = await authed(admin.agent)
      .post('/api/v1/users')
      .send({ email: `invite-${Date.now()}@integration.test`, name: 'Invited Agent', role: 'dealer_agent', companyId: company.id });
    expect(createdUser.status).toBeLessThan(300);

    const agents = await authed(admin.agent).get(`/api/v1/companies/${company.id}/agents`);
    expect(agents.status).toBe(200);
    expect(agents.body.items.length).toBeGreaterThan(0);
  });

  it('admin and group_admin can provision credit officers with company assignments', async () => {
    const holding = await seedCompany(ctx.prisma, 'Credit Scope Holding');
    await ctx.prisma.company.update({
      where: { id: holding.id },
      data: { kind: 'holding' },
    });
    const dealership = await seedCompany(ctx.prisma, 'Credit Scope Dealership');
    await ctx.prisma.company.update({
      where: { id: dealership.id },
      data: { kind: 'dealership', parentCompanyId: holding.id },
    });

    const admin = await staffUser('credit-provision-admin', 'admin');
    const adminCreate = await authed(admin.agent)
      .post('/api/v1/users')
      .send({
        email: `credit-admin-${Date.now()}@integration.test`,
        name: 'Credit From Admin',
        role: 'credit_officer',
        creditScope: 'assigned',
        creditCompanyIds: [holding.id, dealership.id],
      });
    expect(adminCreate.status).toBeLessThan(300);
    expect(adminCreate.body.role).toBe('credit_officer');
    expect(adminCreate.body.temporary_password).toBeTruthy();

    const groupAdmin = await staffUser('credit-provision-group', 'group_admin', { companyId: holding.id });
    const groupCreate = await authed(groupAdmin.agent)
      .post('/api/v1/users')
      .send({
        email: `credit-group-${Date.now()}@integration.test`,
        name: 'Credit From Group Admin',
        role: 'credit_officer',
        creditScope: 'assigned',
        creditCompanyIds: [dealership.id],
      });
    expect(groupCreate.status).toBeLessThan(300);
    expect(groupCreate.body.role).toBe('credit_officer');
  });

  it('admin submit-on-create, patch edit, staff doc upload, and finance/admin record payment', async () => {
    const company = await seedCompany(ctx.prisma, 'Workspace Smoke Co');
    const offer = await seedOffer(ctx.prisma, company.id);
    const product = await seedProduct(ctx.prisma, { companyId: company.id, offerId: offer.id });
    const admin = await staffUser('ws-smoke-admin', 'admin');

    const agentInvite = await authed(admin.agent)
      .post('/api/v1/users')
      .send({
        email: `ws-agent-${Date.now()}@integration.test`,
        name: 'Showroom Agent',
        role: 'dealer_agent',
        companyId: company.id,
      });
    expect(agentInvite.status).toBeLessThan(300);

    const walkInEmail = `ws-submit-${Date.now()}@integration.test`;
    const created = await authed(admin.agent)
      .post('/api/v1/ops/applications')
      .send({
        productId: product.id,
        offerId: offer.id,
        customerSnapshot: {
          full_name: 'Submit On Create',
          phone: '+97451115555',
          qid: '28012345681',
          email: walkInEmail,
          applicantType: 'individual',
        },
        pricingSnapshot: buildPricingSnapshot(Number(product.price)),
        companyId: company.id,
        agentUserId: agentInvite.body.id,
        submit: true,
      });
    expect(created.status).toBeLessThan(300);
    expect(created.body.status).toBe('under_review');

    const patched = await authed(admin.agent)
      .patch(`/api/v1/ops/applications/${created.body.id}`)
      .send({
        hideInterest: true,
        agentUserId: agentInvite.body.id,
        comment: 'Admin workspace note',
      });
    expect(patched.status).toBe(200);
    expect(patched.body.pricing_snapshot?.hide_interest).toBe(true);
    expect(
      patched.body.comments?.some((row: { body: string | null }) => row.body === 'Admin workspace note'),
    ).toBe(true);

    const upload = await authed(admin.agent)
      .post(`/api/v1/ops/applications/${created.body.id}/documents`)
      .field('category', 'other')
      .attach('file', Buffer.from('%PDF staff upload'), {
        filename: 'other.pdf',
        contentType: 'application/pdf',
      });
    expect(upload.status).toBeLessThan(300);
    expect(upload.body.category).toBe('other');

    const customerEmail = await signUpFresh(createAgent(ctx), 'ws-smoke-customer');
    const customer = await ctx.prisma.user.findUniqueOrThrow({ where: { email: customerEmail } });
    const { schedule } = await seedActiveApplicationWithSchedule(ctx.prisma, {
      customer,
      company,
      product: await seedProduct(ctx.prisma, {
        companyId: company.id,
        offerId: offer.id,
        price: Number(product.price) + 5000,
      }),
      offer,
    });

    const finance = await staffUser('ws-smoke-finance', 'finance_officer', { financeScope: 'assigned' });
    await assignFinanceOfficer(ctx.prisma, finance.user.id, company.id);
    const partial = Number(schedule.remainingAmount) / 2;
    const financePay = await authed(finance.agent)
      .post(`/api/v1/ops/payment-schedules/${schedule.id}/pay`)
      .send({ amount: partial, method: 'cheque', reference: 'CHQ-SMOKE' });
    expect(financePay.status).toBe(200);
    expect(Number(financePay.body.schedule.paid_amount)).toBeGreaterThan(0);
    expect(Number(financePay.body.schedule.remaining_amount)).toBeLessThan(Number(schedule.remainingAmount));

    const afterPartial = await ctx.prisma.paymentSchedule.findUniqueOrThrow({ where: { id: schedule.id } });
    const adminPay = await authed(admin.agent)
      .post(`/api/v1/ops/payment-schedules/${schedule.id}/pay`)
      .send({
        amount: Number(afterPartial.remainingAmount),
        method: 'bank_transfer',
        reference: 'ADM-SMOKE',
      });
    expect(adminPay.status).toBe(200);
    expect(adminPay.body.schedule.status).toBe('paid');
  });
});
