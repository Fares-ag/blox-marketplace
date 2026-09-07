import { createHash } from 'node:crypto';
import type { User } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { CONSENT_CODES } from '@drivemarket/shared/domain-rules';
import { createIntegrationApp, destroyIntegrationApp, type IntegrationContext } from './support/app';
import { authed } from './support/auth';
import { resetDatabase } from './support/db';
import { seedCompany, seedDraftApplication, seedOffer, seedProduct } from './support/fixtures';
import { consentAcceptances, customerUser, expectApiError, otpFromSms, staffUser, type Actor } from './support/flows';
import { KycBridgeService } from '../../src/kyc/kyc-bridge.service';
import { SmsService, type SmsMessage, type SmsSendResult } from '../../src/sms/sms.service';
import { OTP_POLICY } from '../../src/common/otp';

const ASSIST_TTL_MINUTES = 90;
const PROOF_HEADER = 'x-assist-proof';
const KYC_INVITE_URL = 'https://kyc.blox.test/onboard/invite-token-123';

/** Everything the API hands the SMS gateway, so the tests can read the one-time codes. */
const smsOutbox: SmsMessage[] = [];

const ensureSession = vi.fn(async (_user: User, _applicationId: string) => ({
  case_id: 'kyc-case-assist',
  invite_token: 'invite-token-123',
  invite_url: KYC_INVITE_URL,
  required_slots: ['qid_front', 'qid_back', 'passport', 'selfie'],
}));

function assistSms(kind: SmsMessage['kind'], to?: string): SmsMessage[] {
  return smsOutbox.filter((m) => m.kind === kind && (!to || m.to === to));
}

function latestOtp(to: string): string {
  const messages = smsOutbox.filter((m) => m.to === to && (m.kind === 'assist_link' || m.kind === 'assist_otp'));
  const last = messages[messages.length - 1];
  if (!last) throw new Error(`no assisted-session SMS sent to ${to}`);
  return otpFromSms(last.body);
}

