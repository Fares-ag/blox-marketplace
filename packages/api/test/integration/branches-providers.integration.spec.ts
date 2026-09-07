import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createIntegrationApp, destroyIntegrationApp, type IntegrationContext } from './support/app';
import { authed } from './support/auth';
import { resetDatabase } from './support/db';
import {
  seedApplicationRow,
  seedBranch,
  seedCompany,
  seedFinancePartner,
  seedOffer,
  seedProduct,
  seedStatusTransition,
} from './support/fixtures';
import { customerUser, expectApiError, staffUser } from './support/flows';

type BranchBody = {
  id: string;
  company_id: string;
  code: string;
  name: string;
  city: string | null;
  address: string | null;
  phone: string | null;
  active: boolean;
  staff_count: number;
  created_at: string;
};

type FinancePartnerBody = {
  id: string;
  code: string;
  name: string;
  active: boolean;
  engagement_mode: string;
  bre_ownership: string;
  is_default_lender: boolean;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  notes: string | null;
  branches: Array<{ id: string; partner_id: string; code: string; name: string; city: string | null; active: boolean }>;
  application_count: number;
};

type FunnelRow = {
  key: string;
  label: string;
  company_name?: string | null;
  branch_name?: string | null;
  drafts: number;
  submitted: number;
  approved: number;
  activated: number;
  rejected: number;
  approval_rate: number | null;
  median_approval_hours: number | null;
  under_24h_rate: number | null;
};

type FunnelBody = { group_by: string; from: string; to: string; rows: FunnelRow[]; totals: Omit<FunnelRow, 'key' | 'label'> };

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

