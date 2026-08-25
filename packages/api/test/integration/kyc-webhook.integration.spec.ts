import { createHmac } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createAgent,
  createIntegrationApp,
  destroyIntegrationApp,
  type IntegrationContext,
} from './support/app';
import { resetDatabase } from './support/db';
import { buildPricingSnapshot, seedCompany, seedOffer, seedProduct } from './support/fixtures';
import { KycPlatformClient, type KycCaseDetail } from '../../src/kyc/kyc-platform.client';

const WEBHOOK_SECRET = 'integration-kyc-webhook-secret';

function signWebhook(rawBody: string, secret = WEBHOOK_SECRET) {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
  return { header: `t=${timestamp},v1=${signature}`, rawBody };
}

describe('KYC webhook handling (integration)', () => {
  let ctx: IntegrationContext;
  const getCaseDetail = vi.fn<Parameters<KycPlatformClient['getCaseDetail']>, ReturnType<KycPlatformClient['getCaseDetail']>>();

  beforeAll(async () => {
    getCaseDetail.mockResolvedValue({
      id: 'kyc-case-1',
      status: 'APPROVED',
      external_ref: 'app-placeholder',
      required_documents: ['qid_front', 'qid_back', 'passport'],
      documents: [
        {
          id: 'doc-qid-front',
          type: 'qid_front',
          status: 'PROCESSED',
          review_status: 'pass',
          quality: 0.95,
          authenticity: 0.9,
          created_at: new Date().toISOString(),
        },
        {
          id: 'doc-qid-back',
          type: 'qid_back',
          status: 'PROCESSED',
          review_status: 'pass',
          quality: 0.92,
          authenticity: 0.88,
          created_at: new Date().toISOString(),
        },
      ],
    } satisfies KycCaseDetail);

    ctx = await createIntegrationApp({ KYC_WEBHOOK_SECRET: WEBHOOK_SECRET }, [
      {
        token: KycPlatformClient,
        useValue: { getCaseDetail } satisfies Partial<KycPlatformClient>,
      },
    ]);
  });

  afterAll(async () => {
    await destroyIntegrationApp(ctx);
  });

  beforeEach(async () => {
    await resetDatabase(ctx.prisma);
    getCaseDetail.mockClear();
  });

  it('rejects webhooks with an invalid signature', async () => {
    const guest = createAgent(ctx);
    const body = { type: 'case.updated', case_id: 'kyc-case-1' };

    const res = await guest
      .post('/api/v1/webhooks/kyc')
      .set('x-kyc-signature', 't=1,v1=deadbeef')
      .send(body);

    expect(res.status).toBe(401);
    expect(getCaseDetail).not.toHaveBeenCalled();
  });

  it('syncs identity documents and updates application kycStatus on a valid webhook', async () => {
    const company = await seedCompany(ctx.prisma, 'KYC Co');
    const offer = await seedOffer(ctx.prisma, company.id);
    const product = await seedProduct(ctx.prisma, { companyId: company.id, offerId: offer.id });
    const customer = await ctx.prisma.user.create({
      data: {
        email: 'kyc-customer@drivemarket.local',
        name: 'KYC Customer',
        role: 'customer',
        emailVerified: true,
        isActive: true,
      },
    });

    const app = await ctx.prisma.application.create({
      data: {
        customerUserId: customer.id,
        customerEmail: customer.email,
        customerSnapshot: { full_name: customer.name, phone: '+97450000000', qid: '28012345678' },
        companyId: company.id,
        productId: product.id,
        offerId: offer.id,
        pricingSnapshot: buildPricingSnapshot(Number(product.price)),
        status: 'draft',
        kycCaseId: 'kyc-case-1',
        kycStatus: 'pending',
      },
    });

    getCaseDetail.mockResolvedValueOnce({
      id: 'kyc-case-1',
      status: 'APPROVED',
      external_ref: app.id,
      required_documents: ['qid_front', 'qid_back', 'passport'],
      documents: [
        {
          id: 'doc-qid-front',
          type: 'qid_front',
          status: 'PROCESSED',
          review_status: 'pass',
          quality: 0.95,
          authenticity: 0.9,
          created_at: new Date().toISOString(),
        },
        {
          id: 'doc-qid-back',
          type: 'qid_back',
          status: 'PROCESSED',
          review_status: 'pass',
          quality: 0.92,
          authenticity: 0.88,
          created_at: new Date().toISOString(),
        },
      ],
    });

    const payload = { type: 'case.updated', case_id: 'kyc-case-1' };
    const { header, rawBody } = signWebhook(JSON.stringify(payload));
    const guest = createAgent(ctx);

    const res = await guest
      .post('/api/v1/webhooks/kyc')
      .set('x-kyc-signature', header)
      .set('Content-Type', 'application/json')
      .send(JSON.parse(rawBody));

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ ok: true });
    expect(getCaseDetail).toHaveBeenCalledWith('kyc-case-1');

    const docs = await ctx.prisma.applicationDocument.findMany({
      where: { applicationId: app.id },
      orderBy: { kycDocumentType: 'asc' },
    });
    expect(docs).toHaveLength(2);
    expect(docs.map((d) => d.kycDocumentType)).toEqual(['qid_back', 'qid_front']);
    expect(docs.every((d) => d.verificationStatus === 'verified')).toBe(true);

    const updated = await ctx.prisma.application.findUniqueOrThrow({ where: { id: app.id } });
    expect(updated.kycStatus).toBe('verified');
  });
});
