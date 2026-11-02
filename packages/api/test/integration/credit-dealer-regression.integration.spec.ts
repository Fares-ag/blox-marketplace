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
  buildPricingSnapshot,
  seedCompany,
  seedOffer,
  seedProduct,
  seedUnderReviewApplication,
  setUserRole,
} from './support/fixtures';
import { visibleWorkspaceActions } from '../../../shared/src/ops-applications/useApplicationActions';
import { ApplicationStatus, UserRole } from '@prisma/client';

/**
 * Regression coverage for dealer/credit workspace fixes:
 * optional resubmission reason, contract number validation, ops document visibility,
 * compliance action gating (shared actions map).
 */
describe('credit ↔ dealer regression (recent workspace fixes)', () => {
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
    role: 'credit_officer' | 'dealer_agent',
    extra: Parameters<typeof setUserRole>[3] = {},
  ) {
    const agent = createAgent(ctx);
    const email = await signUpFresh(agent, label);
    const user = await ctx.prisma.user.findUniqueOrThrow({ where: { email } });
    await setUserRole(ctx.prisma, user.id, role, extra);
    await signIn(agent, email);
    return { agent, user, email };
  }

  async function underReviewApp() {
    const company = await seedCompany(ctx.prisma, 'Regression Co');
    const offer = await seedOffer(ctx.prisma, company.id);
    const product = await seedProduct(ctx.prisma, { companyId: company.id, offerId: offer.id });
    const customerEmail = await signUpFresh(createAgent(ctx), 'regression-customer');
    const customer = await ctx.prisma.user.findUniqueOrThrow({ where: { email: customerEmail } });
    const app = await seedUnderReviewApplication(ctx.prisma, { customer, company, product, offer });
    return { company, app, customer };
  }

  it('credit can request resubmission with checklist items only (no reason text)', async () => {
    const { company, app } = await underReviewApp();
    const credit = await staffUser('regression-credit-resub', 'credit_officer', { creditScope: 'assigned' });
    await assignCreditOfficer(ctx.prisma, credit.user.id, company.id);

    const res = await authed(credit.agent)
      .post(`/api/v1/ops/applications/${app.id}/transition`)
      .send({ toStatus: 'resubmission_required', resubmission_items: ['bank', 'salary'] });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('resubmission_required');
    expect(res.body.resubmission_items).toEqual(expect.arrayContaining(['bank', 'salary']));
  });

  it('resubmission without items still fails validation', async () => {
    const { company, app } = await underReviewApp();
    const credit = await staffUser('regression-credit-no-items', 'credit_officer', { creditScope: 'assigned' });
    await assignCreditOfficer(ctx.prisma, credit.user.id, company.id);

    const res = await authed(credit.agent)
      .post(`/api/v1/ops/applications/${app.id}/transition`)
      .send({ toStatus: 'resubmission_required', reason: 'Please fix docs' });
    expect(res.status).toBe(400);
  });

  it('reject without reason still fails validation', async () => {
    const { company, app } = await underReviewApp();
    const credit = await staffUser('regression-credit-reject', 'credit_officer', { creditScope: 'assigned' });
    await assignCreditOfficer(ctx.prisma, credit.user.id, company.id);

    const res = await authed(credit.agent)
      .post(`/api/v1/ops/applications/${app.id}/transition`)
      .send({ toStatus: 'rejected' });
    expect(res.status).toBe(400);
  });

  it('credit PATCH rejects non-numeric contract numbers', async () => {
    const { company, app } = await underReviewApp();
    const credit = await staffUser('regression-credit-contract', 'credit_officer', { creditScope: 'assigned' });
    await assignCreditOfficer(ctx.prisma, credit.user.id, company.id);

    const bad = await authed(credit.agent)
      .patch(`/api/v1/ops/applications/${app.id}`)
      .send({ contractSeries: 'RSK', contractNumber: 'ABC-12' });
    expect(bad.status).toBe(400);

    const good = await authed(credit.agent)
      .patch(`/api/v1/ops/applications/${app.id}`)
      .send({ contractSeries: 'RSK', contractNumber: '44012' });
    expect(good.status).toBe(200);
    expect(good.body.contract_number).toBe('44012');
    expect(good.body.contract_series).toBe('RSK');
  });

  it('credit GET includes uploaded documents and matching document-slots after dealer submit path', async () => {
    const { company, app } = await underReviewApp();
    const credit = await staffUser('regression-credit-docs', 'credit_officer', { creditScope: 'assigned' });
    await assignCreditOfficer(ctx.prisma, credit.user.id, company.id);

    const detail = await authed(credit.agent).get(`/api/v1/applications/${app.id}`);
    expect(detail.status).toBe(200);
    expect(Array.isArray(detail.body.documents)).toBe(true);
    expect(detail.body.documents.length).toBeGreaterThan(0);

    const slots = await authed(credit.agent).get(`/api/v1/ops/applications/${app.id}/document-slots`);
    expect(slots.status).toBe(200);
    expect(slots.body.missing).toEqual([]);
    expect(slots.body.uploaded.length).toBeGreaterThan(0);
  });

  it('compliance check action is only offered during under_review', () => {
    for (const status of Object.values(ApplicationStatus)) {
      const credit = visibleWorkspaceActions(status, UserRole.credit_officer);
      const finance = visibleWorkspaceActions(status, UserRole.finance_officer);
      const expected = status === 'under_review';
      expect(credit.complianceCheck, `credit @ ${status}`).toBe(expected);
      expect(finance.complianceCheck, `finance @ ${status}`).toBe(expected);
    }
  });
});
