import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createIntegrationApp, destroyIntegrationApp, type IntegrationAgent, type IntegrationContext } from './support/app';
import { authed } from './support/auth';
import { resetDatabase } from './support/db';
import {
  assignCreditOfficer,
  seedApplicationRow,
  seedCompany,
  seedOffer,
  seedProduct,
  seedTakafulProvider,
} from './support/fixtures';
import { customerUser, daysFromNowIso, expectApiError, staffUser } from './support/flows';
import { JobsService } from '../../src/jobs/jobs.service';
import { TAKAFUL_DECLARATION_VERSION } from '../../src/takaful/takaful-dto';

type TakafulPolicyBody = {
  id: string;
  application_id: string;
  provider: string | null;
  policy_number: string | null;
  coverage_type: 'comprehensive' | 'third_party' | null;
  coverage_amount: number | null;
  premium_amount: number | null;
  issued_at: string | null;
  effective_from: string | null;
  expires_at: string | null;
  days_to_expiry: number | null;
  riders: string[];
  status: string;
  declaration_accepted_at: string | null;
  declaration_version: string | null;
  has_document: boolean;
  verified_at: string | null;
  created_at: string;
};

const POLICY_PDF = Buffer.from('%PDF-1.4 takaful policy schedule');

function declaration(overrides: Record<string, unknown> = {}) {
  return {
    provider: 'QIC Takaful',
    policy_number: 'QIC-2026-000123',
    coverage_type: 'comprehensive',
    coverage_amount: 100000,
    premium_amount: 3250,
    effective_from: daysFromNowIso(0),
    expires_at: daysFromNowIso(365),
    riders: ['roadside_assist', 'agency_repair'],
    declaration_accepted: true,
    ...overrides,
  };
}

function uploadPolicy(agent: IntegrationAgent, applicationId: string, policyId: string, content = POLICY_PDF) {
  return authed(agent)
    .post(`/api/v1/applications/${applicationId}/takaful/${policyId}/document`)
    .attach('file', content, { filename: 'policy.pdf', contentType: 'application/pdf' });
}

