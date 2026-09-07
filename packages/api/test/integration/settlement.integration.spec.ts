import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { computeEarlySettlementQuote } from '@drivemarket/shared/domain-rules';
import { createIntegrationApp, destroyIntegrationApp, type IntegrationContext } from './support/app';
import { authed } from './support/auth';
import { resetDatabase } from './support/db';
import {
  assignCreditOfficer,
  assignFinanceOfficer,
  seedActiveApplicationWithFullSchedule,
  seedCompany,
  seedDraftApplication,
  seedOffer,
  seedPendingFinanceActivationApplication,
  seedProduct,
} from './support/fixtures';
import { customerUser, expectApiError, staffUser } from './support/flows';

type QuoteRow = {
  sequence: number;
  due_date: string;
  kind: 'settled' | 'overdue' | 'current' | 'future';
  principal_outstanding: number;
  rent_outstanding: number;
  accrued_rent: number;
  forgiven_rent: number;
};

type QuoteBody = {
  as_of: string;
  principal_outstanding: number;
  accrued_profit: number;
  overdue_amount: number;
  forgiven_rent: number;
  settlement_amount: number;
  remaining_scheduled: number;
  savings: number;
  rows: QuoteRow[];
};

type SettlementBody = {
  id: string;
  application_id: string;
  application_status: string;
  status: string;
  customer_email: string;
  customer_name: string | null;
  vehicle: string;
  company_name: string;
  settlement_amount: number;
  remaining_principal: number;
  discount_amount: number;
  forgiven_rent: number;
  accrued_profit: number;
  quote_as_of: string | null;
  savings: number;
  requested_at: string;
  decided_at: string | null;
  decision_reason: string | null;
};

const money = (n: number) => Math.round(n * 100) / 100;

