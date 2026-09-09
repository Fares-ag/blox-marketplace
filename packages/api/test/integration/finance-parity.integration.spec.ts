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
  buildPricingSnapshot,
  seedActiveApplicationWithSchedule,
  seedCompany,
  seedOffer,
  seedPassingComplianceCheck,
  seedPendingFinanceActivationApplication,
  seedProduct,
  seedUnderReviewApplication,
  setUserRole,
} from './support/fixtures';

/**
 * blox-vercel FINANCE_PORTAL.md smoke checklist, ported to the NestJS API:
 *  - credit or finance can Approve for Finance (under_review → pending_finance_activation)
 *  - credit activates; finance is refused
 *  - finance has credit-parity review decisions
 *  - mark-paid is shared by credit and finance
 *  - settlements and credits are finance/admin only
 */
describe('finance ↔ credit parity', () => {
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
    role: 'dealer_agent' | 'credit_officer' | 'finance_officer' | 'admin',
    extra: Parameters<typeof setUserRole>[3] = {},
  ) {
    const agent = createAgent(ctx);
    const email = await signUpFresh(agent, label);
    const user = await ctx.prisma.user.findUniqueOrThrow({ where: { email } });
    await setUserRole(ctx.prisma, user.id, role, extra);
    await signIn(agent, email);
    return { agent, user, email };
  }

  async function customerUser(label: string) {
    const agent = createAgent(ctx);
    const email = await signUpFresh(agent, label);
    const user = await ctx.prisma.user.findUniqueOrThrow({ where: { email } });
    await signIn(agent, email);
    return { agent, user, email };
  }

  /**
   * QAR 60,000 with the fixture's 20% down finances 48,000 — inside the LOS FSD
   * §1.5 senior-manager band (cars up to 50,000), which is the level a credit or
   * finance officer may sign off. Above 70,000 the matrix escalates to
   * super-admin only, and these specs are about role parity, not escalation.
   */
  async function world() {
    const company = await seedCompany(ctx.prisma, 'Parity Motors');
    const offer = await seedOffer(ctx.prisma, company.id);
    const product = await seedProduct(ctx.prisma, { companyId: company.id, offerId: offer.id, price: 60_000 });
    const customer = await customerUser('parity-customer');
    return { company, offer, product, customer };
  }

  it('finance approves for finance; finance cannot activate; credit activates', async () => {
    const { company, offer, product, customer } = await world();
    const finance = await staffUser('parity-finance', 'finance_officer', { financeScope: 'all' });
    const credit = await staffUser('parity-credit', 'credit_officer', { creditScope: 'all' });

    const app = await seedUnderReviewApplication(ctx.prisma, {
      customer: customer.user,
      company,
      product,
      offer,
    });
    await seedPassingComplianceCheck(ctx.prisma, app.id, credit.user.id);

    const approve = await authed(finance.agent)
      .post(`/api/v1/ops/applications/${app.id}/transition`)
      .send({ toStatus: 'pending_finance_activation' });
    expect(approve.status).toBe(200);
    expect(approve.body.status).toBe('pending_finance_activation');

    // Down payment is still a marketplace precondition for activation.
    const pricing = buildPricingSnapshot(Number(product.price));
    await ctx.prisma.paymentEvent.create({
      data: { applicationId: app.id, type: 'down_payment', amount: pricing.down_payment },
    });

    const financeActivate = await authed(finance.agent)
      .post(`/api/v1/ops/applications/${app.id}/activate`)
      .send({});
    expect(financeActivate.status).toBe(403);
    expect(financeActivate.body.error.code).toBe('forbidden_role');

    const creditActivate = await authed(credit.agent)
      .post(`/api/v1/ops/applications/${app.id}/activate`)
      .send({});
    expect(creditActivate.status).toBe(200);
    expect(creditActivate.body.status).toBe('active');

    const schedules = await ctx.prisma.paymentSchedule.count({ where: { applicationId: app.id } });
    expect(schedules).toBeGreaterThan(0);
    const listing = await ctx.prisma.product.findUniqueOrThrow({ where: { id: product.id } });
    expect(listing.listingStatus).toBe('sold');
  });

  it('finance has credit-parity review decisions (contract, resubmit, reject, reopen)', async () => {
    const { company, offer, product, customer } = await world();
    const finance = await staffUser('parity-finance-2', 'finance_officer', { financeScope: 'all' });

    const app = await seedUnderReviewApplication(ctx.prisma, {
      customer: customer.user,
      company,
      product,
      offer,
    });
    await seedPassingComplianceCheck(ctx.prisma, app.id, finance.user.id);

    const contract = await authed(finance.agent)
      .post(`/api/v1/ops/applications/${app.id}/approve-contract`)
      .send({});
    expect(contract.status).toBe(200);
    expect(contract.body.status).toBe('contract_signing_required');

    // Resubmission from contract_signing_required used to be a UI button with no API edge.
    const resub = await authed(finance.agent)
      .post(`/api/v1/ops/applications/${app.id}/transition`)
      .send({ toStatus: 'resubmission_required', reason: 'Bank statement unreadable' });
    expect(resub.status).toBe(200);
    expect(resub.body.status).toBe('resubmission_required');

    const reject = await authed(finance.agent)
      .post(`/api/v1/ops/applications/${app.id}/transition`)
      .send({ toStatus: 'rejected', reason: 'Income below threshold' });
    expect(reject.status).toBe(200);
    expect(reject.body.status).toBe('rejected');

    const reopen = await authed(finance.agent)
      .post(`/api/v1/ops/applications/${app.id}/transition`)
      .send({ toStatus: 'under_review' });
    expect(reopen.status).toBe(200);
    expect(reopen.body.status).toBe('under_review');
  });

  it('reject and reopen work from pending_finance_activation; dealer is refused', async () => {
    const { company, offer, product, customer } = await world();
    const credit = await staffUser('parity-credit-2', 'credit_officer', { creditScope: 'all' });
    const dealer = await staffUser('parity-dealer', 'dealer_agent', { companyId: company.id });

    const app = await seedPendingFinanceActivationApplication(ctx.prisma, {
      customer: customer.user,
      company,
      product,
      offer,
    });

    const dealerTry = await authed(dealer.agent)
      .post(`/api/v1/ops/applications/${app.id}/transition`)
      .send({ toStatus: 'rejected', reason: 'nope' });
    expect(dealerTry.status).toBe(403);

    const reject = await authed(credit.agent)
      .post(`/api/v1/ops/applications/${app.id}/transition`)
      .send({ toStatus: 'rejected', reason: 'Withdrawn by partner' });
    expect(reject.status).toBe(200);
    expect(reject.body.status).toBe('rejected');
  });

  it('mark-paid is shared by credit and finance; settlements and credits are finance/admin only', async () => {
    const { company, offer, product, customer } = await world();
    const finance = await staffUser('parity-finance-3', 'finance_officer', { financeScope: 'all' });
    const credit = await staffUser('parity-credit-3', 'credit_officer', { creditScope: 'all' });

    const seeded = await seedActiveApplicationWithSchedule(ctx.prisma, {
      customer: customer.user,
      company,
      product,
      offer,
    });
    // The fixture may return the application directly or wrap it with its schedule.
    const app = 'application' in seeded ? seeded.application : seeded;
    // The fixture seeds a single installment; add a second so credit and finance each pay one.
    const first = await ctx.prisma.paymentSchedule.findFirstOrThrow({
      where: { applicationId: app.id },
      orderBy: { sequence: 'asc' },
    });
    const second = await ctx.prisma.paymentSchedule.create({
      data: {
        applicationId: app.id,
        sequence: first.sequence + 100,
        dueDate: new Date('2030-01-01'),
        amount: first.amount,
        paidAmount: 0,
        remainingAmount: first.amount,
        status: 'pending',
      },
    });
    // A third installment stays unpaid so a settlement request has a remaining balance.
    await ctx.prisma.paymentSchedule.create({
      data: {
        applicationId: app.id,
        sequence: first.sequence + 200,
        dueDate: new Date('2030-02-01'),
        amount: first.amount,
        paidAmount: 0,
        remainingAmount: first.amount,
        status: 'pending',
      },
    });
    const schedules = [first, second];

    const creditPay = await authed(credit.agent)
      .post(`/api/v1/ops/payment-schedules/${schedules[0].id}/pay`)
      .send({ amount: Number(schedules[0].amount), method: 'bank_transfer', reference: 'CR-1' });
    expect(creditPay.status).toBe(200);

    const financePay = await authed(finance.agent)
      .post(`/api/v1/ops/payment-schedules/${schedules[1].id}/pay`)
      .send({ amount: Number(schedules[1].amount), method: 'bank_transfer', reference: 'FI-1' });
    expect(financePay.status).toBe(200);

    // Settlements: customer requests, finance decides, credit is refused.
    const request = await authed(customer.agent)
      .post(`/api/v1/applications/${app.id}/settlement-request`)
      .send({});
    expect(request.status).toBe(201);
    expect(request.body.status).toBe('pending');

    const creditList = await authed(credit.agent).get('/api/v1/ops/settlements');
    expect(creditList.status).toBe(403);

    const financeList = await authed(finance.agent).get('/api/v1/ops/settlements?status=pending');
    expect(financeList.status).toBe(200);
    expect(financeList.body.total).toBe(1);

    const approve = await authed(finance.agent)
      .post(`/api/v1/ops/settlements/${request.body.id}/approve`)
      .send({});
    expect(approve.status).toBe(200);
    expect(approve.body.status).toBe('approved');

    // Credits: finance adjusts, credit is refused.
    const creditAdjust = await authed(credit.agent)
      .post(`/api/v1/ops/users/${customer.user.id}/credits`)
      .send({ action: 'add', amount: 100 });
    expect(creditAdjust.status).toBe(403);

    const financeAdjust = await authed(finance.agent)
      .post(`/api/v1/ops/users/${customer.user.id}/credits`)
      .send({ action: 'add', amount: 100, description: 'parity test' });
    expect(financeAdjust.status).toBe(200);
    expect(financeAdjust.body.balance).toBe(100);

    const list = await authed(finance.agent).get('/api/v1/ops/credits');
    expect(list.status).toBe(200);
    expect(list.body.items.some((r: { user_id: string }) => r.user_id === customer.user.id)).toBe(true);

    const book = await authed(finance.agent).get('/api/v1/ops/finance/book');
    expect(book.status).toBe(200);
    expect(book.body.items[0].application_id).toBe(app.id);
  });

  it('admin can activate straight from under_review once the down payment is recorded', async () => {
    const { company, offer, product, customer } = await world();
    const admin = await staffUser('parity-admin', 'admin');

    const app = await seedUnderReviewApplication(ctx.prisma, {
      customer: customer.user,
      company,
      product,
      offer,
    });
    await seedPassingComplianceCheck(ctx.prisma, app.id, admin.user.id);
    const pricing = buildPricingSnapshot(Number(product.price));
    await ctx.prisma.paymentEvent.create({
      data: { applicationId: app.id, type: 'down_payment', amount: pricing.down_payment },
    });

    const activate = await authed(admin.agent)
      .post(`/api/v1/ops/applications/${app.id}/activate`)
      .send({});
    expect(activate.status).toBe(200);
    expect(activate.body.status).toBe('active');

    const cancel = await authed(admin.agent)
      .post(`/api/v1/ops/applications/${app.id}/transition`)
      .send({ toStatus: 'submission_cancelled', reason: 'Customer withdrew after activation' });
    expect(cancel.status).toBe(200);
    expect(cancel.body.status).toBe('submission_cancelled');
  });
});