describe('assisted sessions (integration)', () => {
  let ctx: IntegrationContext;

  beforeAll(async () => {
    ctx = await createIntegrationApp({ ASSIST_SESSION_TTL_MINUTES: String(ASSIST_TTL_MINUTES) }, [
      {
        token: SmsService,
        useValue: {
          isLive: false,
          send: async (message: SmsMessage): Promise<SmsSendResult> => {
            smsOutbox.push(message);
            return { delivered: false, provider: 'log' };
          },
        } satisfies Partial<SmsService>,
      },
      {
        token: KycBridgeService,
        useValue: {
          ensureSession,
          syncDocumentsForApplication: async () => undefined,
          getVerificationSummary: async () => null,
          documentStatus: async () => ({ case_status: 'NOT_STARTED', kyc_status: null, slots: [] }),
          verifyWebhookSignature: () => false,
        },
      },
    ]);
  });

  afterAll(async () => {
    await destroyIntegrationApp(ctx);
  });

  beforeEach(async () => {
    await resetDatabase(ctx.prisma);
    smsOutbox.length = 0;
    ensureSession.mockClear();
  });

  async function showroom(label: string) {
    const company = await seedCompany(ctx.prisma, 'Assist Motors');
    const offer = await seedOffer(ctx.prisma, company.id);
    const product = await seedProduct(ctx.prisma, { companyId: company.id, offerId: offer.id, make: 'Nissan', model: 'Patrol' });
    const customer = await customerUser(ctx, `${label}-customer`, 'Khalid Al-Kuwari');
    const application = await seedDraftApplication(ctx.prisma, { customer: customer.user, company, product, offer });
    const dealer = await staffUser(ctx, `${label}-dealer`, 'dealer_agent', { companyId: company.id }, 'Sara Sales');
    return { company, offer, product, customer, application, dealer };
  }

  async function startSession(dealer: Actor, applicationId: string, phone = '5551 2345', email?: string) {
    const res = await authed(dealer.agent)
      .post('/api/v1/assist-sessions')
      .send({ application_id: applicationId, phone, ...(email ? { email } : {}) });
    expect(res.status).toBe(201);
    const token = String(res.body.link).split('/assist/')[1]!;
    return { body: res.body as Record<string, unknown>, token };
  }

  it('runs the full journey: create → public view → wrong/right OTP → consents → identity → complete', async () => {
    const { customer, application, dealer } = await showroom('journey');

    const started = Date.now();
    const created = await authed(dealer.agent)
      .post('/api/v1/assist-sessions')
      .send({ application_id: application.id, phone: '5551 2345', email: 'Khalid@Example.test' });
    expect(created.status).toBe(201);
    expect(created.body).toEqual(
      expect.objectContaining({
        application_id: application.id,
        status: 'pending',
        phone_masked: '+974 XXXX X345',
        last_opened_at: null,
        otp_verified_at: null,
        consents_completed_at: null,
        identity_started_at: null,
        completed_at: null,
      }),
    );
    const link = created.body.link as string;
    expect(link).toMatch(/^https?:\/\/[^/]+\/assist\/[A-Za-z0-9_-]{40,}$/);
    const token = link.split('/assist/')[1]!;
    const expiresAt = new Date(created.body.expires_at as string).getTime();
    expect(expiresAt - started).toBeGreaterThan((ASSIST_TTL_MINUTES - 1) * 60_000);
    expect(expiresAt - started).toBeLessThan((ASSIST_TTL_MINUTES + 1) * 60_000);

    const linkSms = assistSms('assist_link', '+97455512345');
    expect(linkSms).toHaveLength(1);
    expect(linkSms[0]!.body).toContain(link);
    expect(linkSms[0]!.body).toContain('Assist Motors');
    const otp = otpFromSms(linkSms[0]!.body);
    expect(otp).toMatch(/^\d{6}$/);
    // The OTP travels by SMS only, never in the API response.
    expect(JSON.stringify(created.body)).not.toContain(otp);

    const sessionRow = await ctx.prisma.assistedSession.findUniqueOrThrow({ where: { token } });
    expect(sessionRow).toEqual(
      expect.objectContaining({
        customerUserId: customer.user.id,
        createdByUserId: dealer.user.id,
        phone: '+97455512345',
        email: 'khalid@example.test',
        otpAttempts: 0,
      }),
    );
    expect(sessionRow.otpCodeHash).toBeTruthy();
    expect(sessionRow.otpCodeHash).not.toContain(otp);
    const createdLog = await ctx.prisma.activityLog.findFirst({
      where: { entityType: 'assisted_session', entityId: sessionRow.id, action: 'assisted_session_created' },
    });
    expect(createdLog?.metadata).toEqual(
      expect.objectContaining({ application_id: application.id, phone_masked: '+974 XXXX X345', email_sent: true }),
    );

    // Customer opens the link on their phone (no auth).
    const view = await ctx.agent.get(`/api/v1/assist/${token}`);
    expect(view.status).toBe(200);
    expect(view.body).toEqual(expect.objectContaining({
      status: 'pending',
      phone_masked: '+974 XXXX X345',
      dealer_name: 'Assist Motors',
      agent_name: 'Sara Sales',
      vehicle: { make: 'Nissan', model: 'Patrol', model_year: 2024 },
      plan: { tenure_months: 36, down_payment_pct: 20, monthly: expect.any(Number) },
      branding: expect.objectContaining({ display_name: 'Assist Motors' }),
      expires_at: created.body.expires_at,
      consent_locale: 'en',
      kyc_url: null,
    }));
    expect(JSON.stringify(view.body)).not.toContain(otp);
    expect(JSON.stringify(view.body)).not.toContain('55512345');
    const opened = await ctx.prisma.assistedSession.findUniqueOrThrow({ where: { token } });
    expect(opened.lastOpenedAt).not.toBeNull();

    // Nothing past the OTP works without a proof.
    expectApiError(
      await ctx.agent.post(`/api/v1/assist/${token}/consents`).send({ acceptances: consentAcceptances(), locale: 'en' }),
      401,
      'assist_proof_invalid',
    );

    const malformed = await ctx.agent.post(`/api/v1/assist/${token}/otp/verify`).send({ code: '12' });
    expectApiError(malformed, 400, 'validation_failed');

    const wrongCode = otp === '000000' ? '111111' : '000000';
    const wrong = await ctx.agent.post(`/api/v1/assist/${token}/otp/verify`).send({ code: wrongCode });
    expect(expectApiError(wrong, 400, 'otp_invalid')).toEqual({ remaining: OTP_POLICY.maxAttempts - 1 });
    const wrongAgain = await ctx.agent.post(`/api/v1/assist/${token}/otp/verify`).send({ code: wrongCode });
    expect(expectApiError(wrongAgain, 400, 'otp_invalid')).toEqual({ remaining: OTP_POLICY.maxAttempts - 2 });

    const verified = await ctx.agent.post(`/api/v1/assist/${token}/otp/verify`).send({ code: otp });
    expect(verified.status).toBe(200);
    expect(verified.body.status).toBe('otp_verified');
    const proof = verified.body.proof as string;
    expect(proof.length).toBeGreaterThanOrEqual(40);
    const afterOtp = await ctx.prisma.assistedSession.findUniqueOrThrow({ where: { token } });
    expect(afterOtp.otpCodeHash).toBeNull();
    expect(afterOtp.otpVerifiedAt).not.toBeNull();
    expect(afterOtp.otpAttempts).toBe(0);
    expect(afterOtp.proofHash).toBe(createHash('sha256').update(proof).digest('hex'));

    // The code is single-use.
    expectApiError(await ctx.agent.post(`/api/v1/assist/${token}/otp/verify`).send({ code: otp }), 400, 'otp_not_issued');

    // Wrong proof, then consents in two steps.
    expectApiError(
      await ctx.agent
        .post(`/api/v1/assist/${token}/consents`)
        .set(PROOF_HEADER, 'not-the-proof')
        .send({ acceptances: consentAcceptances(), locale: 'en' }),
      401,
      'assist_proof_invalid',
    );
    expectApiError(
      await ctx.agent.post(`/api/v1/assist/${token}/identity/start`).set(PROOF_HEADER, proof),
      409,
      'consents_required',
    );

    const partial = await ctx.agent
      .post(`/api/v1/assist/${token}/consents`)
      .set(PROOF_HEADER, proof)
      .send({ acceptances: consentAcceptances(['credit_bureau', 'terms']), locale: 'ar' });
    expect(partial.status).toBe(200);
    expect(partial.body.complete).toBe(false);
    expect(partial.body.missing).toEqual(['kyc_biometric', 'aml']);
    expect((await ctx.agent.get(`/api/v1/assist/${token}`)).body.status).toBe('otp_verified');

    const rest = await ctx.agent
      .post(`/api/v1/assist/${token}/consents`)
      .set(PROOF_HEADER, proof)
      .send({ acceptances: consentAcceptances(['kyc_biometric', 'aml']), locale: 'ar' });
    expect(rest.status).toBe(200);
    expect(rest.body.complete).toBe(true);
    expect(rest.body.accepted).toHaveLength(4);
    for (const record of rest.body.accepted as Array<Record<string, unknown>>) {
      expect(record).toEqual(
        expect.objectContaining({ channel: 'assisted', locale: 'ar', actor_name: 'Sara Sales', application_id: application.id }),
      );
    }
    const consentRows = await ctx.prisma.consentRecord.findMany({ where: { userId: customer.user.id } });
    expect(consentRows.map((r) => r.code).sort()).toEqual([...CONSENT_CODES].sort());
    for (const row of consentRows) {
      expect(row.channel).toBe('assisted');
      expect(row.actorUserId).toBe(dealer.user.id);
      expect(row.sessionId).toBe(sessionRow.id);
      expect(row.applicationId).toBe(application.id);
    }
    const consented = await ctx.prisma.assistedSession.findUniqueOrThrow({ where: { token } });
    expect(consented.status).toBe('consents_done');
    expect(consented.consentsCompletedAt).not.toBeNull();
    const stampedApp = await ctx.prisma.application.findUniqueOrThrow({ where: { id: application.id } });
    expect(stampedApp.consentsCompletedAt).not.toBeNull();
    expect((await ctx.agent.get(`/api/v1/assist/${token}`)).body.status).toBe('consents_done');

    // Identity verification hands over to the KYC platform for this customer + application.
    const identity = await ctx.agent.post(`/api/v1/assist/${token}/identity/start`).set(PROOF_HEADER, proof);
    expect(identity.status).toBe(200);
    expect(identity.body).toEqual({ kyc_url: KYC_INVITE_URL, status: 'identity_started' });
    expect(ensureSession).toHaveBeenCalledTimes(1);
    expect(ensureSession.mock.calls[0]![0].id).toBe(customer.user.id);
    expect(ensureSession.mock.calls[0]![1]).toBe(application.id);
    const identityRow = await ctx.prisma.assistedSession.findUniqueOrThrow({ where: { token } });
    expect(identityRow.identityStartedAt).not.toBeNull();

    const completed = await ctx.agent.post(`/api/v1/assist/${token}/complete`).set(PROOF_HEADER, proof);
    expect(completed.status).toBe(200);
    expect(completed.body).toEqual({ status: 'completed' });
    const notice = await ctx.prisma.notification.findFirst({
      where: { userId: dealer.user.id, title: 'Assisted session completed' },
    });
    expect(notice?.body).toContain('Khalid Al-Kuwari');
    expect(notice?.linkPath).toBe(`/applications/${application.id}`);

    const staffList = await authed(dealer.agent).get(`/api/v1/assist-sessions?application_id=${application.id}`);
    expect(staffList.status).toBe(200);
    expect(staffList.body).toHaveLength(1);
    expect(staffList.body[0]).toEqual(expect.objectContaining({ status: 'completed', phone_masked: '+974 XXXX X345' }));
    expect(staffList.body[0].link).toBeUndefined();
    expect(staffList.body[0].completed_at).toBeTruthy();

    // A completed session is closed to everyone.
    expectApiError(await ctx.agent.post(`/api/v1/assist/${token}/otp/verify`).send({ code: otp }), 409, 'assist_session_closed');
    expectApiError(await authed(dealer.agent).post(`/api/v1/assist-sessions/${sessionRow.id}/cancel`), 409, 'assist_session_closed');
    expectApiError(await ctx.agent.post(`/api/v1/assist/${token}/complete`).set(PROOF_HEADER, proof), 409, 'assist_session_closed');

    const actions = await ctx.prisma.activityLog.findMany({
      where: { entityType: 'assisted_session', entityId: sessionRow.id },
      orderBy: { createdAt: 'asc' },
    });
    expect(actions.map((a) => a.action)).toEqual([
      'assisted_session_created',
      'assisted_otp_verified',
      'assisted_identity_started',
      'assisted_session_completed',
    ]);
  });

  it('locks the OTP after five wrong attempts', async () => {
    const { application, dealer } = await showroom('lock');
    const { token } = await startSession(dealer, application.id);
    const otp = latestOtp('+97455512345');
    const wrongCode = otp === '000000' ? '111111' : '000000';

    for (let attempt = 1; attempt < OTP_POLICY.maxAttempts; attempt += 1) {
      const res = await ctx.agent.post(`/api/v1/assist/${token}/otp/verify`).send({ code: wrongCode });
      expect(expectApiError(res, 400, 'otp_invalid')).toEqual({ remaining: OTP_POLICY.maxAttempts - attempt });
    }
    const locked = await ctx.agent.post(`/api/v1/assist/${token}/otp/verify`).send({ code: wrongCode });
    const details = expectApiError(locked, 429, 'otp_locked');
    expect(details?.retry_after_sec).toBeGreaterThan(0);
    expect(details?.retry_after_sec).toBeLessThanOrEqual(OTP_POLICY.lockMs / 1000);

    // Even the right code is refused while locked.
    expectApiError(await ctx.agent.post(`/api/v1/assist/${token}/otp/verify`).send({ code: otp }), 429, 'otp_locked');
    const row = await ctx.prisma.assistedSession.findUniqueOrThrow({ where: { token } });
    expect(row.otpAttempts).toBe(OTP_POLICY.maxAttempts);
    expect(row.otpLockedUntil).not.toBeNull();
    expect(row.status).toBe('pending');
  });

  it('caps public resends at the policy budget and issues a fresh code each time', async () => {
    const { application, dealer } = await showroom('resend');
    const { token } = await startSession(dealer, application.id);
    const firstOtp = latestOtp('+97455512345');

    for (let i = 1; i <= OTP_POLICY.maxResends; i += 1) {
      const res = await ctx.agent.post(`/api/v1/assist/${token}/otp/resend`);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ status: 'pending', otp_expires_in_sec: OTP_POLICY.ttlMs / 1000 });
      expect(assistSms('assist_otp', '+97455512345')).toHaveLength(i);
    }
    const exhausted = await ctx.agent.post(`/api/v1/assist/${token}/otp/resend`);
    const details = expectApiError(exhausted, 429, 'otp_resend_limit');
    expect(details?.retry_after_sec).toBeGreaterThan(0);

    // Only the latest code is valid.
    const latest = latestOtp('+97455512345');
    if (latest !== firstOtp) {
      expectApiError(await ctx.agent.post(`/api/v1/assist/${token}/otp/verify`).send({ code: firstOtp }), 400, 'otp_invalid');
    }
    const ok = await ctx.agent.post(`/api/v1/assist/${token}/otp/verify`).send({ code: latest });
    expect(ok.status).toBe(200);
    expect(ok.body.status).toBe('otp_verified');

    // Staff resend on a verified session is still allowed but shares the same budget.
    const row = await ctx.prisma.assistedSession.findUniqueOrThrow({ where: { token } });
    expectApiError(await authed(dealer.agent).post(`/api/v1/assist-sessions/${row.id}/resend`), 429, 'otp_resend_limit');
  });

  it('a new session supersedes the open one, and expired links are refused', async () => {
    const { application, dealer } = await showroom('supersede');
    const first = await startSession(dealer, application.id);
    const second = await startSession(dealer, application.id, '5559 8765');
    expect(second.body.phone_masked).toBe('+974 XXXX X765');

    const firstView = await ctx.agent.get(`/api/v1/assist/${first.token}`);
    expect(firstView.body.status).toBe('cancelled');
    expectApiError(
      await ctx.agent.post(`/api/v1/assist/${first.token}/otp/verify`).send({ code: '123456' }),
      409,
      'assist_session_closed',
    );

    const list = await authed(dealer.agent).get(`/api/v1/assist-sessions?application_id=${application.id}`);
    expect(list.body.map((s: { status: string }) => s.status).sort()).toEqual(['cancelled', 'pending']);

    await ctx.prisma.assistedSession.update({
      where: { token: second.token },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });
    const expiredView = await ctx.agent.get(`/api/v1/assist/${second.token}`);
    expect(expiredView.body.status).toBe('expired');
    expectApiError(
      await ctx.agent.post(`/api/v1/assist/${second.token}/otp/verify`).send({ code: latestOtp('+97455598765') }),
      409,
      'assist_session_expired',
    );
    expectApiError(await ctx.agent.post(`/api/v1/assist/${second.token}/otp/resend`), 409, 'assist_session_expired');
    const expiredRow = await ctx.prisma.assistedSession.findUniqueOrThrow({ where: { token: second.token } });
    expect(expiredRow.status).toBe('expired');

    expectApiError(await ctx.agent.get('/api/v1/assist/not-a-token'), 404, 'assist_session_not_found');
  });

  it('staff cancel closes the link; scope and application state are enforced on create', async () => {
    const { company, offer, customer, application, dealer } = await showroom('scope');
    const { token, body } = await startSession(dealer, application.id);

    const cancelled = await authed(dealer.agent).post(`/api/v1/assist-sessions/${body.id}/cancel`);
    expect(cancelled.status).toBe(200);
    expect(cancelled.body.status).toBe('cancelled');
    expect((await ctx.agent.get(`/api/v1/assist/${token}`)).body.status).toBe('cancelled');
    const cancelLog = await ctx.prisma.activityLog.findFirst({
      where: { entityType: 'assisted_session', entityId: body.id as string, action: 'assisted_session_cancelled' },
    });
    expect(cancelLog?.fromValue).toBe('pending');

    const otherCompany = await seedCompany(ctx.prisma, 'Elsewhere Motors');
    const foreignDealer = await staffUser(ctx, 'scope-foreign', 'dealer_agent', { companyId: otherCompany.id });
    expectApiError(
      await authed(foreignDealer.agent).post('/api/v1/assist-sessions').send({ application_id: application.id, phone: '55512345' }),
      404,
      'application_not_found',
    );
    expect((await authed(foreignDealer.agent).get(`/api/v1/assist-sessions?application_id=${application.id}`)).status).toBe(404);

    expectApiError(
      await authed(customer.agent).post('/api/v1/assist-sessions').send({ application_id: application.id, phone: '55512345' }),
      403,
      'forbidden_role',
    );
    expectApiError(
      await authed(dealer.agent).post('/api/v1/assist-sessions').send({ application_id: application.id, phone: '12' }),
      400,
      'validation_failed',
    );
    expectApiError(
      await authed(dealer.agent).post('/api/v1/assist-sessions').send({ application_id: application.id, phone: 'abcdefgh' }),
      400,
      'phone_invalid',
    );

    // Admins may assist on any company; closed applications are refused.
    const admin = await staffUser(ctx, 'scope-admin', 'admin');
    const adminSession = await authed(admin.agent)
      .post('/api/v1/assist-sessions')
      .send({ application_id: application.id, phone: '55512345' });
    expect(adminSession.status).toBe(201);

    const rejected = await seedProduct(ctx.prisma, { companyId: company.id, offerId: offer.id });
    const closedApp = await seedDraftApplication(ctx.prisma, { customer: customer.user, company, product: rejected, offer });
    await ctx.prisma.application.update({ where: { id: closedApp.id }, data: { status: 'rejected' } });
    expectApiError(
      await authed(dealer.agent).post('/api/v1/assist-sessions').send({ application_id: closedApp.id, phone: '55512345' }),
      409,
      'application_closed',
    );
  });
});
