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
  seedActiveApplicationWithSchedule,
  seedCompany,
  seedFinancePartner,
  seedOffer,
  seedProduct,
  setUserRole,
} from './support/fixtures';

describe('Qatar Credit Bureau month-end dry-run', () => {
  let ctx: IntegrationContext;

  beforeAll(async () => {
    ctx = await createIntegrationApp({ BUREAU_INCLUDE_ALL_COMPANIES: 'true' });
  });

  afterAll(async () => {
    await destroyIntegrationApp(ctx);
  });

  beforeEach(async () => {
    await resetDatabase(ctx.prisma);
  });

  async function staff(label: string, role: 'finance_officer' | 'customer' | 'dealer_agent') {
    const agent = createAgent(ctx);
    const email = await signUpFresh(agent, label);
    const user = await ctx.prisma.user.findUniqueOrThrow({ where: { email } });
    if (role !== 'customer') {
      await setUserRole(ctx.prisma, user.id, role, role === 'finance_officer' ? { financeScope: 'all' } : {});
      await signIn(agent, email);
    }
    return { agent, user, email };
  }

  async function world() {
    const company = await seedCompany(ctx.prisma, 'Bureau Motors');
    const offer = await seedOffer(ctx.prisma, company.id);
    const product = await seedProduct(ctx.prisma, { companyId: company.id, offerId: offer.id, price: 80_000 });
    const customerEmail = await signUpFresh(createAgent(ctx), 'bureau-customer');
    const customer = await ctx.prisma.user.findUniqueOrThrow({ where: { email: customerEmail } });
    return { company, offer, product, customer };
  }

  it('forbids customers from running or listing Bureau files', async () => {
    const customer = await staff('bureau-guest', 'customer');
    const list = await authed(customer.agent).get('/api/v1/ops/bureau/runs');
    const run = await authed(customer.agent).post('/api/v1/ops/bureau/runs');
    expect(list.status).toBe(403);
    expect(run.status).toBe(403);
  });

  it('includes a verified active BLOX facility and keeps drafts out of the DLT', async () => {
    const { company, offer, product, customer } = await world();
    const finance = await staff('bureau-finance', 'finance_officer');

    const { application: live } = await seedActiveApplicationWithSchedule(ctx.prisma, {
      customer: customer,
      company,
      product,
      offer,
    });
    await ctx.prisma.application.update({
      where: { id: live.id },
      data: { kycStatus: 'verified' },
    });

    const draft = await ctx.prisma.application.create({
      data: {
        customerUserId: customer.id,
        customerEmail: customer.email,
        customerSnapshot: {
          full_name: customer.name,
          phone: '+97450000000',
          qid: '28012345678',
          applicantType: 'individual',
        },
        productId: product.id,
        companyId: company.id,
        offerId: offer.id,
        pricingSnapshot: { financed_amount: 1000, monthly: 100 },
        status: 'draft',
        activatedAt: new Date(),
        kycStatus: 'verified',
      },
    });

    const res = await authed(finance.agent).post('/api/v1/ops/bureau/runs');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('generated');
    expect(res.body.record_count).toBe(1);
    expect(res.body.excluded_count).toBe(1);
    expect(res.body.awaiting_approval).toBe(true);

    const send = await authed(finance.agent).post(`/api/v1/ops/bureau/runs/${res.body.id}/send`);
    expect(send.status).toBe(200);
    expect(send.body.status).toBe('sent');
    expect(send.body.send_acknowledgement).toMatch(/^local-dry-run:/);

    const listed = await authed(finance.agent).get('/api/v1/ops/bureau/runs');
    expect(listed.status).toBe(200);
    expect(listed.body.items[0].id).toBe(res.body.id);
    expect(listed.body.items[0].unsigned).toBe(true);
    expect(listed.body.items[0].map_version).toBe('hypothesis-v1');
    expect(JSON.stringify(listed.body)).not.toContain('28012345678');

    const detail = await authed(finance.agent).get(`/api/v1/ops/bureau/runs/${res.body.id}`);
    expect(detail.status).toBe(200);
    const included = detail.body.rows.filter((row: { included: boolean }) => row.included);
    const excluded = detail.body.rows.filter((row: { included: boolean }) => !row.included);
    expect(included).toHaveLength(1);
    expect(included[0].application_id).toBe(live.id);
    expect(excluded).toHaveLength(1);
    expect(excluded[0].application_id).toBe(draft.id);
    expect(excluded[0].exclude_reason).toBe('status_not_reportable');
    expect(JSON.stringify(detail.body)).not.toContain('28012345678');

    const file = await authed(finance.agent).get(`/api/v1/ops/bureau/runs/${send.body.id}/file`);
    expect(file.status).toBe(200);
    const body = String(file.text);
    expect(body).toMatch(/^HDR\|HYPOTHESIS-UNSIGNED\|map=hypothesis-v1\|/);
    expect(body).toContain('28012345678');
    expect(body).toMatch(/CNSS\|28012345678\|/);
    expect(body).toContain(`BLOX-${String(live.referenceSeq).padStart(4, '0')}`);
    expect(body).not.toContain(`BLOX-${String(draft.referenceSeq).padStart(4, '0')}`);
    expect(body).not.toMatch(/interest/i);
    expect(body).toMatch(/END\|records=1\|/);
    expect(file.headers['content-disposition']).toMatch(/unsigned\.dlt/i);
  });

  it('excludes partner CRM facilities and unverified identity', async () => {
    const { company, offer, product, customer } = await world();
    const finance = await staff('bureau-finance-2', 'finance_officer');
    const partner = await seedFinancePartner(ctx.prisma, { crmAdapter: 'zoho' });

    const { application: partnerApp } = await seedActiveApplicationWithSchedule(ctx.prisma, {
      customer,
      company,
      product,
      offer,
    });
    await ctx.prisma.application.update({
      where: { id: partnerApp.id },
      data: { kycStatus: 'verified', financePartnerId: partner.id },
    });

    const { application: unverified } = await seedActiveApplicationWithSchedule(ctx.prisma, {
      customer,
      company,
      product,
      offer,
    });
    await ctx.prisma.application.update({
      where: { id: unverified.id },
      data: { kycStatus: 'pending' },
    });

    const res = await authed(finance.agent).post('/api/v1/ops/bureau/runs');
    expect(res.status).toBe(200);
    expect(res.body.record_count).toBe(0);
    expect(res.body.excluded_count).toBe(2);

    const detail = await authed(finance.agent).get(`/api/v1/ops/bureau/runs/${res.body.id}`);
    const reasons = detail.body.rows.map((row: { exclude_reason: string }) => row.exclude_reason).sort();
    expect(reasons).toEqual(['kyc_unverified', 'partner_book']);
  });
});
