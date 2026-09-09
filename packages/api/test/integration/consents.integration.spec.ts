import { createHash } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  CONSENT_CATALOG,
  CONSENT_CATALOG_VERSION,
  CONSENT_CODES,
  consentFullText,
} from '@drivemarket/shared/domain-rules';
import { createIntegrationApp, destroyIntegrationApp, type IntegrationContext } from './support/app';
import { authed } from './support/auth';
import { resetDatabase } from './support/db';
import {
  assignCreditOfficer,
  seedCompany,
  seedConsentRecords,
  seedOffer,
  seedProduct,
  seedUnderReviewApplication,
} from './support/fixtures';
import {
  acceptConsents,
  consentAcceptances,
  createCustomerDraft,
  customerUser,
  expectApiError,
  staffUser,
} from './support/flows';

type ConsentRecordBody = {
  id: string;
  code: string;
  version: string;
  locale: string;
  channel: string;
  accepted_at: string;
  application_id: string | null;
  actor_name: string | null;
  outdated: boolean;
  withdrawn_at?: string | null;
};

type ConsentStatusBody = {
  catalog_version: string;
  required: string[];
  accepted: ConsentRecordBody[];
  missing: string[];
  complete: boolean;
  withdrawn?: ConsentRecordBody[];
};

const sha256 = (text: string) => createHash('sha256').update(text, 'utf8').digest('hex');