describe('early settlement (integration)', () => {
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

  /** Recomputes the quote from the ledger with the shared maths, pinned to the API's own `as_of`. */
  async function expectedQuote(applicationId: string, asOf: string) {
    const app = await ctx.prisma.application.findUniqueOrThrow({
      where: { id: applicationId },
      include: { paymentSchedules: { orderBy: { sequence: 'asc' } } },
    });
    return computeEarlySettlementQuote({
      rows: app.paymentSchedules.map((s) => ({
        sequence: s.sequence,
        dueDate: s.dueDate,
        amount: Number(s.amount),
        paidAmount: Number(s.paidAmount),
        remainingAmount: Number(s.remainingAmount),
        status: s.status,
      })),
      pricingSnapshot: app.pricingSnapshot as Record<string, unknown>,
      asOf: new Date(asOf),
      activatedAt: app.activatedAt,
    });
  }

  function expectQuoteInvariants(quote: QuoteBody) {
    expect(quote.settlement_amount).toBe(money(quote.principal_outstanding + quote.accrued_profit));
    expect(quote.savings).toBe(money(Math.max(0, quote.remaining_scheduled - quote.settlement_amount)));
    // Every unpaid dirham is either principal, rent earned to date or rent forgiven.
    expect(quote.principal_outstanding + quote.accrued_profit + quote.forgiven_rent).toBeCloseTo(quote.remaining_scheduled, 0);
    expect(new Date(quote.as_of).getTime()).not.toBeNaN();
  }

  /** Credit activates a pending financing through the API, which builds the amortised schedule. */
  async function activatedFinancing(label: string) {
    const company = await seedCompany(ctx.prisma, 'Settle Motors');
    const offer = await seedOffer(ctx.prisma, company.id);
    const product = await seedProduct(ctx.prisma, { companyId: company.id, offerId: offer.id, make: 'Lexus', model: 'ES 300h' });
    const customer = await customerUser(ctx, `${label}-customer`, 'Maryam Al-Sulaiti');
    const pending = await seedPendingFinanceActivationApplication(ctx.prisma, { customer: customer.user, company, product, offer });
    const credit = await staffUser(ctx, `${label}-credit`, 'credit_officer', { creditScope: 'assigned' });
    await assignCreditOfficer(ctx.prisma, credit.user.id, company.id);
    const activated = await authed(credit.agent).post(`/api/v1/ops/applications/${pending.id}/activate`);
    expect(activated.status).toBe(200);
    expect(activated.body.status).toBe('active');
    const finance = await staffUser(ctx, `${label}-finance`, 'finance_officer', { financeScope: 'assigned' });
    await assignFinanceOfficer(ctx.prisma, finance.user.id, company.id);
    return { company, offer, product, customer, credit, finance, applicationId: pending.id as string };
  }

  it('quotes principal outstanding plus rent to date on a fresh schedule, with the future rent forgiven', async () => {
    const { customer, applicationId } = await activatedFinancing('fresh');
    const app = await ctx.prisma.application.findUniqueOrThrow({ where: { id: applicationId } });
    const pricing = app.pricingSnapshot as { list_price: number; down_payment: number; financed_total: number; tenor: number };

    const res = await authed(customer.agent).get(`/api/v1/applications/${applicationId}/settlement-quote`);
    expect(res.status).toBe(200);
    const quote = res.body as QuoteBody;
    expectQuoteInvariants(quote);

    // Nothing paid yet: the principal outstanding is the financed amount and the whole schedule is still due.
    expect(quote.principal_outstanding).toBeCloseTo(pricing.list_price - pricing.down_payment, 0);
    expect(quote.remaining_scheduled).toBeCloseTo(pricing.financed_total, 1);
    expect(quote.overdue_amount).toBe(0);
    // Seconds into the first rent period: (almost) all rent is forgiven.
    expect(quote.accrued_profit).toBeLessThan(5);
    expect(quote.forgiven_rent).toBeGreaterThan(1000);
    expect(quote.savings).toBeCloseTo(quote.forgiven_rent, 0);
    expect(quote.settlement_amount).toBeLessThan(quote.remaining_scheduled);

    expect(quote.rows).toHaveLength(pricing.tenor);
    expect(quote.rows.map((r) => r.sequence)).toEqual(Array.from({ length: pricing.tenor }, (_, i) => i + 1));
    expect(quote.rows[0]!.kind).toBe('current');
    expect(quote.rows.slice(1).every((r) => r.kind === 'future')).toBe(true);
    expect(quote.rows.every((r) => /^\d{4}-\d{2}-\d{2}$/.test(r.due_date))).toBe(true);
    expect(quote.rows.reduce((sum, r) => sum + r.principal_outstanding, 0)).toBeCloseTo(quote.principal_outstanding, 0);
    expect(quote.rows.reduce((sum, r) => sum + r.forgiven_rent, 0)).toBeCloseTo(quote.forgiven_rent, 0);
    // Declining balance: the first installment carries the most rent.
    expect(quote.rows[0]!.rent_outstanding).toBeGreaterThan(quote.rows[quote.rows.length - 1]!.rent_outstanding);

    // Same maths as the shared library over the same ledger.
    const expected = await expectedQuote(applicationId, quote.as_of);
    expect(quote.principal_outstanding).toBe(expected.principalOutstanding);
    expect(quote.accrued_profit).toBe(expected.accruedProfit);
    expect(quote.forgiven_rent).toBe(expected.forgivenRent);
    expect(quote.settlement_amount).toBe(expected.settlementAmount);
    expect(quote.remaining_scheduled).toBe(expected.remainingScheduled);
    expect(quote.savings).toBe(expected.savings);
  });

  it('tracks payments and arrears: settled rows drop out, overdue installments are owed in full', async () => {
    const { customer, finance, applicationId } = await activatedFinancing('ledger');
    const schedules = await ctx.prisma.paymentSchedule.findMany({ where: { applicationId }, orderBy: { sequence: 'asc' } });
    const [first, second] = schedules;

    const pay = await authed(finance.agent)
      .post(`/api/v1/ops/payment-schedules/${first!.id}/pay`)
      .send({ amount: Number(first!.amount), method: 'bank_transfer', reference: 'SETTLE-1' });
    expect(pay.status).toBe(200);
    expect(pay.body.schedule.status).toBe('paid');

    const afterPayment = (await authed(customer.agent).get(`/api/v1/applications/${applicationId}/settlement-quote`)).body as QuoteBody;
    expectQuoteInvariants(afterPayment);
    expect(afterPayment.rows[0]).toEqual(
      expect.objectContaining({ sequence: 1, kind: 'settled', principal_outstanding: 0, rent_outstanding: 0, accrued_rent: 0, forgiven_rent: 0 }),
    );
    expect(afterPayment.remaining_scheduled).toBeCloseTo(
      schedules.slice(1).reduce((sum, s) => sum + Number(s.amount), 0),
      1,
    );

    // Installment 2 slips past its due date.
    await ctx.prisma.paymentSchedule.update({
      where: { id: second!.id },
      data: { dueDate: new Date(Date.now() - 2 * 86_400_000), status: 'overdue' },
    });
    const withArrears = (await authed(customer.agent).get(`/api/v1/applications/${applicationId}/settlement-quote`)).body as QuoteBody;
    expectQuoteInvariants(withArrears);
    expect(withArrears.overdue_amount).toBe(Number(second!.amount));
    const overdueRow = withArrears.rows.find((r) => r.sequence === 2)!;
    expect(overdueRow.kind).toBe('overdue');
    expect(overdueRow.forgiven_rent).toBe(0);
    expect(overdueRow.accrued_rent).toBe(overdueRow.rent_outstanding);
    expect(withArrears.accrued_profit).toBeGreaterThanOrEqual(overdueRow.rent_outstanding);
    expect(withArrears.settlement_amount).toBeGreaterThan(afterPayment.settlement_amount);

    const expected = await expectedQuote(applicationId, withArrears.as_of);
    expect(withArrears.settlement_amount).toBe(expected.settlementAmount);
    expect(withArrears.overdue_amount).toBe(expected.overdueAmount);
  });

  it('scopes the quote: owner or in-scope ops only, active financings only', async () => {
    const { company, offer, customer, credit, finance, applicationId } = await activatedFinancing('scope');

    const opsQuote = await authed(finance.agent).get(`/api/v1/ops/applications/${applicationId}/settlement-quote`);
    expect(opsQuote.status).toBe(200);
    const creditQuote = await authed(credit.agent).get(`/api/v1/ops/applications/${applicationId}/settlement-quote`);
    expect(creditQuote.status).toBe(200);
    expect(creditQuote.body.principal_outstanding).toBe(opsQuote.body.principal_outstanding);

    const dealer = await staffUser(ctx, 'scope-dealer', 'dealer_agent', { companyId: company.id });
    expectApiError(await authed(dealer.agent).get(`/api/v1/ops/applications/${applicationId}/settlement-quote`), 403, 'forbidden_role');
    const unassigned = await staffUser(ctx, 'scope-unassigned', 'finance_officer', { financeScope: 'assigned' });
    expect((await authed(unassigned.agent).get(`/api/v1/ops/applications/${applicationId}/settlement-quote`)).status).toBe(404);

    const stranger = await customerUser(ctx, 'scope-stranger');
    expect((await authed(stranger.agent).get(`/api/v1/applications/${applicationId}/settlement-quote`)).status).toBe(404);
    expectApiError(await authed(customer.agent).get(`/api/v1/ops/applications/${applicationId}/settlement-quote`), 403, 'forbidden_role');
    expect((await ctx.agent.get(`/api/v1/applications/${applicationId}/settlement-quote`)).status).toBe(401);

    const product = await seedProduct(ctx.prisma, { companyId: company.id, offerId: offer.id });
    const draft = await seedDraftApplication(ctx.prisma, { customer: customer.user, company, product, offer });
    expectApiError(
      await authed(customer.agent).get(`/api/v1/applications/${draft.id}/settlement-quote`),
      400,
      'settlement_requires_active_financing',
    );
    expectApiError(
      await authed(customer.agent).post(`/api/v1/applications/${draft.id}/settlement-request`),
      400,
      'settlement_requires_active_financing',
    );
  });

  it('customer requests settlement at the quoted amount; finance approves; the request is one per financing', async () => {
    const { customer, finance, credit, applicationId } = await activatedFinancing('request');
    const quote = (await authed(customer.agent).get(`/api/v1/applications/${applicationId}/settlement-quote`)).body as QuoteBody;

    const requested = await authed(customer.agent).post(`/api/v1/applications/${applicationId}/settlement-request`);
    expect(requested.status).toBe(201);
    const settlement = requested.body as SettlementBody;
    expect(settlement).toEqual(
      expect.objectContaining({
        application_id: applicationId,
        application_status: 'active',
        status: 'pending',
        customer_email: customer.email,
        customer_name: 'Maryam Al-Sulaiti',
        vehicle: 'Lexus ES 300h 2024',
        company_name: 'Settle Motors',
        remaining_principal: quote.principal_outstanding,
        forgiven_rent: quote.forgiven_rent,
        discount_amount: 0,
        savings: quote.forgiven_rent,
        decided_at: null,
        decision_reason: null,
      }),
    );
    // Rent keeps accruing between the two calls; the stored amount is the quote at request time.
    expect(settlement.settlement_amount).toBeGreaterThanOrEqual(quote.settlement_amount);
    expect(settlement.settlement_amount).toBeLessThan(quote.settlement_amount + 5);
    expect(settlement.accrued_profit).toBeGreaterThanOrEqual(quote.accrued_profit);
    expect(settlement.settlement_amount).toBe(money(settlement.remaining_principal + settlement.accrued_profit));
    expect(settlement.quote_as_of).toBeTruthy();
    expect(new Date(settlement.quote_as_of!).getTime()).toBeGreaterThanOrEqual(new Date(quote.as_of).getTime());

    const row = await ctx.prisma.applicationSettlement.findUniqueOrThrow({ where: { id: settlement.id } });
    expect(Number(row.settlementAmount)).toBe(settlement.settlement_amount);
    expect(Number(row.remainingPrincipal)).toBe(quote.principal_outstanding);
    expect(Number(row.accruedProfit)).toBe(settlement.accrued_profit);
    expect(Number(row.forgivenRent)).toBe(quote.forgiven_rent);
    expect(row.quoteAsOf).not.toBeNull();
    const requestLog = await ctx.prisma.activityLog.findFirst({
      where: { entityType: 'application', entityId: applicationId, action: 'settlement_requested' },
    });
    expect(requestLog?.actorUserId).toBe(customer.user.id);

    expectApiError(
      await authed(customer.agent).post(`/api/v1/applications/${applicationId}/settlement-request`),
      400,
      'settlement_already_requested',
    );

    // Finance sees it in the queue and decides; credit is refused.
    expectApiError(await authed(credit.agent).get('/api/v1/ops/settlements'), 403, 'forbidden_role');
    const queue = await authed(finance.agent).get('/api/v1/ops/settlements?status=pending');
    expect(queue.status).toBe(200);
    expect(queue.body.summary).toEqual({ pending: 1 });
    expect(queue.body.items).toHaveLength(1);
    expect(queue.body.items[0]).toEqual(
      expect.objectContaining({ id: settlement.id, accrued_profit: settlement.accrued_profit, savings: settlement.savings }),
    );

    expectApiError(await authed(finance.agent).post(`/api/v1/ops/settlements/${settlement.id}/reject`).send({}), 400, 'validation_failed');

    const approved = await authed(finance.agent)
      .post(`/api/v1/ops/settlements/${settlement.id}/approve`)
      .send({ reason: 'Customer paid the quoted amount at the branch' });
    expect(approved.status).toBe(200);
    expect(approved.body).toEqual(
      expect.objectContaining({ id: settlement.id, status: 'approved', decision_reason: 'Customer paid the quoted amount at the branch' }),
    );
    expect(approved.body.decided_at).toBeTruthy();
    const notice = await ctx.prisma.notification.findFirst({ where: { userId: customer.user.id, title: 'Settlement approved' } });
    expect(notice?.linkPath).toBe(`/app/applications/${applicationId}`);

    expectApiError(await authed(finance.agent).post(`/api/v1/ops/settlements/${settlement.id}/approve`).send({}), 400, 'settlement_not_pending');
    const afterDecision = await authed(finance.agent).get('/api/v1/ops/settlements');
    expect(afterDecision.body.summary.pending).toBe(0);
    expect(afterDecision.body.items[0].status).toBe('approved');

    // A decided request no longer blocks a fresh one.
    const again = await authed(customer.agent).post(`/api/v1/applications/${applicationId}/settlement-request`);
    expect(again.status).toBe(201);
  });

  it('mobile payments hub carries the live quote instead of a "pay the remainder" total', async () => {
    const { customer, applicationId } = await activatedFinancing('hub');
    const quote = (await authed(customer.agent).get(`/api/v1/applications/${applicationId}/settlement-quote`)).body as QuoteBody;

    for (const path of ['/api/v1/mobile/payments/hub', '/api/v1/customer/payments/hub']) {
      const hub = await authed(customer.agent).get(path);
      expect(hub.status).toBe(200);
      expect(hub.body.settlement_application_id).toBe(applicationId);
      expect(hub.body.settlement_quote).toEqual(
        expect.objectContaining({ principal_outstanding: quote.principal_outstanding, forgiven_rent: quote.forgiven_rent }),
      );
      expect(hub.body.settlement_quote.rows).toHaveLength(quote.rows.length);
      expect(hub.body.schedules).toHaveLength(quote.rows.length);
      for (const key of ['settle_all', 'settle_all_amount', 'total_remaining', 'remaining_total', 'pay_remaining']) {
        expect(hub.body).not.toHaveProperty(key);
      }
    }

    const noFinancing = await customerUser(ctx, 'hub-empty');
    const empty = await authed(noFinancing.agent).get('/api/v1/customer/payments/hub');
    expect(empty.status).toBe(200);
    expect(empty.body.settlement_quote).toBeNull();
    expect(empty.body.settlement_application_id).toBeNull();
  });

  it('a seeded schedule quotes the same numbers whether activation was a day or a month ago', async () => {
    const company = await seedCompany(ctx.prisma, 'Seeded Motors');
    const offer = await seedOffer(ctx.prisma, company.id);
    const product = await seedProduct(ctx.prisma, { companyId: company.id, offerId: offer.id, price: 60000 });
    const customer = await customerUser(ctx, 'seeded-customer');
    const activatedAt = new Date(Date.now() - 20 * 86_400_000);
    const { application, schedules } = await seedActiveApplicationWithFullSchedule(ctx.prisma, {
      customer: customer.user,
      company,
      product,
      offer,
      activatedAt,
      pricing: { tenureMonths: 24 },
    });
    expect(schedules).toHaveLength(24);

    const res = await authed(customer.agent).get(`/api/v1/applications/${application.id}/settlement-quote`);
    expect(res.status).toBe(200);
    const quote = res.body as QuoteBody;
    expectQuoteInvariants(quote);
    // Twenty days into the first month-long period: roughly two thirds of the first rent has accrued.
    const firstRent = quote.rows[0]!.rent_outstanding;
    expect(quote.accrued_profit).toBeGreaterThan(firstRent * 0.55);
    expect(quote.accrued_profit).toBeLessThan(firstRent * 0.75);
    expect(quote.rows[0]!.accrued_rent).toBe(quote.accrued_profit);
    expect(quote.principal_outstanding).toBeCloseTo(60000 * 0.8, 0);

    const expected = await expectedQuote(application.id, quote.as_of);
    expect(quote.settlement_amount).toBe(expected.settlementAmount);
    expect(quote.accrued_profit).toBe(expected.accruedProfit);
  });
});