describe('takaful policies (integration)', () => {
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

  /** Customer at contract signing (takaful is declared from that stage on) plus a scoped credit officer. */
  async function signingStage(label = 'takaful') {
    const company = await seedCompany(ctx.prisma, 'Takaful Motors');
    const offer = await seedOffer(ctx.prisma, company.id);
    const product = await seedProduct(ctx.prisma, { companyId: company.id, offerId: offer.id });
    const customer = await customerUser(ctx, `${label}-customer`, 'Noor Al-Thani');
    const application = await seedApplicationRow(ctx.prisma, {
      customer: customer.user,
      company,
      product,
      offer,
      status: 'contract_signing_required',
      submittedAt: new Date(),
    });
    const credit = await staffUser(ctx, `${label}-credit`, 'credit_officer', { creditScope: 'assigned' });
    await assignCreditOfficer(ctx.prisma, credit.user.id, company.id);
    return { company, offer, product, customer, application, credit };
  }

  it('declares a policy only with the declaration accepted, and returns the policy DTO', async () => {
    const { customer, application } = await signingStage('declare');
    const base = `/api/v1/applications/${application.id}/takaful`;

    const refused = await authed(customer.agent).post(base).send(declaration({ declaration_accepted: false }));
    expectApiError(refused, 400, 'takaful_declaration_required');
    expect(await ctx.prisma.takafulPolicy.count({ where: { applicationId: application.id } })).toBe(0);

    const res = await authed(customer.agent).post(base).send(declaration());
    expect(res.status).toBe(201);
    const policy = res.body as TakafulPolicyBody;
    expect(policy).toEqual(
      expect.objectContaining({
        application_id: application.id,
        provider: 'QIC Takaful',
        policy_number: 'QIC-2026-000123',
        coverage_type: 'comprehensive',
        coverage_amount: 100000,
        premium_amount: 3250,
        issued_at: null,
        effective_from: daysFromNowIso(0),
        expires_at: daysFromNowIso(365),
        days_to_expiry: 365,
        riders: ['roadside_assist', 'agency_repair'],
        status: 'declared',
        declaration_version: TAKAFUL_DECLARATION_VERSION,
        has_document: false,
        verified_at: null,
      }),
    );
    expect(policy.declaration_accepted_at).toBeTruthy();
    expect(policy.id).toBeTruthy();

    const row = await ctx.prisma.takafulPolicy.findUniqueOrThrow({ where: { id: policy.id } });
    expect(row.createdByUserId).toBe(customer.user.id);
    expect(row.declarationVersion).toBe('takaful-2026-09-v1');

    const log = await ctx.prisma.activityLog.findFirst({
      where: { entityType: 'takaful_policy', entityId: policy.id, action: 'takaful_declared' },
    });
    expect(log?.toValue).toBe('declared');
    expect(log?.metadata).toEqual(
      expect.objectContaining({ application_id: application.id, provider: 'QIC Takaful', coverage_type: 'comprehensive' }),
    );

    const list = await authed(customer.agent).get(base);
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0].id).toBe(policy.id);

    const detail = await authed(customer.agent).get(`/api/v1/applications/${application.id}`);
    expect(detail.status).toBe(200);
    expect(detail.body.takaful_policies).toHaveLength(1);
    expect(detail.body.takaful_policies[0]).toEqual(
      expect.objectContaining({ id: policy.id, status: 'declared', has_document: false, days_to_expiry: 365 }),
    );
  });
  it('refuses a declaration that omits a mandatory field', async () => {
    const { customer, application } = await signingStage('declare-missing');
    const base = `/api/v1/applications/${application.id}/takaful`;

    const missingProvider = await authed(customer.agent).post(base).send(declaration({ provider: undefined }));
    expectApiError(missingProvider, 400, 'validation_failed');
    expect(await ctx.prisma.takafulPolicy.count({ where: { applicationId: application.id } })).toBe(0);
  });

  it('validates dates and body shape', async () => {
    const { customer, application } = await signingStage('validate');
    const base = `/api/v1/applications/${application.id}/takaful`;

    const reversed = await authed(customer.agent)
      .post(base)
      .send(declaration({ effective_from: '2026-06-01', expires_at: '2026-05-31' }));
    expectApiError(reversed, 400, 'expires_before_effective');

    const badDate = await authed(customer.agent).post(base).send(declaration({ expires_at: '01-06-2027' }));
    expectApiError(badDate, 400, 'validation_failed');

    const impossible = await authed(customer.agent).post(base).send(declaration({ expires_at: '2027-02-30' }));
    expectApiError(impossible, 400, 'expires_at_invalid');

    const badCoverage = await authed(customer.agent).post(base).send(declaration({ coverage_type: 'fire_only' }));
    expectApiError(badCoverage, 400, 'validation_failed');

    const negative = await authed(customer.agent).post(base).send(declaration({ premium_amount: -1 }));
    expectApiError(negative, 400, 'validation_failed');

    const unknown = await authed(customer.agent).post(base).send(declaration({ broker: 'x' }));
    expectApiError(unknown, 400, 'validation_failed');

    expect(await ctx.prisma.takafulPolicy.count()).toBe(0);
  });

  it('customer updates the declaration, uploads the policy document and staff verify it', async () => {
    const { company, customer, application, credit } = await signingStage('verify');
    const base = `/api/v1/applications/${application.id}/takaful`;
    const created = await authed(customer.agent).post(base).send(declaration());
    expect(created.status).toBe(201);
    const policyId = created.body.id as string;

    const patched = await authed(customer.agent)
      .patch(`${base}/${policyId}`)
      .send({ premium_amount: 3400, riders: ['roadside_assist'] });
    expect(patched.status).toBe(200);
    expect(patched.body).toEqual(
      expect.objectContaining({ premium_amount: 3400, riders: ['roadside_assist'], status: 'declared' }),
    );
    const updateLog = await ctx.prisma.activityLog.findFirst({
      where: { entityType: 'takaful_policy', entityId: policyId, action: 'takaful_updated' },
    });
    expect(updateLog?.metadata).toEqual({ application_id: application.id, fields: ['premium_amount', 'riders'] });

    const noop = await authed(customer.agent).patch(`${base}/${policyId}`).send({});
    expect(noop.status).toBe(200);
    expect(noop.body.premium_amount).toBe(3400);

    const wrongType = await authed(customer.agent)
      .post(`${base}/${policyId}/document`)
      .attach('file', Buffer.from('not a policy'), { filename: 'policy.txt', contentType: 'text/plain' });
    expectApiError(wrongType, 400, 'invalid_file_type');

    const uploaded = await uploadPolicy(customer.agent, application.id, policyId);
    expect(uploaded.status).toBe(200);
    expect(uploaded.body).toEqual(expect.objectContaining({ status: 'pending_verification', has_document: true }));
    const stored = await ctx.prisma.takafulPolicy.findUniqueOrThrow({ where: { id: policyId } });
    expect(stored.documentPath?.startsWith(`takaful/${application.id}/${policyId}/`)).toBe(true);
    expect(stored.documentMime).toBe('application/pdf');

    // The scoped credit officer is told a policy awaits verification.
    const awaiting = await ctx.prisma.notification.findFirst({
      where: { userId: credit.user.id, title: 'Takaful policy awaiting verification' },
    });
    expect(awaiting?.body).toContain('QIC-2026-000123');
    expect(awaiting?.linkPath).toBe(`/applications/${application.id}`);

    const download = await authed(customer.agent).get(`${base}/${policyId}/document`);
    expect(download.status).toBe(200);
    expect(download.headers['content-type']).toContain('application/pdf');
    expect(Buffer.from(download.body as Buffer).toString()).toBe(POLICY_PDF.toString());

    // Ops read: dealer of the company may read but not verify.
    const dealer = await staffUser(ctx, 'verify-dealer', 'dealer_agent', { companyId: company.id });
    const opsList = await authed(dealer.agent).get(`/api/v1/ops/applications/${application.id}/takaful`);
    expect(opsList.status).toBe(200);
    expect(opsList.body[0]).toEqual(expect.objectContaining({ id: policyId, status: 'pending_verification' }));
    const opsDownload = await authed(dealer.agent).get(`/api/v1/ops/applications/${application.id}/takaful/${policyId}/document`);
    expect(opsDownload.status).toBe(200);
    expectApiError(
      await authed(dealer.agent).post(`/api/v1/ops/applications/${application.id}/takaful/${policyId}/verify`),
      403,
      'forbidden_role',
    );

    const unassigned = await staffUser(ctx, 'verify-unassigned', 'credit_officer', { creditScope: 'assigned' });
    expect(
      (await authed(unassigned.agent).post(`/api/v1/ops/applications/${application.id}/takaful/${policyId}/verify`)).status,
    ).toBe(404);

    const verified = await authed(credit.agent).post(`/api/v1/ops/applications/${application.id}/takaful/${policyId}/verify`);
    expect(verified.status).toBe(200);
    expect(verified.body).toEqual(expect.objectContaining({ id: policyId, status: 'active', has_document: true }));
    expect(verified.body.verified_at).toBeTruthy();
    const verifiedRow = await ctx.prisma.takafulPolicy.findUniqueOrThrow({ where: { id: policyId } });
    expect(verifiedRow.verifiedById).toBe(credit.user.id);
    const customerNotice = await ctx.prisma.notification.findFirst({
      where: { userId: customer.user.id, title: 'Takaful policy verified' },
    });
    expect(customerNotice?.linkPath).toBe(`/app/applications/${application.id}`);

    // Verified cover is locked for the customer and cannot be verified twice.
    expectApiError(
      await authed(credit.agent).post(`/api/v1/ops/applications/${application.id}/takaful/${policyId}/verify`),
      409,
      'takaful_already_active',
    );
    expectApiError(
      await authed(customer.agent).patch(`${base}/${policyId}`).send({ premium_amount: 1 }),
      409,
      'takaful_policy_locked',
    );
    expectApiError(await uploadPolicy(customer.agent, application.id, policyId), 409, 'takaful_policy_locked');

    const detail = await authed(customer.agent).get(`/api/v1/applications/${application.id}`);
    expect(detail.body.takaful_policies[0]).toEqual(
      expect.objectContaining({ id: policyId, status: 'active', has_document: true, premium_amount: 3400 }),
    );
  });

  it('is owner-only and closed once the financing is complete', async () => {
    const { company, offer, product, customer, application } = await signingStage('scope');
    const stranger = await customerUser(ctx, 'scope-stranger');
    const base = `/api/v1/applications/${application.id}/takaful`;

    expectApiError(await authed(stranger.agent).get(base), 404, 'application_not_found');
    expectApiError(await authed(stranger.agent).post(base).send(declaration()), 404, 'application_not_found');
    expect((await ctx.agent.get(base)).status).toBe(401);

    const declared = await authed(customer.agent).post(base).send(declaration());
    expect(declared.status).toBe(201);
    expectApiError(
      await authed(stranger.agent).patch(`${base}/${declared.body.id}`).send({ premium_amount: 1 }),
      404,
      'application_not_found',
    );
    expectApiError(await authed(customer.agent).patch(`${base}/does-not-exist`).send({ premium_amount: 1 }), 404, 'takaful_policy_not_found');
    expectApiError(await authed(customer.agent).get(`${base}/${declared.body.id}/document`), 404, 'takaful_document_not_found');

    const completed = await seedApplicationRow(ctx.prisma, {
      customer: customer.user,
      company,
      product,
      offer,
      status: 'completed',
      submittedAt: new Date(),
      activatedAt: new Date(),
    });
    expectApiError(
      await authed(customer.agent).post(`/api/v1/applications/${completed.id}/takaful`).send(declaration()),
      409,
      'application_completed',
    );
  });

  it('expiry job lapses a policy and a renewal puts it back into verification', async () => {
    const { customer, application, credit } = await signingStage('expiry');
    const base = `/api/v1/applications/${application.id}/takaful`;
    const declared = await authed(customer.agent).post(base).send(declaration());
    const policyId = declared.body.id as string;
    await authed(credit.agent).post(`/api/v1/ops/applications/${application.id}/takaful/${policyId}/verify`);
    await ctx.prisma.takafulPolicy.update({
      where: { id: policyId },
      data: { expiresAt: new Date(`${daysFromNowIso(-2)}T00:00:00.000Z`) },
    });

    const jobs = ctx.app.get(JobsService);
    const run = await jobs.runTakafulExpiryReminders();
    expect(run.expired).toBe(1);
    expect(run.notified).toBe(1);

    const lapsed = await ctx.prisma.takafulPolicy.findUniqueOrThrow({ where: { id: policyId } });
    expect(lapsed.status).toBe('expired');
    expect(lapsed.lastReminderKind).toBe('expired');
    const notice = await ctx.prisma.notification.findFirst({
      where: { userId: customer.user.id, title: 'Takaful policy expired' },
    });
    expect(notice?.body).toContain('Toyota Camry 2024');

    const again = await jobs.runTakafulExpiryReminders();
    expect(again.notified).toBe(0);

    const list = await authed(customer.agent).get(base);
    expect(list.body[0]).toEqual(expect.objectContaining({ status: 'expired', days_to_expiry: -2 }));

    const renewed = await authed(customer.agent)
      .patch(`${base}/${policyId}`)
      .send({ policy_number: 'QIC-2027-000456', expires_at: daysFromNowIso(365) });
    expect(renewed.status).toBe(200);
    expect(renewed.body).toEqual(
      expect.objectContaining({ status: 'declared', policy_number: 'QIC-2027-000456', verified_at: null, days_to_expiry: 365 }),
    );
    const renewedRow = await ctx.prisma.takafulPolicy.findUniqueOrThrow({ where: { id: policyId } });
    expect(renewedRow.lastReminderKind).toBeNull();
    expect(renewedRow.verifiedById).toBeNull();
  });

  describe('provider quotes and admin master (wave 2)', () => {
    async function seedProviders() {
      const qic = await seedTakafulProvider(ctx.prisma, {
        code: 'qic',
        name: 'QIC Takaful',
        comprehensiveRatePct: 3.25,
        thirdPartyAnnual: 900,
        minContribution: 1500,
        riders: [{ code: 'roadside', label: 'Roadside assistance', labelAr: 'المساعدة على الطريق', annualAmount: 150 }],
        sortOrder: 1,
      });
      const doha = await seedTakafulProvider(ctx.prisma, {
        code: 'doha',
        name: 'Doha Takaful',
        comprehensiveRatePct: 3.0,
        thirdPartyAnnual: 850,
        minContribution: 1200,
        sortOrder: 2,
      });
      const inactive = await seedTakafulProvider(ctx.prisma, {
        code: 'old',
        name: 'Retired Takaful',
        comprehensiveRatePct: 2.5,
        active: false,
        sortOrder: 0,
      });
      return { qic, doha, inactive };
    }

    it('quotes comprehensive and third-party cover publicly from the active providers', async () => {
      await seedProviders();

      const comprehensive = await ctx.agent.get('/api/v1/takaful/providers?vehicle_price=100000&coverage=comprehensive');
      expect(comprehensive.status).toBe(200);
      type Quote = {
        provider: { code: string; name: string; comprehensive_rate_pct: number; riders: unknown[]; active: boolean };
        coverage_type: string;
        annual_contribution: number;
        monthly_equivalent: number;
      };
      const quotes = comprehensive.body as Quote[];
      const contributions = quotes.map((q) => q.annual_contribution);
      const byCode = (rows: Quote[], code: string) => rows.find((q) => q.provider.code === code)!;

      // Cheapest first — asserted as the ordering property so a rate change
      // reorders the list without breaking the lock. The retired provider is out.
      expect(quotes.map((q) => q.provider.code).sort()).toEqual(['doha', 'qic']);
      expect(contributions).toEqual([...contributions].sort((a, b) => a - b));

      const qic = byCode(quotes, 'qic');
      expect(qic.coverage_type).toBe('comprehensive');
      expect(qic.annual_contribution).toBe(3250);
      expect(qic.monthly_equivalent).toBeCloseTo(3250 / 12, 1);
      expect(qic.provider).toEqual(
        expect.objectContaining({ name: 'QIC Takaful', comprehensive_rate_pct: 3.25, active: true }),
      );
      expect(qic.provider.riders).toEqual([
        expect.objectContaining({ code: 'roadside', label: 'Roadside assistance', annual_amount: 150 }),
      ]);
      // Doha's 3.0% undercuts QIC's 3.25%, so it leads the comparison.
      expect(byCode(quotes, 'doha').annual_contribution).toBe(3000);
      expect(quotes[0]!.provider.code).toBe('doha');

      // The minimum contribution floors cheap vehicles.
      const cheap = await ctx.agent.get('/api/v1/takaful/providers?vehicle_price=20000&coverage=comprehensive');
      expect(cheap.status).toBe(200);
      const cheapQuotes = cheap.body as Quote[];
      expect(cheapQuotes.map((q) => q.annual_contribution)).toEqual(
        [...cheapQuotes.map((q) => q.annual_contribution)].sort((a, b) => a - b),
      );
      expect(byCode(cheapQuotes, 'qic').annual_contribution).toBe(1500);
      expect(byCode(cheapQuotes, 'doha').annual_contribution).toBe(1200);

      const thirdParty = await ctx.agent.get('/api/v1/takaful/providers?vehicle_price=100000&coverage=third_party');
      expect(thirdParty.status).toBe(200);
      const tp = (thirdParty.body as Array<{ provider: { code: string }; coverage_type: string; annual_contribution: number; monthly_equivalent: number }>)
        .find((q) => q.provider.code === 'qic');
      expect(tp).toEqual(expect.objectContaining({ coverage_type: 'third_party', annual_contribution: 900 }));
      expect(tp?.monthly_equivalent).toBeCloseTo(75, 1);
    });

    it('admins maintain the provider master; other roles are refused', async () => {
      const admin = await staffUser(ctx, 'takaful-admin', 'admin');
      const created = await authed(admin.agent)
        .post('/api/v1/ops/takaful-providers')
        .send({
          code: 'qiic',
          name: 'Qatar Islamic Insurance',
          name_ar: 'القطرية للتأمين الإسلامي',
          comprehensive_rate_pct: 3.4,
          third_party_annual: 950,
          min_contribution: 1600,
          riders: [{ code: 'gcc_cover', label: 'GCC cover', label_ar: 'تغطية دول الخليج', annual_amount: 200 }],
          contact_phone: '+97444000000',
          contact_email: 'motor@qiic.example',
          website: 'https://qiic.example',
          active: true,
          sort_order: 3,
        });
      expect(created.status).toBeLessThan(300);
      expect(created.body).toEqual(
        expect.objectContaining({
          code: 'qiic',
          name: 'Qatar Islamic Insurance',
          name_ar: 'القطرية للتأمين الإسلامي',
          comprehensive_rate_pct: 3.4,
          third_party_annual: 950,
          min_contribution: 1600,
          active: true,
          sort_order: 3,
        }),
      );
      expect(created.body.riders).toEqual([expect.objectContaining({ code: 'gcc_cover', annual_amount: 200 })]);
      const id = created.body.id as string;

      const patched = await authed(admin.agent)
        .patch(`/api/v1/ops/takaful-providers/${id}`)
        .send({ comprehensive_rate_pct: 3.1, active: false });
      expect(patched.status).toBe(200);
      expect(patched.body).toEqual(expect.objectContaining({ id, comprehensive_rate_pct: 3.1, active: false }));

      const list = await authed(admin.agent).get('/api/v1/ops/takaful-providers');
      expect(list.status).toBe(200);
      const rows = (Array.isArray(list.body) ? list.body : list.body.items) as Array<{ id: string; active: boolean }>;
      expect(rows.some((r) => r.id === id && r.active === false)).toBe(true);

      // Inactive providers never reach the public quote.
      const quotes = await ctx.agent.get('/api/v1/takaful/providers?vehicle_price=100000&coverage=comprehensive');
      expect(quotes.status).toBe(200);
      expect((quotes.body as Array<{ provider: { id: string } }>).some((q) => q.provider.id === id)).toBe(false);

      const credit = await staffUser(ctx, 'takaful-credit', 'credit_officer', { creditScope: 'all' });
      expectApiError(
        await authed(credit.agent).post('/api/v1/ops/takaful-providers').send({ code: 'x', name: 'X', comprehensive_rate_pct: 3 }),
        403,
        'forbidden_role',
      );
      expect((await authed(credit.agent).get('/api/v1/ops/takaful-providers')).status).toBe(403);
    });
  });
});
