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
  QID,
  buildPricingSnapshot,
  customerSnapshotFixture,
  seedCompany,
  seedFinancePartner,
  seedProduct,
  setUserRole,
} from './support/fixtures';

describe('Al Jazeera Finance Zoho handoff', () => {
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

  async function staff(
    label: string,
    role: 'dealer_agent' | 'credit_officer',
    extra: Parameters<typeof setUserRole>[3] = {},
  ) {
    const agent = createAgent(ctx);
    const email = await signUpFresh(agent, label);
    const user = await ctx.prisma.user.findUniqueOrThrow({ where: { email } });
    await setUserRole(ctx.prisma, user.id, role, extra);
    await signIn(agent, email);
    return { agent, user, email };
  }

  it('routes a dealer Al Jazeera walk-in to partner_processing and records a CRM attempt', async () => {
    const company = await seedCompany(ctx.prisma, 'Al Jazeera QA Motors');
    const partner = await seedFinancePartner(ctx.prisma, {
      code: 'al-jazeera-finance',
      name: 'Al Jazeera Finance',
      crmAdapter: 'zoho',
    });
    const offer = await ctx.prisma.offer.create({
      data: {
        name: 'Al Jazeera Standard',
        annualRentRate: 12.5,
        tenureOptions: [12, 24, 36, 48],
        minDownPaymentPct: 0,
        status: 'active',
        companyId: company.id,
        financePartnerId: partner.id,
      },
    });
    const product = await seedProduct(ctx.prisma, {
      companyId: company.id,
      offerId: offer.id,
      price: 90_000,
    });

    const dealer = await staff('aj-dealer', 'dealer_agent', {
      companyId: company.id,
      dealerScope: 'assigned',
    });
    const credit = await staff('aj-credit', 'credit_officer', { creditScope: 'all' });

    const created = await authed(dealer.agent)
      .post('/api/v1/ops/applications')
      .send({
        productId: product.id,
        offerId: offer.id,
        submit: true,
        customerSnapshot: customerSnapshotFixture({
          full_name: 'Ali Al Thani',
          firstName: 'Ali',
          lastName: 'Al Thani',
          dateOfBirth: '1985-06-15',
          qid: QID.qatari,
          email: `aj-walkin-${Date.now()}@integration.test`,
          phone: '+97455519851',
          employment: {
            company: 'Qatar Energy',
            jobTitle: 'Engineer',
            employmentType: 'gov-or-semi-gov',
            employmentDuration: 'more-than-12-months',
            salary: 18000,
          },
          monthlyIncome: 18000,
        }),
        pricingSnapshot: buildPricingSnapshot(Number(product.price), { downPaymentPct: 0 }),
      });

    expect(created.status).toBeLessThan(300);
    expect(created.body.status).toBe('partner_processing');
    expect(created.body.financing_source).toBe('partner');
    expect(created.body.finance_partner_code).toBe('al-jazeera-finance');

    const detail = await authed(credit.agent).get(`/api/v1/applications/${created.body.id}`);
    expect(detail.status).toBe(200);
    expect(detail.body.financing_source).toBe('partner');
    expect(detail.body.finance_partner_code).toBe('al-jazeera-finance');
    expect(detail.body.zoho_lead_id == null || typeof detail.body.zoho_lead_id === 'string').toBe(true);
    expect(detail.body.zoho_sync_error).toBe('zoho_not_configured');

    const failures = await authed(credit.agent).get('/api/v1/ops/zoho/failures?limit=50');
    expect(failures.status).toBe(200);
    const row = (failures.body.items ?? []).find(
      (item: { application_id: string }) => item.application_id === created.body.id,
    );
    expect(row).toBeTruthy();
    expect(row.reason === 'sync_error' || row.reason === 'never_synced').toBe(true);
  });
});