describe('branches, finance providers and origination analytics (integration)', () => {
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

  describe('dealer branches', () => {
    it('admin creates, updates and lists branches; codes are unique per company', async () => {
      const company = await seedCompany(ctx.prisma, 'Branch Motors');
      const admin = await staffUser(ctx, 'branch-admin', 'admin');
      const base = `/api/v1/companies/${company.id}/branches`;

      const created = await authed(admin.agent)
        .post(base)
        .send({ code: ' DOH-01 ', name: 'Doha Showroom', city: 'Doha', address: 'Salwa Road', phone: '+97444001122' });
      expect(created.status).toBe(201);
      const branch = created.body as BranchBody;
      expect(branch).toEqual(
        expect.objectContaining({
          company_id: company.id,
          code: 'DOH-01',
          name: 'Doha Showroom',
          city: 'Doha',
          address: 'Salwa Road',
          phone: '+97444001122',
          active: true,
          staff_count: 0,
        }),
      );
      expect(new Date(branch.created_at).getTime()).not.toBeNaN();
      const log = await ctx.prisma.activityLog.findFirst({ where: { entityType: 'branch', entityId: branch.id, action: 'branch_created' } });
      expect(log?.toValue).toBe('DOH-01');

      expectApiError(await authed(admin.agent).post(base).send({ code: 'DOH-01', name: 'Duplicate' }), 409, 'branch_code_exists');
      expectApiError(await authed(admin.agent).post(base).send({ name: 'No code' }), 400, 'validation_failed');
      expectApiError(await authed(admin.agent).post(base).send({ code: 'X', name: '' }), 400, 'validation_failed');
      expectApiError(await authed(admin.agent).post(base).send({ code: 'X', name: 'Y', region: 'north' }), 400, 'validation_failed');

      // The same code is fine on another company.
      const other = await seedCompany(ctx.prisma, 'Other Motors');
      const reused = await authed(admin.agent).post(`/api/v1/companies/${other.id}/branches`).send({ code: 'DOH-01', name: 'Other Doha' });
      expect(reused.status).toBe(201);

      const wakra = await authed(admin.agent).post(base).send({ code: 'WAK-01', name: 'Al Wakra', city: 'Al Wakrah' });
      expect(wakra.status).toBe(201);

      const updated = await authed(admin.agent)
        .patch(`${base}/${wakra.body.id}`)
        .send({ name: 'Al Wakra Branch', city: null, phone: '+97444003344', active: false });
      expect(updated.status).toBe(200);
      expect(updated.body).toEqual(
        expect.objectContaining({ id: wakra.body.id, name: 'Al Wakra Branch', city: null, phone: '+97444003344', active: false, code: 'WAK-01' }),
      );
      const updateLog = await ctx.prisma.activityLog.findFirst({
        where: { entityType: 'branch', entityId: wakra.body.id, action: 'branch_updated' },
      });
      expect(updateLog).toEqual(expect.objectContaining({ fromValue: 'active', toValue: 'inactive' }));

      expectApiError(await authed(admin.agent).patch(`${base}/${wakra.body.id}`).send({ code: 'NEW' }), 400, 'validation_failed');
      expectApiError(await authed(admin.agent).patch(`${base}/not-a-branch`).send({ name: 'x' }), 404, 'branch_not_found');
      // A branch of another company is not reachable through this company.
      expectApiError(await authed(admin.agent).patch(`${base}/${reused.body.id}`).send({ name: 'x' }), 404, 'branch_not_found');
      expectApiError(await authed(admin.agent).get('/api/v1/companies/nope/branches'), 404, 'company_not_found');

      const list = await authed(admin.agent).get(base);
      expect(list.status).toBe(200);
      // Active first, then by name.
      expect((list.body as BranchBody[]).map((b) => [b.code, b.active])).toEqual([
        ['DOH-01', true],
        ['WAK-01', false],
      ]);
    });

    it('scopes reads and writes: dealers read their own company, group admins manage their tree', async () => {
      const holding = await seedCompany(ctx.prisma, 'Branch Holding');
      await ctx.prisma.company.update({ where: { id: holding.id }, data: { kind: 'holding' } });
      const dealership = await seedCompany(ctx.prisma, 'Branch Dealership');
      await ctx.prisma.company.update({ where: { id: dealership.id }, data: { parentCompanyId: holding.id } });
      const unrelated = await seedCompany(ctx.prisma, 'Unrelated Motors');
      const branch = await seedBranch(ctx.prisma, dealership.id, { code: 'D-01', name: 'Dealership HQ' });

      const dealer = await staffUser(ctx, 'branch-dealer', 'dealer_agent', { companyId: dealership.id, homeBranchId: branch.id });
      const own = await authed(dealer.agent).get(`/api/v1/companies/${dealership.id}/branches`);
      expect(own.status).toBe(200);
      expect(own.body).toHaveLength(1);
      expect(own.body[0]).toEqual(expect.objectContaining({ id: branch.id, staff_count: 1 }));
      expectApiError(await authed(dealer.agent).get(`/api/v1/companies/${unrelated.id}/branches`), 403, 'forbidden_role');
      expectApiError(
        await authed(dealer.agent).post(`/api/v1/companies/${dealership.id}/branches`).send({ code: 'D-02', name: 'x' }),
        403,
        'forbidden_role',
      );

      const groupAdmin = await staffUser(ctx, 'branch-group', 'group_admin', { companyId: holding.id });
      const inTree = await authed(groupAdmin.agent).post(`/api/v1/companies/${dealership.id}/branches`).send({ code: 'D-02', name: 'Second' });
      expect(inTree.status).toBe(201);
      expectApiError(
        await authed(groupAdmin.agent).post(`/api/v1/companies/${unrelated.id}/branches`).send({ code: 'U-01', name: 'x' }),
        403,
        'out_of_scope',
      );
      expectApiError(await authed(groupAdmin.agent).get(`/api/v1/companies/${unrelated.id}/branches`), 403, 'out_of_scope');

      const customer = await customerUser(ctx, 'branch-customer');
      expectApiError(await authed(customer.agent).get(`/api/v1/companies/${dealership.id}/branches`), 403, 'forbidden_role');
      expect((await ctx.agent.get(`/api/v1/companies/${dealership.id}/branches`)).status).toBe(401);
    });

    it('assigns home branches to staff and counts them; a branch must belong to the users company', async () => {
      const company = await seedCompany(ctx.prisma, 'Home Branch Motors');
      const other = await seedCompany(ctx.prisma, 'Elsewhere Motors');
      const branch = await seedBranch(ctx.prisma, company.id, { code: 'HB-01', name: 'Home Branch' });
      const foreign = await seedBranch(ctx.prisma, other.id, { code: 'EL-01', name: 'Elsewhere Branch' });
      const admin = await staffUser(ctx, 'home-admin', 'admin');

      const created = await authed(admin.agent)
        .post('/api/v1/users')
        .send({ email: `agent-${Date.now()}@integration.test`, name: 'Branch Agent', role: 'dealer_agent', companyId: company.id, home_branch_id: branch.id });
      expect(created.status).toBeLessThan(300);
      expect(created.body.home_branch).toEqual({ id: branch.id, code: 'HB-01', name: 'Home Branch' });

      const mismatch = await authed(admin.agent)
        .post('/api/v1/users')
        .send({ email: `agent2-${Date.now()}@integration.test`, name: 'Wrong Branch', role: 'dealer_agent', companyId: company.id, home_branch_id: foreign.id });
      expectApiError(mismatch, 400, 'branch_not_in_company');

      const list = await authed(admin.agent).get(`/api/v1/companies/${company.id}/branches`);
      expect(list.body[0]).toEqual(expect.objectContaining({ id: branch.id, staff_count: 1 }));

      const clearedBranch = await authed(admin.agent).patch(`/api/v1/users/${created.body.id}`).send({ home_branch_id: null });
      expect(clearedBranch.status).toBe(200);
      expect(clearedBranch.body.home_branch).toBeNull();
      const afterClear = await authed(admin.agent).get(`/api/v1/companies/${company.id}/branches`);
      expect(afterClear.body[0].staff_count).toBe(0);

      const agents = await authed(admin.agent).get(`/api/v1/companies/${company.id}/agents`);
      expect(agents.body.items[0]).toEqual(expect.objectContaining({ id: created.body.id, home_branch: null }));
    });
  });

  describe('finance provider master', () => {
    const create = (overrides: Record<string, unknown> = {}) => ({
      code: 'QIB',
      name: 'Qatar Islamic Bank',
      engagement_mode: 'full_los_underwriting',
      bre_ownership: 'blox_bre_only',
      contact_name: 'Ahmed Al-Sayed',
      contact_email: 'auto@qib.example',
      contact_phone: '+97444445555',
      notes: 'Primary lender',
      ...overrides,
    });

    it('creates providers, keeps exactly one default lender and refuses an inactive default', async () => {
      const admin = await staffUser(ctx, 'fp-admin', 'admin');

      const first = await authed(admin.agent).post('/api/v1/finance-partners').send(create({ is_default_lender: true }));
      expect(first.status).toBe(201);
      const qib = first.body as FinancePartnerBody;
      expect(qib).toEqual(
        expect.objectContaining({
          code: 'qib',
          name: 'Qatar Islamic Bank',
          active: true,
          engagement_mode: 'full_los_underwriting',
          bre_ownership: 'blox_bre_only',
          is_default_lender: true,
          contact_name: 'Ahmed Al-Sayed',
          contact_email: 'auto@qib.example',
          contact_phone: '+97444445555',
          notes: 'Primary lender',
          branches: [],
          application_count: 0,
        }),
      );
      const setLog = await ctx.prisma.activityLog.findFirst({
        where: { entityType: 'finance_partner', entityId: qib.id, action: 'default_lender_set' },
      });
      expect(setLog?.toValue).toBe('qib');

      expectApiError(await authed(admin.agent).post('/api/v1/finance-partners').send(create()), 409, 'finance_partner_code_exists');
      expectApiError(await authed(admin.agent).post('/api/v1/finance-partners').send(create({ code: 'bad code!' })), 400, 'validation_failed');
      expectApiError(await authed(admin.agent).post('/api/v1/finance-partners').send(create({ code: 'x', engagement_mode: 'other' })), 400, 'validation_failed');
      expectApiError(
        await authed(admin.agent).post('/api/v1/finance-partners').send(create({ code: 'dormant', active: false, is_default_lender: true })),
        400,
        'default_lender_must_be_active',
      );

      // A second default lender takes the flag away from the first.
      const second = await authed(admin.agent)
        .post('/api/v1/finance-partners')
        .send(create({ code: 'dukhan', name: 'Dukhan Bank', engagement_mode: 'credit_file_handoff', bre_ownership: 'blox_plus_partner_bre', is_default_lender: true }));
      expect(second.status).toBe(201);
      expect(second.body.is_default_lender).toBe(true);

      const list = await authed(admin.agent).get('/api/v1/finance-partners');
      expect(list.status).toBe(200);
      const partners = list.body as FinancePartnerBody[];
      expect(partners.filter((p) => p.is_default_lender).map((p) => p.code)).toEqual(['dukhan']);
      // Default lender first, then alphabetical.
      expect(partners.map((p) => p.code)).toEqual(['dukhan', 'qib']);

      // Switching back clears the other one inside the same transaction.
      const back = await authed(admin.agent).patch(`/api/v1/finance-partners/${qib.id}`).send({ is_default_lender: true });
      expect(back.status).toBe(200);
      expect(back.body.is_default_lender).toBe(true);
      const rows = await ctx.prisma.financePartner.findMany({ where: { isDefaultLender: true } });
      expect(rows.map((r) => r.code)).toEqual(['qib']);
      const switchLog = await ctx.prisma.activityLog.findFirst({
        where: { entityType: 'finance_partner', entityId: qib.id, action: 'default_lender_set', fromValue: null, toValue: 'qib', metadata: { not: undefined } },
        orderBy: { createdAt: 'desc' },
      });
      expect((switchLog?.metadata as { cleared_partner_ids: string[] } | null)?.cleared_partner_ids).toEqual([second.body.id]);

      // The default lender must stay active.
      expectApiError(await authed(admin.agent).patch(`/api/v1/finance-partners/${qib.id}`).send({ active: false }), 400, 'default_lender_must_be_active');

      const unset = await authed(admin.agent).patch(`/api/v1/finance-partners/${qib.id}`).send({ is_default_lender: false, notes: null });
      expect(unset.status).toBe(200);
      expect(unset.body).toEqual(expect.objectContaining({ is_default_lender: false, notes: null }));
      expect(await ctx.prisma.financePartner.count({ where: { isDefaultLender: true } })).toBe(0);
      const clearedLog = await ctx.prisma.activityLog.findFirst({
        where: { entityType: 'finance_partner', entityId: qib.id, action: 'default_lender_cleared' },
      });
      expect(clearedLog?.fromValue).toBe('qib');

      expectApiError(await authed(admin.agent).patch('/api/v1/finance-partners/nope').send({ name: 'x' }), 404, 'finance_partner_not_found');
      expectApiError(await authed(admin.agent).patch(`/api/v1/finance-partners/${qib.id}`).send({ code: 'dukhan' }), 409, 'finance_partner_code_exists');
    });

    it('manages provider branches and counts tagged applications; only admins write, every staff role reads', async () => {
      const admin = await staffUser(ctx, 'fpb-admin', 'admin');
      const created = await authed(admin.agent).post('/api/v1/finance-partners').send(create());
      const partnerId = created.body.id as string;

      const branch = await authed(admin.agent).post(`/api/v1/finance-partners/${partnerId}/branches`).send({ code: 'HQ', name: 'Head office', city: 'Doha' });
      expect(branch.status).toBe(201);
      expect(branch.body).toEqual({ id: expect.any(String), partner_id: partnerId, code: 'HQ', name: 'Head office', city: 'Doha', active: true });
      expectApiError(
        await authed(admin.agent).post(`/api/v1/finance-partners/${partnerId}/branches`).send({ code: 'HQ', name: 'Again' }),
        409,
        'finance_partner_branch_code_exists',
      );
      expectApiError(await authed(admin.agent).post('/api/v1/finance-partners/nope/branches').send({ code: 'X', name: 'x' }), 404, 'finance_partner_not_found');

      const updatedBranch = await authed(admin.agent)
        .patch(`/api/v1/finance-partners/${partnerId}/branches/${branch.body.id}`)
        .send({ name: 'Head Office (Doha)', active: false });
      expect(updatedBranch.status).toBe(200);
      expect(updatedBranch.body).toEqual(expect.objectContaining({ name: 'Head Office (Doha)', active: false, city: 'Doha' }));
      expectApiError(
        await authed(admin.agent).patch(`/api/v1/finance-partners/${partnerId}/branches/nope`).send({ name: 'x' }),
        404,
        'finance_partner_branch_not_found',
      );

      // Tagged applications are counted on the master.
      const company = await seedCompany(ctx.prisma, 'Counted Motors');
      const offer = await seedOffer(ctx.prisma, company.id);
      const product = await seedProduct(ctx.prisma, { companyId: company.id, offerId: offer.id });
      const customer = await customerUser(ctx, 'fpb-customer');
      await seedApplicationRow(ctx.prisma, {
        customer: customer.user,
        company,
        product,
        offer,
        status: 'under_review',
        submittedAt: new Date(),
        financePartnerId: partnerId,
      });

      const credit = await staffUser(ctx, 'fpb-credit', 'credit_officer', { creditScope: 'all' });
      const read = await authed(credit.agent).get('/api/v1/finance-partners');
      expect(read.status).toBe(200);
      expect(read.body[0]).toEqual(
        expect.objectContaining({
          id: partnerId,
          application_count: 1,
          branches: [expect.objectContaining({ id: branch.body.id, active: false })],
        }),
      );
      expectApiError(await authed(credit.agent).post('/api/v1/finance-partners').send(create({ code: 'nope' })), 403, 'forbidden_role');
      expectApiError(await authed(credit.agent).patch(`/api/v1/finance-partners/${partnerId}`).send({ name: 'x' }), 403, 'forbidden_role');
      expectApiError(await authed(customer.agent).get('/api/v1/finance-partners'), 403, 'forbidden_role');
    });
  });

  describe('origination funnel', () => {
    async function seedFunnel() {
      const now = new Date();
      const at = (daysBack: number, hoursForward = 0) => new Date(now.getTime() - daysBack * DAY + hoursForward * HOUR);

      const holding = await seedCompany(ctx.prisma, 'Funnel Holding');
      await ctx.prisma.company.update({ where: { id: holding.id }, data: { kind: 'holding' } });
      const companyA = await seedCompany(ctx.prisma, 'Funnel Motors A');
      await ctx.prisma.company.update({ where: { id: companyA.id }, data: { parentCompanyId: holding.id } });
      const companyB = await seedCompany(ctx.prisma, 'Funnel Motors B');
      const offer = await seedOffer(ctx.prisma);
      const productA = await seedProduct(ctx.prisma, { companyId: companyA.id, offerId: offer.id });
      const productB = await seedProduct(ctx.prisma, { companyId: companyB.id, offerId: offer.id });
      const branchA1 = await seedBranch(ctx.prisma, companyA.id, { code: 'A1', name: 'A One' });
      const branchA2 = await seedBranch(ctx.prisma, companyA.id, { code: 'A2', name: 'A Two' });
      const agentOne = await staffUser(ctx, 'funnel-agent-one', 'dealer_agent', { companyId: companyA.id, homeBranchId: branchA1.id }, 'Omar One');
      const agentTwo = await staffUser(ctx, 'funnel-agent-two', 'dealer_agent', { companyId: companyA.id, homeBranchId: branchA2.id }, 'Tariq Two');
      const customer = await customerUser(ctx, 'funnel-customer');
      const base = { customer: customer.user, offer };

      // A1 / Omar: submitted 3 days ago, approved 5h later (contract signing).
      const approved = await seedApplicationRow(ctx.prisma, {
        ...base,
        company: companyA,
        product: productA,
        status: 'contract_signing_required',
        submittedAt: at(3),
        agentUserId: agentOne.user.id,
        branchId: branchA1.id,
      });
      await seedStatusTransition(ctx.prisma, { applicationId: approved.id, from: 'draft', to: 'under_review', at: at(3) });
      await seedStatusTransition(ctx.prisma, { applicationId: approved.id, from: 'under_review', to: 'contract_signing_required', at: at(3, 5) });

      // A1 / Omar: submitted 2 days ago, rejected 30h later.
      const rejected = await seedApplicationRow(ctx.prisma, {
        ...base,
        company: companyA,
        product: productA,
        status: 'rejected',
        submittedAt: at(2),
        agentUserId: agentOne.user.id,
        branchId: branchA1.id,
      });
      await seedStatusTransition(ctx.prisma, { applicationId: rejected.id, from: 'under_review', to: 'rejected', at: at(2, 30) });

      // A2 via Tariq's home branch: a draft.
      await seedApplicationRow(ctx.prisma, {
        ...base,
        company: companyA,
        product: productA,
        status: 'draft',
        agentUserId: agentTwo.user.id,
      });

      // Unassigned in A: submitted 10 days ago, approved after 40h, activated yesterday.
      const activated = await seedApplicationRow(ctx.prisma, {
        ...base,
        company: companyA,
        product: productA,
        status: 'active',
        submittedAt: at(10),
        activatedAt: at(1),
      });
      await seedStatusTransition(ctx.prisma, { applicationId: activated.id, from: 'under_review', to: 'pending_finance_activation', at: at(10, 40) });
      await seedStatusTransition(ctx.prisma, { applicationId: activated.id, from: 'pending_finance_activation', to: 'active', at: at(1) });

      // Company B: one submission yesterday, still under review.
      await seedApplicationRow(ctx.prisma, { ...base, company: companyB, product: productB, status: 'under_review', submittedAt: at(1) });

      // Out of the default 30-day window: ignored everywhere.
      const stale = await seedApplicationRow(ctx.prisma, {
        ...base,
        company: companyB,
        product: productB,
        status: 'rejected',
        submittedAt: at(45),
        createdAt: at(46),
      });
      await ctx.prisma.$executeRaw`UPDATE applications SET "updatedAt" = ${at(44)} WHERE id = ${stale.id}`;

      return { holding, companyA, companyB, branchA1, branchA2, agentOne, agentTwo };
    }

    it('aggregates drafts → submitted → approved → activated with approval timing, grouped by company, branch and agent', async () => {
      const { companyA, companyB, branchA1, branchA2, agentOne, agentTwo } = await seedFunnel();
      const admin = await staffUser(ctx, 'funnel-admin', 'admin');

      const byCompany = await authed(admin.agent).get('/api/v1/ops/analytics/origination-funnel');
      expect(byCompany.status).toBe(200);
      const company = byCompany.body as FunnelBody;
      expect(company.group_by).toBe('company');
      expect(new Date(company.to).getTime() - new Date(company.from).getTime()).toBeCloseTo(30 * DAY, -4);
      expect(company.rows.map((r) => r.key)).toEqual([companyA.id, companyB.id]);
      expect(company.rows[0]).toEqual(
        expect.objectContaining({
          label: 'Funnel Motors A',
          company_name: 'Funnel Motors A',
          drafts: 1,
          submitted: 3,
          approved: 2,
          activated: 1,
          rejected: 1,
          approval_rate: 0.6667,
          median_approval_hours: 22.5,
          under_24h_rate: 0.5,
        }),
      );
      expect(company.rows[1]).toEqual(
        expect.objectContaining({ label: 'Funnel Motors B', drafts: 0, submitted: 1, approved: 0, activated: 0, rejected: 0, approval_rate: 0, median_approval_hours: null, under_24h_rate: null }),
      );
      expect(company.totals).toEqual(
        expect.objectContaining({ drafts: 1, submitted: 4, approved: 2, activated: 1, rejected: 1, approval_rate: 0.5, median_approval_hours: 22.5, under_24h_rate: 0.5 }),
      );

      const byBranch = await authed(admin.agent).get('/api/v1/ops/analytics/origination-funnel?group_by=branch');
      expect(byBranch.status).toBe(200);
      const branchRows = (byBranch.body as FunnelBody).rows;
      expect(branchRows.find((r) => r.key === branchA1.id)).toEqual(
        expect.objectContaining({ label: 'A One', branch_name: 'A One', company_name: 'Funnel Motors A', submitted: 2, approved: 1, rejected: 1, drafts: 0, median_approval_hours: 5, under_24h_rate: 1 }),
      );
      // Tariq's draft lands on his home branch even though the application row has no branch.
      expect(branchRows.find((r) => r.key === branchA2.id)).toEqual(expect.objectContaining({ label: 'A Two', drafts: 1, submitted: 0 }));
      expect(branchRows.find((r) => r.key === `unassigned:${companyA.id}`)).toEqual(
        expect.objectContaining({ label: 'Unassigned', company_name: 'Funnel Motors A', submitted: 1, approved: 1, activated: 1, median_approval_hours: 40, under_24h_rate: 0 }),
      );
      expect(branchRows.find((r) => r.key === `unassigned:${companyB.id}`)).toEqual(expect.objectContaining({ submitted: 1 }));

      const byAgent = await authed(admin.agent).get('/api/v1/ops/analytics/origination-funnel?group_by=agent');
      const agentRows = (byAgent.body as FunnelBody).rows;
      expect(agentRows.find((r) => r.key === agentOne.user.id)).toEqual(
        expect.objectContaining({ label: 'Omar One', branch_name: 'A One', submitted: 2, approved: 1, rejected: 1, approval_rate: 0.5 }),
      );
      expect(agentRows.find((r) => r.key === agentTwo.user.id)).toEqual(expect.objectContaining({ label: 'Tariq Two', branch_name: 'A Two', drafts: 1 }));
      // Sorted by submissions, then drafts.
      expect(agentRows[0]!.key).toBe(agentOne.user.id);

      // Explicit window and company filter.
      const filtered = await authed(admin.agent).get(
        `/api/v1/ops/analytics/origination-funnel?company_id=${companyB.id}&from=${new Date(Date.now() - 5 * DAY).toISOString().slice(0, 10)}&to=${new Date().toISOString().slice(0, 10)}`,
      );
      expect(filtered.status).toBe(200);
      expect((filtered.body as FunnelBody).rows.map((r) => r.key)).toEqual([companyB.id]);
      expect((filtered.body as FunnelBody).totals.submitted).toBe(1);

      expectApiError(await authed(admin.agent).get('/api/v1/ops/analytics/origination-funnel?from=2026-09-10&to=2026-09-01'), 400, 'invalid_date_range');
      expectApiError(await authed(admin.agent).get('/api/v1/ops/analytics/origination-funnel?group_by=city'), 400, 'validation_failed');
    });

    it('pins dealers to their company, group admins to their tree, and refuses customers', async () => {
      const { holding, companyA, companyB, agentOne } = await seedFunnel();

      const dealerView = await authed(agentOne.agent).get(`/api/v1/ops/analytics/origination-funnel?company_id=${companyB.id}`);
      expect(dealerView.status).toBe(200);
      expect((dealerView.body as FunnelBody).rows.map((r) => r.key)).toEqual([companyA.id]);
      expect((dealerView.body as FunnelBody).totals.submitted).toBe(3);

      const groupAdmin = await staffUser(ctx, 'funnel-group', 'group_admin', { companyId: holding.id });
      const tree = await authed(groupAdmin.agent).get('/api/v1/ops/analytics/origination-funnel?group_by=branch');
      expect(tree.status).toBe(200);
      expect((tree.body as FunnelBody).rows.every((r) => r.company_name === 'Funnel Motors A')).toBe(true);
      expectApiError(
        await authed(groupAdmin.agent).get(`/api/v1/ops/analytics/origination-funnel?company_id=${companyB.id}`),
        403,
        'out_of_scope',
      );

      const credit = await staffUser(ctx, 'funnel-credit', 'credit_officer', { creditScope: 'all' });
      expectApiError(await authed(credit.agent).get('/api/v1/ops/analytics/origination-funnel'), 403, 'forbidden_role');
      const customer = await customerUser(ctx, 'funnel-customer-two');
      expectApiError(await authed(customer.agent).get('/api/v1/ops/analytics/origination-funnel'), 403, 'forbidden_role');
    });
  });
});