describe('consent centre (integration)', () => {
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

  async function showroom(name = 'Consent Motors') {
    const company = await seedCompany(ctx.prisma, name);
    const offer = await seedOffer(ctx.prisma, company.id);
    const product = await seedProduct(ctx.prisma, { companyId: company.id, offerId: offer.id });
    return { company, offer, product };
  }

  it('starts with nothing accepted and every mandatory consent missing', async () => {
    const customer = await customerUser(ctx, 'consent-fresh');

    const res = await authed(customer.agent).get('/api/v1/me/consents');
    expect(res.status).toBe(200);
    const status = res.body as ConsentStatusBody;
    expect(status.catalog_version).toBe(CONSENT_CATALOG_VERSION);
    expect(status.required).toEqual([...CONSENT_CODES]);
    expect(status.accepted).toEqual([]);
    expect(status.missing).toEqual([...CONSENT_CODES]);
    expect(status.complete).toBe(false);
    // Withdrawal (PDPPL right to withdraw) reports an empty history, not an absent key.
    expect(status.withdrawn).toEqual([]);
  });

  it('refuses unknown codes and superseded versions without writing a record', async () => {
    const customer = await customerUser(ctx, 'consent-invalid');

    const unknown = await authed(customer.agent)
      .post('/api/v1/me/consents')
      .send({ acceptances: [{ code: 'marketing', version: '2026-09-v1' }], locale: 'en' });
    const unknownDetails = expectApiError(unknown, 400, 'consent_code_invalid');
    expect(unknownDetails).toEqual({ consent_code: 'marketing' });

    const outdated = await authed(customer.agent)
      .post('/api/v1/me/consents')
      .send({
        acceptances: [
          { code: 'credit_bureau', version: CONSENT_CATALOG.credit_bureau.version },
          { code: 'terms', version: '2025-01-v0' },
        ],
        locale: 'en',
      });
    const outdatedDetails = expectApiError(outdated, 400, 'consent_version_outdated');
    expect(outdatedDetails).toEqual({ consent_code: 'terms' });

    // Validation is all-or-nothing: the valid credit_bureau acceptance was not kept.
    expect(await ctx.prisma.consentRecord.count({ where: { userId: customer.user.id } })).toBe(0);

    const badLocale = await authed(customer.agent)
      .post('/api/v1/me/consents')
      .send({ acceptances: consentAcceptances(), locale: 'fr' });
    expect(badLocale.status).toBe(400);
    expect(badLocale.body.error.code).toBe('validation_failed');

    const empty = await authed(customer.agent)
      .post('/api/v1/me/consents')
      .send({ acceptances: [], locale: 'en' });
    expect(empty.status).toBe(400);
  });

  it('records acceptances with channel, locale, text hash and request meta, and stamps the draft once complete', async () => {
    const { product, offer } = await showroom();
    const customer = await customerUser(ctx, 'consent-record', 'Asha Verma');
    const draft = await createCustomerDraft(customer.agent, { product, offer });
    expect(draft.status).toBe(201);
    const applicationId = draft.body.id as string;
    expect(draft.body.consents_completed_at).toBeNull();

    // First two consents from the web stepper.
    const partial = await acceptConsents(customer.agent, {
      applicationId,
      codes: ['credit_bureau', 'terms'],
    });
    expect(partial.status).toBe(200);
    const partialStatus = partial.body as ConsentStatusBody;
    expect(partialStatus.complete).toBe(false);
    expect(partialStatus.missing).toEqual(['kyc_biometric', 'aml']);
    expect(partialStatus.accepted).toHaveLength(2);
    for (const record of partialStatus.accepted) {
      expect(record).toEqual(
        expect.objectContaining({
          version: CONSENT_CATALOG[record.code as keyof typeof CONSENT_CATALOG].version,
          locale: 'en',
          channel: 'web',
          application_id: applicationId,
          actor_name: null,
          outdated: false,
        }),
      );
      expect(new Date(record.accepted_at).getTime()).not.toBeNaN();
    }

    const stillDraft = await authed(customer.agent).get(`/api/v1/applications/${applicationId}`);
    expect(stillDraft.body.consents_completed_at).toBeNull();

    // Remaining two from the native app, in Arabic.
    const rest = await acceptConsents(customer.agent, {
      applicationId,
      codes: ['kyc_biometric', 'aml'],
      locale: 'ar',
      channel: 'mobile',
    });
    expect(rest.status).toBe(200);
    const complete = rest.body as ConsentStatusBody;
    expect(complete.complete).toBe(true);
    expect(complete.missing).toEqual([]);
    expect(complete.accepted).toHaveLength(4);
    expect(complete.accepted.filter((r) => r.channel === 'mobile').map((r) => r.code).sort()).toEqual([
      'aml',
      'kyc_biometric',
    ]);
    expect(complete.accepted.filter((r) => r.locale === 'ar')).toHaveLength(2);

    // Ledger: hash of the exact wording shown, IP + UA captured, immutable rows.
    const rows = await ctx.prisma.consentRecord.findMany({ where: { userId: customer.user.id } });
    expect(rows).toHaveLength(4);
    for (const row of rows) {
      const def = CONSENT_CATALOG[row.code];
      const locale = row.locale === 'ar' ? 'ar' : 'en';
      expect(row.textHash).toBe(sha256(consentFullText(def, locale)));
      expect(row.applicationId).toBe(applicationId);
      expect(row.ipAddress).toBeTruthy();
      expect(row.userAgent).toBeTruthy();
      expect(row.actorUserId).toBeNull();
    }

    const stamped = await ctx.prisma.application.findUniqueOrThrow({ where: { id: applicationId } });
    expect(stamped.consentsCompletedAt).not.toBeNull();
    const detail = await authed(customer.agent).get(`/api/v1/applications/${applicationId}`);
    expect(detail.body.consents_completed_at).toBeTruthy();

    const logs = await ctx.prisma.activityLog.findMany({
      where: { entityType: 'application', entityId: applicationId },
    });
    expect(logs.filter((l) => l.action === 'consents_recorded')).toHaveLength(2);
    expect(logs.filter((l) => l.action === 'consents_completed')).toHaveLength(1);

    // Re-accepting is allowed (new ledger rows) but the stamp is written once.
    const again = await acceptConsents(customer.agent, { applicationId });
    expect(again.status).toBe(200);
    expect(await ctx.prisma.consentRecord.count({ where: { userId: customer.user.id } })).toBe(8);
    const logsAfter = await ctx.prisma.activityLog.count({
      where: { entityType: 'application', entityId: applicationId, action: 'consents_completed' },
    });
    expect(logsAfter).toBe(1);
    const reread = await ctx.prisma.application.findUniqueOrThrow({ where: { id: applicationId } });
    expect(reread.consentsCompletedAt?.getTime()).toBe(stamped.consentsCompletedAt?.getTime());
  });

  it('account-level acceptances cover a later draft as soon as its status is read', async () => {
    const { product, offer } = await showroom();
    const customer = await customerUser(ctx, 'consent-account');

    const accountLevel = await acceptConsents(customer.agent);
    expect(accountLevel.status).toBe(200);
    expect(accountLevel.body.complete).toBe(true);
    for (const record of accountLevel.body.accepted as ConsentRecordBody[]) {
      expect(record.application_id).toBeNull();
    }

    const draft = await createCustomerDraft(customer.agent, { product, offer });
    expect(draft.status).toBe(201);
    expect(draft.body.consents_completed_at).toBeNull();

    const status = await authed(customer.agent).get(`/api/v1/me/consents?application_id=${draft.body.id}`);
    expect(status.status).toBe(200);
    expect(status.body.complete).toBe(true);

    const detail = await authed(customer.agent).get(`/api/v1/applications/${draft.body.id}`);
    expect(detail.body.consents_completed_at).toBeTruthy();
  });

  it('never stamps a submitted application and hides other customers applications', async () => {
    const { company, product, offer } = await showroom();
    const customer = await customerUser(ctx, 'consent-submitted');
    const submitted = await seedUnderReviewApplication(ctx.prisma, {
      customer: customer.user,
      company,
      product,
      offer,
    });

    const res = await acceptConsents(customer.agent, { applicationId: submitted.id });
    expect(res.status).toBe(200);
    expect(res.body.complete).toBe(true);
    const row = await ctx.prisma.application.findUniqueOrThrow({ where: { id: submitted.id } });
    expect(row.consentsCompletedAt).toBeNull();

    const stranger = await customerUser(ctx, 'consent-stranger');
    const foreign = await acceptConsents(stranger.agent, { applicationId: submitted.id });
    expectApiError(foreign, 404, 'application_not_found');
    const foreignStatus = await authed(stranger.agent).get(`/api/v1/me/consents?application_id=${submitted.id}`);
    expectApiError(foreignStatus, 404, 'application_not_found');
    expect(await ctx.prisma.consentRecord.count({ where: { userId: stranger.user.id } })).toBe(0);
  });

  it('flags acceptances of superseded wording as outdated until the current version is accepted', async () => {
    const customer = await customerUser(ctx, 'consent-versions');
    await seedConsentRecords(ctx.prisma, {
      userId: customer.user.id,
      version: '2025-01-v0',
      acceptedAt: new Date(Date.now() - 86_400_000),
    });

    const before = await authed(customer.agent).get('/api/v1/me/consents');
    expect(before.status).toBe(200);
    const beforeStatus = before.body as ConsentStatusBody;
    expect(beforeStatus.accepted).toHaveLength(4);
    expect(beforeStatus.accepted.every((r) => r.outdated && r.version === '2025-01-v0')).toBe(true);
    expect(beforeStatus.missing).toEqual([...CONSENT_CODES]);
    expect(beforeStatus.complete).toBe(false);

    const reaccept = await acceptConsents(customer.agent, { codes: ['terms'] });
    expect(reaccept.status).toBe(200);
    const afterStatus = reaccept.body as ConsentStatusBody;
    expect(afterStatus.accepted).toHaveLength(5);
    // Newest first, so the fresh acceptance leads the history.
    expect(afterStatus.accepted[0]).toEqual(
      expect.objectContaining({ code: 'terms', version: CONSENT_CATALOG.terms.version, outdated: false }),
    );
    expect(afterStatus.missing).toEqual(['credit_bureau', 'kyc_biometric', 'aml']);
    expect(afterStatus.complete).toBe(false);
  });

  it('ops read follows application scope: assigned credit sees it, unassigned reads 404, foreign dealer 403', async () => {
    const { company, product, offer } = await showroom();
    const customer = await customerUser(ctx, 'consent-ops-customer');
    const draft = await createCustomerDraft(customer.agent, { product, offer });
    expect(draft.status).toBe(201);
    await acceptConsents(customer.agent, { applicationId: draft.body.id });

    const credit = await staffUser(ctx, 'consent-ops-credit', 'credit_officer', { creditScope: 'assigned' });
    await assignCreditOfficer(ctx.prisma, credit.user.id, company.id);
    const scoped = await authed(credit.agent).get(`/api/v1/ops/applications/${draft.body.id}/consents`);
    expect(scoped.status).toBe(200);
    expect(scoped.body.complete).toBe(true);
    expect(scoped.body.accepted).toHaveLength(4);

    const unassigned = await staffUser(ctx, 'consent-ops-unassigned', 'credit_officer', { creditScope: 'assigned' });
    const hidden = await authed(unassigned.agent).get(`/api/v1/ops/applications/${draft.body.id}/consents`);
    expect(hidden.status).toBe(404);

    const otherCompany = await seedCompany(ctx.prisma, 'Other Motors');
    const foreignDealer = await staffUser(ctx, 'consent-ops-dealer', 'dealer_agent', { companyId: otherCompany.id });
    const forbidden = await authed(foreignDealer.agent).get(`/api/v1/ops/applications/${draft.body.id}/consents`);
    expectApiError(forbidden, 403, 'forbidden_role');

    const ownDealer = await staffUser(ctx, 'consent-ops-own-dealer', 'dealer_agent', { companyId: company.id });
    const own = await authed(ownDealer.agent).get(`/api/v1/ops/applications/${draft.body.id}/consents`);
    expect(own.status).toBe(200);

    const customerOnOps = await authed(customer.agent).get(`/api/v1/ops/applications/${draft.body.id}/consents`);
    expectApiError(customerOnOps, 403, 'forbidden_role');
  });

  describe('withdrawal (wave 2)', () => {
    it('withdraws an account-level consent: leaves accepted, appears under withdrawn, reason kept', async () => {
      const customer = await customerUser(ctx, 'withdraw-account');
      await acceptConsents(customer.agent);

      const res = await authed(customer.agent)
        .post('/api/v1/me/consents/aml/withdraw')
        .send({ reason: 'I no longer wish to be screened' });
      expect(res.status).toBe(200);

      const status = await authed(customer.agent).get('/api/v1/me/consents');
      expect(status.status).toBe(200);
      const body = status.body as ConsentStatusBody;
      expect(body.accepted.map((r) => r.code).sort()).toEqual(['credit_bureau', 'kyc_biometric', 'terms']);
      expect(body.missing).toEqual(['aml']);
      expect(body.complete).toBe(false);
      expect(body.withdrawn).toBeDefined();
      expect(body.withdrawn).toHaveLength(1);
      expect(body.withdrawn?.[0]).toEqual(expect.objectContaining({ code: 'aml' }));
      expect(body.withdrawn?.[0]?.withdrawn_at).toBeTruthy();

      const row = await ctx.prisma.consentRecord.findFirstOrThrow({
        where: { userId: customer.user.id, code: 'aml' },
      });
      expect(row.withdrawnAt).not.toBeNull();
      expect(row.withdrawalReason).toBe('I no longer wish to be screened');
    });

    it('clears the consent stamp on the customer drafts', async () => {
      const { product, offer } = await showroom();
      const customer = await customerUser(ctx, 'withdraw-draft');
      const draft = await createCustomerDraft(customer.agent, { product, offer });
      expect(draft.status).toBe(201);
      await acceptConsents(customer.agent, { applicationId: draft.body.id });
      const stamped = await ctx.prisma.application.findUniqueOrThrow({ where: { id: draft.body.id } });
      expect(stamped.consentsCompletedAt).not.toBeNull();

      const res = await authed(customer.agent).post('/api/v1/me/consents/terms/withdraw').send({});
      expect(res.status).toBe(200);

      const cleared = await ctx.prisma.application.findUniqueOrThrow({ where: { id: draft.body.id } });
      expect(cleared.consentsCompletedAt).toBeNull();
      const submit = await authed(customer.agent).post(`/api/v1/applications/${draft.body.id}/submit`);
      expectApiError(submit, 409, 'consents_required');
    });

    it('is blocked while an application in flight relies on the consent, and opens a data-rights request instead', async () => {
      const { product, offer } = await showroom();
      const customer = await customerUser(ctx, 'withdraw-blocked');
      const draft = await createCustomerDraft(customer.agent, { product, offer });
      expect(draft.status).toBe(201);
      await acceptConsents(customer.agent, { applicationId: draft.body.id });
      await ctx.prisma.application.update({
        where: { id: draft.body.id },
        data: { status: 'under_review', submittedAt: new Date() },
      });

      const res = await authed(customer.agent)
        .post('/api/v1/me/consents/credit_bureau/withdraw')
        .send({ reason: 'Please stop the bureau enquiry' });
      expectApiError(res, 409, 'consent_withdrawal_blocked');

      const untouched = await ctx.prisma.consentRecord.findFirstOrThrow({
        where: { userId: customer.user.id, code: 'credit_bureau' },
      });
      expect(untouched.withdrawnAt).toBeNull();

      const requests = await ctx.prisma.dataRightsRequest.findMany({ where: { userId: customer.user.id } });
      expect(requests).toHaveLength(1);
      expect(requests[0]).toEqual(
        expect.objectContaining({ kind: 'consent_withdrawal', consentCode: 'credit_bureau', status: 'open' }),
      );

      const listed = await authed(customer.agent).get('/api/v1/me/data-rights');
      expect(listed.status).toBe(200);
      expect(listed.body).toHaveLength(1);
      expect(listed.body[0]).toEqual(
        expect.objectContaining({ kind: 'consent_withdrawal', consent_code: 'credit_bureau', status: 'open' }),
      );
    });

    it('rejects an unknown consent code', async () => {
      const customer = await customerUser(ctx, 'withdraw-unknown');
      await acceptConsents(customer.agent);
      const res = await authed(customer.agent).post('/api/v1/me/consents/marketing/withdraw').send({});
      expect([400, 404]).toContain(res.status);
      expect(await ctx.prisma.consentRecord.count({ where: { userId: customer.user.id, withdrawnAt: { not: null } } })).toBe(0);
    });
  });
});
