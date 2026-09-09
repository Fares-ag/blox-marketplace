import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createIntegrationApp, destroyIntegrationApp, type IntegrationContext } from './support/app';
import { authed } from './support/auth';
import { resetDatabase } from './support/db';
import {
  assignCreditOfficer,
  buildPricingSnapshot,
  customerSnapshotFixture,
  QID,
  seedApplicationDocument,
  seedCompany,
  seedFinancePartner,
  seedOffer,
  seedProduct,
  seedUnderReviewApplication,
  seedVerifiedEkycIdentity,
} from './support/fixtures';
import {
  acceptConsents,
  createCustomerDraft,
  customerUser,
  daysAgo,
  expectApiError,
  staffUser,
  uploadApplicationDocument,
  type Actor,
} from './support/flows';

type SlotBody = {
  category: string;
  required: boolean;
  group: string;
  labelKey: string;
  maxAgeDays?: number;
  uploaded_at?: string | null;
};

type SlotsBody = { slots: SlotBody[]; uploaded: string[]; missing: string[]; stale?: string[] };

const EXPAT_PRIVATE_REQUIRED = ['qid', 'passport', 'salary', 'bank'];

describe('customer intake (integration)', () => {
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

  async function showroom(opts: { vehicleIdentity?: boolean } = {}) {
    const company = await seedCompany(ctx.prisma, 'Intake Motors');
    const offer = await seedOffer(ctx.prisma, company.id);
    const product = await seedProduct(ctx.prisma, {
      companyId: company.id,
      offerId: offer.id,
      vehicleIdentity: opts.vehicleIdentity ?? true,
    });
    const credit = await staffUser(ctx, `intake-credit-${randomUUID().slice(0, 4)}`, 'credit_officer', { creditScope: 'assigned' }, 'Credit Reviewer');
    await assignCreditOfficer(ctx.prisma, credit.user.id, company.id);
    return { company, offer, product, credit };
  }

  async function submit(actor: Actor, applicationId: string) {
    return authed(actor.agent).post(`/api/v1/applications/${applicationId}/submit`);
  }

  async function slotsOf(actor: Actor, applicationId: string): Promise<SlotsBody> {
    const res = await authed(actor.agent).get(`/api/v1/applications/${applicationId}/document-slots`);
    expect(res.status).toBe(200);
    return res.body as SlotsBody;
  }

  /**
   * Draft with consents captured and every required document on file — one gate
   * away from under_review. Identity is established the way the platform does
   * it (BRD Qatar e-KYC BR-3): the customer's own QID upload is kept on file but
   * the slot is closed by the verified KYC capture. `ekyc: false` leaves the
   * identity slot open, for the specs that assert on that rule.
   */
  async function readyDraft(
    label: string,
    opts: {
      vehicleIdentity?: boolean;
      snapshot?: Record<string, unknown>;
      documents?: string[];
      ekyc?: boolean;
    } = {},
  ) {
    const showroomCtx = await showroom({ vehicleIdentity: opts.vehicleIdentity });
    const customer = await customerUser(ctx, `${label}-customer`, 'Asha Verma');
    const draft = await createCustomerDraft(customer.agent, {
      product: showroomCtx.product,
      offer: showroomCtx.offer,
      snapshot: opts.snapshot,
    });
    expect(draft.status).toBe(201);
    const applicationId = draft.body.id as string;
    expect((await acceptConsents(customer.agent, { applicationId })).body.complete).toBe(true);
    for (const category of opts.documents ?? EXPAT_PRIVATE_REQUIRED) {
      expect((await uploadApplicationDocument(customer.agent, applicationId, category)).status).toBe(201);
    }
    if (opts.ekyc !== false) await seedVerifiedEkycIdentity(ctx.prisma, applicationId);
    return { ...showroomCtx, customer, applicationId };
  }

  it('creates a draft from the shared snapshot: residency from the QID, profile mirrored, soft rules flagged', async () => {
    const { company, offer, product } = await showroom();
    const customer = await customerUser(ctx, 'intake-create', 'Asha Verma');

    const res = await createCustomerDraft(customer.agent, { product, offer });
    expect(res.status).toBe(201);
    expect(res.body).toEqual(
      expect.objectContaining({
        status: 'draft',
        customer_user_id: customer.user.id,
        customer_email: customer.email,
        product_id: product.id,
        company_id: company.id,
        offer_id: offer.id,
        submitted_at: null,
        consents_completed_at: null,
        identity_hold_reason: null,
        identity_hold_at: null,
      }),
    );
    expect(res.body.customer_snapshot).toEqual(
      expect.objectContaining({
        full_name: 'Asha Verma',
        firstName: 'Asha',
        lastName: 'Verma',
        qid: QID.expat,
        residency: 'expat',
        nationality: 'India',
        dateOfBirth: '1990-04-12',
        monthlyIncome: 18000,
        monthlyLiabilities: 1500,
        hasGuarantor: false,
        applicantType: 'individual',
      }),
    );
    expect(res.body.customer_snapshot.employment).toEqual(
      expect.objectContaining({ employmentType: 'private-local', salary: 18000 }),
    );
    // Car financing is uncapped, so a compliant plan records no review flags.
    expect(res.body.pricing_snapshot).toEqual(
      expect.objectContaining({ list_price: 100000, down_payment_pct: 20, tenor: 36 }),
    );
    expect(res.body.pricing_snapshot.rule_flags).toBeUndefined();

    const user = await ctx.prisma.user.findUniqueOrThrow({ where: { id: customer.user.id } });
    expect(user).toEqual(
      expect.objectContaining({
        firstName: 'Asha',
        lastName: 'Verma',
        gender: 'female',
        nationality: 'India',
        phone: '+97455512345',
      }),
    );
    expect(user.dateOfBirth?.toISOString().slice(0, 10)).toBe('1990-04-12');
    expect(user.qidHash).toBeTruthy();
    const app = await ctx.prisma.application.findUniqueOrThrow({ where: { id: res.body.id } });
    expect(app.qidHash).toBe(user.qidHash);
    expect(app.leadSource).toBeNull();

    const mine = await authed(customer.agent).get('/api/v1/applications/mine');
    expect(mine.status).toBe(200);
    expect(mine.body.total).toBe(1);
    expect(mine.body.items[0]).toEqual(expect.objectContaining({ id: res.body.id, status: 'draft' }));
  });

  it('keeps a soft product-rule breach as a review flag on the draft (motorcycle over its cap)', async () => {
    // Motorcycles are the only variant with a financing ceiling (QAR 15,000).
    // A 40,000 bike at 20% down finances 32,000, which is recorded for the
    // credit officer rather than refused.
    const company = await seedCompany(ctx.prisma, 'Intake Motorcycles');
    const offer = await seedOffer(ctx.prisma, company.id);
    const product = await seedProduct(ctx.prisma, {
      companyId: company.id,
      offerId: offer.id,
      price: 40_000,
      attributes: { vehicleType: 'motorcycle' },
      make: 'Honda',
      model: 'CB500',
    });
    const customer = await customerUser(ctx, 'intake-motorcycle', 'Asha Verma');

    const res = await createCustomerDraft(customer.agent, { product, offer });

    expect(res.status).toBe(201);
    expect(res.body.pricing_snapshot.rule_flags).toEqual([
      { code: 'financing_amount_exceeds_cap', params: { cap: 15000, financed: 32000, variant: 'motorcycle' } },
    ]);
  });

  it('resumes the draft for the same vehicle, allows a draft on another vehicle, and /applications/blocking is truthful', async () => {
    const { company, offer, product } = await showroom();
    const customer = await customerUser(ctx, 'intake-resume');

    const first = await createCustomerDraft(customer.agent, { product, offer });
    expect(first.status).toBe(201);
    const draftId = first.body.id as string;

    const again = await createCustomerDraft(customer.agent, { product, offer });
    expect(again.status).toBe(200);
    expect(again.body).toEqual({ id: draftId, resumed: true });
    expect(await ctx.prisma.application.count({ where: { customerUserId: customer.user.id } })).toBe(1);

    const blocking = await authed(customer.agent).get(`/api/v1/applications/blocking?productId=${product.id}`);
    expect(blocking.status).toBe(200);
    expect(blocking.body).toEqual({ blocking: false, application_id: null, status: null, draft_application_id: draftId });

    const other = await seedProduct(ctx.prisma, { companyId: company.id, offerId: offer.id, model: 'Corolla', price: 80000 });
    const second = await createCustomerDraft(customer.agent, { product: other, offer });
    expect(second.status).toBe(201);
    expect(second.body.id).not.toBe(draftId);
    expect(await ctx.prisma.application.count({ where: { customerUserId: customer.user.id, status: 'draft' } })).toBe(2);

    const scoped = await authed(customer.agent).get(`/api/v1/applications/blocking?productId=${other.id}`);
    expect(scoped.body.draft_application_id).toBe(second.body.id);
    const newest = await authed(customer.agent).get('/api/v1/applications/blocking');
    expect(newest.body).toEqual({ blocking: false, application_id: null, status: null, draft_application_id: second.body.id });
  });

  it('refuses a date of birth that disagrees with the QID, plans outside the product rules and malformed snapshots', async () => {
    const { company, offer, product } = await showroom();
    const customer = await customerUser(ctx, 'intake-rules');

    const dob = await createCustomerDraft(customer.agent, {
      product,
      offer,
      snapshot: customerSnapshotFixture({ dateOfBirth: '1991-04-12' }),
    });
    expectApiError(dob, 400, 'dob_qid_mismatch');

    // Tenure and down payment are flexible: an unusual plan is accepted and the
    // departure is recorded for the credit officer instead of refusing it.
    const lowDown = await createCustomerDraft(customer.agent, { product, offer, pricing: { downPaymentPct: 10 } });
    expect(lowDown.status).toBe(201);
    expect(lowDown.body.pricing_snapshot.rule_flags).toEqual([
      { code: 'down_payment_below_recommended', params: { min: 15, condition: 'used' } },
    ]);
    expect(lowDown.body.pricing_snapshot.down_payment_pct).toBe(10);
    await ctx.prisma.application.delete({ where: { id: lowDown.body.id } });

    const oddTenure = await createCustomerDraft(customer.agent, { product, offer, pricing: { tenureMonths: 18 } });
    expect(oddTenure.status).toBe(201);
    expect(oddTenure.body.pricing_snapshot.tenor).toBe(18);
    expect((oddTenure.body.pricing_snapshot.rule_flags as Array<{ code: string }>).map((v) => v.code)).toContain(
      'tenure_not_offered',
    );
    await ctx.prisma.application.delete({ where: { id: oddTenure.body.id } });

    // 60 months for an expatriate is over the guideline, so it is flagged, not refused.
    const longTenure = await createCustomerDraft(customer.agent, { product, offer, pricing: { tenureMonths: 60 } });
    expect(longTenure.status).toBe(201);
    expect((longTenure.body.pricing_snapshot.rule_flags as Array<{ code: string }>).map((v) => v.code)).toContain(
      'tenure_above_recommended',
    );
    await ctx.prisma.application.delete({ where: { id: longTenure.body.id } });

    // The band itself still holds: 72 months is outside 3–60 and is refused
    // by the pricing guard before the rule set is even consulted.
    const tooLong = await createCustomerDraft(customer.agent, { product, offer, pricing: { tenureMonths: 72 } });
    expectApiError(tooLong, 400, 'invalid_tenure');

    const qatari = await createCustomerDraft(customer.agent, {
      product,
      offer,
      snapshot: customerSnapshotFixture({ qid: QID.qatari, dateOfBirth: '1985-06-30', residenceDuration: undefined }),
      pricing: { tenureMonths: 60 },
    });
    expect(qatari.status).toBe(201);
    expect(qatari.body.customer_snapshot).toEqual(expect.objectContaining({ residency: 'qatari', nationality: 'Qatar' }));
    await ctx.prisma.application.delete({ where: { id: qatari.body.id } });

    const badQid = await createCustomerDraft(customer.agent, { product, offer, snapshot: customerSnapshotFixture({ qid: '1234' }) });
    expectApiError(badQid, 400, 'validation_failed');

    const unknownField = await createCustomerDraft(customer.agent, {
      product,
      offer,
      snapshot: customerSnapshotFixture({ nickname: 'Ash' }),
    });
    expectApiError(unknownField, 400, 'validation_failed');

    const missingContact = await createCustomerDraft(customer.agent, {
      product,
      offer,
      snapshot: customerSnapshotFixture({ phone: undefined }),
    });
    expectApiError(missingContact, 400, 'validation_failed');

    const unpublished = await seedProduct(ctx.prisma, { companyId: company.id, offerId: offer.id });
    await ctx.prisma.product.update({ where: { id: unpublished.id }, data: { listingStatus: 'draft' } });
    expectApiError(await createCustomerDraft(customer.agent, { product: unpublished, offer }), 400, 'listing_not_available');

    expect(await ctx.prisma.application.count({ where: { customerUserId: customer.user.id } })).toBe(0);
  });

  it('walks the submit gates in order: identity hold → consents → documents → vehicle identity → under_review with the default lender', async () => {
    const { company, offer, credit } = await showroom();
    const firstCar = await seedProduct(ctx.prisma, { companyId: company.id, offerId: offer.id, vehicleIdentity: false });
    const secondCar = await seedProduct(ctx.prisma, { companyId: company.id, offerId: offer.id, vehicleIdentity: false, model: 'Land Cruiser' });
    const lender = await seedFinancePartner(ctx.prisma, { code: 'qib', name: 'Qatar Islamic Bank', isDefaultLender: true });

    // Asha applies first; Bilal then applies with Asha's Qatar ID.
    const asha = await customerUser(ctx, 'gates-asha', 'Asha Verma');
    const ashaDraft = await createCustomerDraft(asha.agent, { product: firstCar, offer });
    expect(ashaDraft.status).toBe(201);
    expect(ashaDraft.body.identity_hold_reason).toBeNull();

    const bilal = await customerUser(ctx, 'gates-bilal', 'Bilal Rahman');
    const draft = await createCustomerDraft(bilal.agent, {
      product: secondCar,
      offer,
      snapshot: customerSnapshotFixture({ full_name: 'Bilal Rahman', firstName: 'Bilal', lastName: 'Rahman', gender: 'male' }),
    });
    expect(draft.status).toBe(201);
    const applicationId = draft.body.id as string;
    expect(draft.body.identity_hold_reason).toBe('qid_identity_mismatch');
    expect(draft.body.identity_hold_at).toBeTruthy();
    expect(draft.body.identity_hold_cleared_at).toBeNull();

    const holdLog = await ctx.prisma.activityLog.findFirst({
      where: { entityType: 'application', entityId: applicationId, action: 'identity_hold' },
    });
    expect(holdLog?.toValue).toBe('qid_identity_mismatch');
    expect((holdLog?.metadata as { conflicts: unknown[] }).conflicts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ user_id: asha.user.id, name_mismatch: true, birth_year_mismatch: false }),
      ]),
    );
    const holdNotice = await ctx.prisma.notification.findFirst({
      where: { userId: credit.user.id, title: 'Identity hold on an application' },
    });
    expect(holdNotice?.linkPath).toBe(`/applications/${applicationId}`);

    // 1. identity hold
    expectApiError(await submit(bilal, applicationId), 409, 'identity_hold');

    expectApiError(
      await authed(bilal.agent).post(`/api/v1/ops/applications/${applicationId}/identity-hold/clear`).send({ note: 'x' }),
      403,
      'forbidden_role',
    );
    const cleared = await authed(credit.agent)
      .post(`/api/v1/ops/applications/${applicationId}/identity-hold/clear`)
      .send({ note: 'Same person — Asha registered Bilal by mistake; verified by phone.' });
    expect(cleared.status).toBe(200);
    expect(cleared.body.identity_hold_cleared_at).toBeTruthy();
    expect(cleared.body.identity_hold_reason).toBe('qid_identity_mismatch');
    const clearLog = await ctx.prisma.activityLog.findFirst({
      where: { entityType: 'application', entityId: applicationId, action: 'identity_hold_cleared' },
    });
    expect(clearLog?.actorUserId).toBe(credit.user.id);
    expect((clearLog?.metadata as { note: string }).note).toContain('verified by phone');
    expectApiError(
      await authed(credit.agent).post(`/api/v1/ops/applications/${applicationId}/identity-hold/clear`).send({}),
      400,
      'no_identity_hold',
    );

    // 2. consents
    expectApiError(await submit(bilal, applicationId), 409, 'consents_required');
    expect((await acceptConsents(bilal.agent, { applicationId })).body.complete).toBe(true);

    // 3. documents (expatriate, privately employed: QID, passport, salary certificate, bank statements)
    const missing = expectApiError(await submit(bilal, applicationId), 409, 'documents_missing');
    expect(missing?.missing).toEqual(EXPAT_PRIVATE_REQUIRED);

    const emptySlots = await slotsOf(bilal, applicationId);
    expect(emptySlots.uploaded).toEqual([]);
    expect(emptySlots.missing).toEqual(EXPAT_PRIVATE_REQUIRED);
    expect(emptySlots.slots.map((s) => s.category)).toEqual([
      'qid',
      'passport',
      'license',
      'residence_proof',
      'salary',
      'bank',
      'employment_contract',
      'credit_bureau',
      'vehicle_quotation',
      'other',
    ]);
    expect(emptySlots.slots.find((s) => s.category === 'passport')).toEqual(
      expect.objectContaining({ required: true, group: 'identity', labelKey: 'applyFlow.docs.passport' }),
    );
    expect(emptySlots.slots.find((s) => s.category === 'salary')).toEqual(
      expect.objectContaining({ required: true, group: 'income', maxAgeDays: 30 }),
    );
    expect(emptySlots.slots.find((s) => s.category === 'license')?.required).toBe(false);

    // Identity is closed by the KYC platform's verified capture (BRD e-KYC BR-3);
    // the passport is a hand upload like the income documents.
    await seedVerifiedEkycIdentity(ctx.prisma, applicationId);
    expect((await uploadApplicationDocument(bilal.agent, applicationId, 'passport')).status).toBe(201);
    const halfway = await slotsOf(bilal, applicationId);
    expect(halfway.uploaded).toEqual(['passport', 'qid']);
    expect(halfway.missing).toEqual(['salary', 'bank']);
    const stillMissing = expectApiError(await submit(bilal, applicationId), 409, 'documents_missing');
    expect(stillMissing?.missing).toEqual(['salary', 'bank']);

    for (const category of ['salary', 'bank']) {
      expect((await uploadApplicationDocument(bilal.agent, applicationId, category)).status).toBe(201);
    }
    expect((await slotsOf(bilal, applicationId)).missing).toEqual([]);

    // Staff see the same checklist.
    const opsSlots = await authed(credit.agent).get(`/api/v1/ops/applications/${applicationId}/document-slots`);
    expect(opsSlots.status).toBe(200);
    expect(opsSlots.body.uploaded).toEqual(['bank', 'passport', 'qid', 'salary']);

    // 4. submitted: reserved listing, default lender of record, ops notified
    const submitted = await submit(bilal, applicationId);
    expect(submitted.status).toBe(200);
    expect(submitted.body).toEqual(
      expect.objectContaining({ id: applicationId, status: 'under_review', finance_partner_id: lender.id }),
    );
    expect(submitted.body.submitted_at).toBeTruthy();

    const reserved = await ctx.prisma.product.findUniqueOrThrow({ where: { id: secondCar.id } });
    expect(reserved.listingStatus).toBe('reserved');
    const detail = await authed(bilal.agent).get(`/api/v1/applications/${applicationId}`);
    expect(detail.body).toEqual(
      expect.objectContaining({ status: 'under_review', finance_partner_name: 'Qatar Islamic Bank', financing_source: 'blox' }),
    );

    const logs = await ctx.prisma.activityLog.findMany({
      where: { entityType: 'application', entityId: applicationId },
      orderBy: { createdAt: 'asc' },
    });
    expect(logs.find((l) => l.action === 'status_transition')).toEqual(
      expect.objectContaining({ fromValue: 'draft', toValue: 'under_review', actorUserId: bilal.user.id }),
    );
    expect(logs.find((l) => l.action === 'lender_tagged')).toEqual(
      expect.objectContaining({ toValue: lender.id, metadata: { source: 'default_lender' } }),
    );
    const newLead = await ctx.prisma.notification.findFirst({
      where: { userId: credit.user.id, title: 'New financing application' },
    });
    expect(newLead?.linkPath).toBe(`/applications/${applicationId}`);

    // Submitting twice is not a transition.
    expectApiError(await submit(bilal, applicationId), 400, 'invalid_status_transition');
  });

  /**
   * BRD Qatar e-KYC BR-3/FR-3. `KYC_EKYC_REQUIRED` defaults to on whenever the
   * KYC platform is configured, and then identity must come from that platform
   * (OCR + liveness + face match). A QID photo the customer uploads themselves
   * is filed but does not close the slot.
   */
  it('e-KYC: a customer QID upload never satisfies identity; only the verified KYC capture does', async () => {
    const { customer, applicationId } = await readyDraft('intake-ekyc', { ekyc: false });

    const manual = await slotsOf(customer, applicationId);
    expect(manual.uploaded).toEqual(['bank', 'passport', 'salary']);
    expect(manual.missing).toEqual(['qid']);
    // The file is on record — the slot shows its upload time — it just does not
    // close the requirement, so the portal cannot show identity as done.
    expect(manual.slots.find((s) => s.category === 'qid')?.uploaded_at).toBeTruthy();
    expect(expectApiError(await submit(customer, applicationId), 409, 'documents_missing')).toEqual({
      missing: ['qid'],
    });

    // A capture the platform is still processing does not count either.
    await seedVerifiedEkycIdentity(ctx.prisma, applicationId, { verificationStatus: 'processing' });
    expect((await slotsOf(customer, applicationId)).missing).toEqual(['qid']);
    expectApiError(await submit(customer, applicationId), 409, 'documents_missing');

    // Verified `qid_front` / `qid_back` rows open the gate.
    await ctx.prisma.applicationDocument.updateMany({
      where: { applicationId, kycDocumentType: { in: ['qid_front', 'qid_back'] } },
      data: { verificationStatus: 'verified' },
    });
    const verified = await slotsOf(customer, applicationId);
    expect(verified.uploaded).toEqual(['bank', 'passport', 'qid', 'salary']);
    expect(verified.missing).toEqual([]);
    const submitted = await submit(customer, applicationId);
    expect(submitted.status).toBe(200);
    expect(submitted.body.status).toBe('under_review');
  });

  it('e-KYC: a QID attached by staff still counts (face-to-face branch procedure)', async () => {
    const { customer, applicationId, credit } = await readyDraft('intake-ekyc-staff', { ekyc: false });
    expect((await slotsOf(customer, applicationId)).missing).toEqual(['qid']);

    // KYC_ALLOW_STAFF_MANUAL_IDENTITY is on by default: the officer inspected
    // the original card, so their upload attests identity where the customer's
    // own photo could not.
    const staffUpload = await authed(credit.agent)
      .post(`/api/v1/ops/applications/${applicationId}/documents`)
      .field('category', 'qid')
      .attach('file', Buffer.from('%PDF-1.4 branch qid'), { filename: 'qid.pdf', contentType: 'application/pdf' });
    expect(staffUpload.status).toBeLessThan(300);

    expect((await slotsOf(customer, applicationId)).missing).toEqual([]);
    const submitted = await submit(customer, applicationId);
    expect(submitted.status).toBe(200);
    expect(submitted.body.status).toBe('under_review');
  });

  it('blocks a new application while one is in flight', async () => {
    const { company, offer, product } = await showroom();
    const customer = await customerUser(ctx, 'intake-blocked');
    const inFlight = await seedUnderReviewApplication(ctx.prisma, { customer: customer.user, company, product, offer });

    const other = await seedProduct(ctx.prisma, { companyId: company.id, offerId: offer.id });
    const attempt = await createCustomerDraft(customer.agent, { product: other, offer });
    expect(expectApiError(attempt, 409, 'blocking_application')).toEqual({ application_id: inFlight.id });
    expect(await ctx.prisma.application.count({ where: { customerUserId: customer.user.id } })).toBe(1);

    const blocking = await authed(customer.agent).get('/api/v1/applications/blocking');
    expect(blocking.body).toEqual({
      blocking: true,
      application_id: inFlight.id,
      status: 'under_review',
      draft_application_id: null,
    });

    // Cancelling frees the customer to apply again.
    const cancel = await authed(customer.agent).post(`/api/v1/applications/${inFlight.id}/cancel`).send({ reason: 'Changed my mind' });
    expect(cancel.status).toBe(200);
    expect(cancel.body.status).toBe('submission_cancelled');
    const retry = await createCustomerDraft(customer.agent, { product: other, offer });
    expect(retry.status).toBe(201);
  });

  it('vehicle_age_rule stops a submit when the listing would be too old at tenure end', async () => {
    const { customer, applicationId, product } = await readyDraft('intake-age');
    // The dealer corrects the listing after the draft was priced.
    await ctx.prisma.product.update({ where: { id: product.id }, data: { modelYear: 2014 } });

    const details = expectApiError(await submit(customer, applicationId), 409, 'vehicle_age_rule');
    expect(details?.max_years_at_tenure_end).toBe(10);
    expect(details?.age_at_tenure_end).toBeGreaterThan(10);
    const row = await ctx.prisma.application.findUniqueOrThrow({ where: { id: applicationId } });
    expect(row.status).toBe('draft');
  });

  /**
   * The stepper keeps the whole form in state and sends it back on every save,
   * so the snapshot here is the complete one with the edited fields on top.
   * `merges a partial customerSnapshot` below covers the partial send, which is
   * broken server-side.
   */
  it('draft save-and-resume re-validates like create, is owner-only and stops once submitted', async () => {
    const { offer, product } = await showroom();
    const customer = await customerUser(ctx, 'intake-patch', 'Asha Verma');
    const draft = await createCustomerDraft(customer.agent, { product, offer });
    expect(draft.status).toBe(201);
    const applicationId = draft.body.id as string;
    const base = `/api/v1/applications/${applicationId}/draft`;

    const patched = await authed(customer.agent)
      .patch(base)
      .send({
        customerSnapshot: customerSnapshotFixture({
          monthlyLiabilities: 2500,
          hasGuarantor: true,
          guarantor: { fullName: 'Rahul Verma', qid: QID.expatAlt, phone: '+97455598765', relationship: 'sibling', monthlyIncome: 12000 },
        }),
        pricingSnapshot: { down_payment_pct: 25 },
      });
    expect(patched.status).toBe(200);
    expect(patched.body.customer_snapshot).toEqual(
      expect.objectContaining({
        full_name: 'Asha Verma',
        monthlyIncome: 18000,
        monthlyLiabilities: 2500,
        hasGuarantor: true,
        residency: 'expat',
      }),
    );
    expect(patched.body.customer_snapshot.guarantor).toEqual(
      expect.objectContaining({ fullName: 'Rahul Verma', qid: QID.expatAlt, relationship: 'sibling', monthlyIncome: 12000 }),
    );
    expect(patched.body.pricing_snapshot).toEqual(expect.objectContaining({ down_payment_pct: 25, tenor: 36, list_price: 100000 }));
    expect(patched.body.pricing_snapshot.down_payment).toBe(25000);

    // A guarantor adds their own document slots.
    const slots = await slotsOf(customer, applicationId);
    expect(slots.slots.filter((s) => s.group === 'guarantor').map((s) => [s.category, s.required])).toEqual([
      ['guarantor_qid', true],
      ['guarantor_salary', true],
      ['guarantor_bank', false],
    ]);
    expect(slots.missing).toEqual([...EXPAT_PRIVATE_REQUIRED, 'guarantor_qid', 'guarantor_salary']);

    expectApiError(
      await authed(customer.agent)
        .patch(base)
        .send({ customerSnapshot: customerSnapshotFixture({ dateOfBirth: '1992-01-01' }) }),
      400,
      'dob_qid_mismatch',
    );
    expectApiError(
      await authed(customer.agent).patch(base).send({ pricingSnapshot: { tenor: 72 } }),
      400,
      'invalid_tenure',
    );
    expectApiError(await authed(customer.agent).patch(base).send({ customerSnapshot: { nickname: 'x' } }), 400, 'validation_failed');

    const stranger = await customerUser(ctx, 'intake-patch-stranger');
    expectApiError(await authed(stranger.agent).patch(base).send({ customerSnapshot: { city: 'Wakra' } }), 403, 'forbidden_role');

    const unchanged = await ctx.prisma.application.findUniqueOrThrow({ where: { id: applicationId } });
    expect((unchanged.customerSnapshot as { monthlyLiabilities: number }).monthlyLiabilities).toBe(2500);
    expect((unchanged.pricingSnapshot as { down_payment_pct: number }).down_payment_pct).toBe(25);

    await ctx.prisma.application.update({ where: { id: applicationId }, data: { status: 'under_review', submittedAt: new Date() } });
    expectApiError(
      await authed(customer.agent).patch(base).send({ customerSnapshot: { city: 'Wakra' } }),
      400,
      'invalid_status_transition',
    );
  });
  // (packages/api/src/applications/applications.service.ts, the
  // `normalizeCustomerSnapshot({ ...currentSnapshot, ...body.customerSnapshot })`
  // before the service's own contact check), and when the contact fields are
  it('draft save-and-resume merges a partial customerSnapshot into the stored one', async () => {
    const { offer, product } = await showroom();
    const customer = await customerUser(ctx, 'intake-patch-partial', 'Asha Verma');
    const draft = await createCustomerDraft(customer.agent, { product, offer });
    expect(draft.status).toBe(201);
    const base = `/api/v1/applications/${draft.body.id}/draft`;

    const patched = await authed(customer.agent).patch(base).send({ customerSnapshot: { monthlyLiabilities: 2500 } });
    expect(patched.status).toBe(200);
    expect(patched.body.customer_snapshot).toEqual(
      expect.objectContaining({
        full_name: 'Asha Verma',
        city: 'Doha',
        monthlyIncome: 18000,
        monthlyLiabilities: 2500,
      }),
    );
    expect(patched.body.customer_snapshot.employment).toEqual(
      expect.objectContaining({ company: 'Gulf Logistics WLL', salary: 18000 }),
    );
  });

  it('masks identity fields for ops and dealers; unmask is audited and customers cannot use it', async () => {
    const { company, offer, product, credit } = await showroom();
    const customer = await customerUser(ctx, 'intake-mask', 'Asha Verma');
    const draft = await createCustomerDraft(customer.agent, {
      product,
      offer,
      snapshot: customerSnapshotFixture({
        hasGuarantor: true,
        guarantor: { fullName: 'Rahul Verma', qid: QID.expatAlt, phone: '+97455598765', relationship: 'sibling' },
      }),
    });
    expect(draft.status).toBe(201);
    const applicationId = draft.body.id as string;
    expect(draft.body.customer_snapshot.qid).toBe(QID.expat);

    const ops = await authed(credit.agent).get(`/api/v1/applications/${applicationId}`);
    expect(ops.status).toBe(200);
    expect(ops.body.customer_snapshot).toEqual(
      expect.objectContaining({ qid: 'XXXXXXX2345', phone: '+974 XXXX X345', full_name: 'Asha Verma' }),
    );
    expect(ops.body.customer_snapshot.guarantor).toEqual(expect.objectContaining({ qid: 'XXXXXXX2346', phone: '+974 XXXX X765' }));
    expect(ops.body.customer.phone).toBe('+974 XXXX X345');
    expect(JSON.stringify(ops.body.customer_snapshot)).not.toContain(QID.expat);

    const dealer = await staffUser(ctx, 'intake-mask-dealer', 'dealer_agent', { companyId: company.id });
    const dealerView = await authed(dealer.agent).get(`/api/v1/applications/${applicationId}`);
    expect(dealerView.status).toBe(200);
    expect(dealerView.body.customer_snapshot).toEqual(expect.objectContaining({ qid: 'XXXXXXX2345', phone: '+97455512345' }));

    const unmask = await authed(dealer.agent)
      .post(`/api/v1/ops/applications/${applicationId}/unmask`)
      .send({ field: 'qid', reason: 'Verifying the ID against the physical card at the showroom' });
    expect(unmask.status).toBe(200);
    expect(unmask.body).toEqual({ field: 'qid', value: QID.expat });
    const audit = await ctx.prisma.activityLog.findFirst({
      where: { entityType: 'application', entityId: applicationId, action: 'pii_unmask' },
    });
    expect(audit?.actorUserId).toBe(dealer.user.id);
    expect(audit?.metadata).toEqual({ field: 'qid', reason: 'Verifying the ID against the physical card at the showroom' });

    expectApiError(
      await authed(dealer.agent).post(`/api/v1/ops/applications/${applicationId}/unmask`).send({ field: 'qid', reason: 'x' }),
      400,
      'validation_failed',
    );
    expectApiError(
      await authed(customer.agent).post(`/api/v1/ops/applications/${applicationId}/unmask`).send({ field: 'qid', reason: 'curious' }),
      403,
      'forbidden_role',
    );
    const otherCompany = await seedCompany(ctx.prisma, 'Rival Motors');
    const rival = await staffUser(ctx, 'intake-mask-rival', 'dealer_agent', { companyId: otherCompany.id });
    expectApiError(
      await authed(rival.agent).post(`/api/v1/ops/applications/${applicationId}/unmask`).send({ field: 'phone', reason: 'poaching' }),
      403,
      'forbidden_role',
    );
  });

  describe('wave 2 gates', () => {
    it('documents_stale: a salary certificate older than 30 days blocks submit and is reported on the slots', async () => {
      const { customer, applicationId } = await readyDraft('intake-stale', { documents: ['qid', 'passport', 'bank'] });
      await seedApplicationDocument(ctx.prisma, {
        applicationId,
        category: 'salary',
        uploadedById: customer.user.id,
        createdAt: daysAgo(45),
      });

      const slots = await slotsOf(customer, applicationId);
      expect(slots.missing).toEqual([]);
      expect(slots.stale).toEqual(['salary']);
      const salarySlot = slots.slots.find((s) => s.category === 'salary');
      expect(salarySlot?.uploaded_at).toBeTruthy();
      expect(Date.now() - new Date(salarySlot!.uploaded_at as string).getTime()).toBeGreaterThan(44 * 86_400_000);
      expect(slots.slots.find((s) => s.category === 'bank')?.uploaded_at).toBeTruthy();
      expect(slots.slots.find((s) => s.category === 'license')?.uploaded_at ?? null).toBeNull();

      const stale = expectApiError(await submit(customer, applicationId), 409, 'documents_stale');
      expect(stale?.stale).toEqual(['salary']);

      // A fresh certificate is the newest upload for the slot, so the gate opens.
      expect((await uploadApplicationDocument(customer.agent, applicationId, 'salary')).status).toBe(201);
      expect((await slotsOf(customer, applicationId)).stale).toEqual([]);
      const submitted = await submit(customer, applicationId);
      expect(submitted.status).toBe(200);
      expect(submitted.body.status).toBe('under_review');
    });

    it('guarantor_consent_required: the guarantor must finish their consent session before submit', async () => {
      const { customer, applicationId } = await readyDraft('intake-guarantor', {
        snapshot: customerSnapshotFixture({
          hasGuarantor: true,
          guarantor: { fullName: 'Rahul Verma', qid: QID.expatAlt, phone: '+97455598765', relationship: 'sibling', monthlyIncome: 12000 },
        }),
        documents: [...EXPAT_PRIVATE_REQUIRED, 'guarantor_qid', 'guarantor_salary'],
      });
      expect((await slotsOf(customer, applicationId)).missing).toEqual([]);

      expectApiError(await submit(customer, applicationId), 409, 'guarantor_consent_required');

      // An open session that never finished does not count.
      const pending = await ctx.prisma.guarantorConsentSession.create({
        data: {
          token: randomUUID(),
          applicationId,
          fullName: 'Rahul Verma',
          phone: '+97455598765',
          relationship: 'sibling',
          status: 'otp_verified',
          expiresAt: new Date(Date.now() + 3_600_000),
        },
      });
      expectApiError(await submit(customer, applicationId), 409, 'guarantor_consent_required');

      await ctx.prisma.guarantorConsentSession.update({
        where: { id: pending.id },
        data: {
          status: 'consents_done',
          consentsCompletedAt: new Date(),
          acceptances: [{ code: 'credit_bureau', version: '2026-09-v1', textHash: 'x', locale: 'en', acceptedAt: new Date().toISOString() }],
        },
      });
      const submitted = await submit(customer, applicationId);
      expect(submitted.status).toBe(200);
      expect(submitted.body.status).toBe('under_review');
    });

    it('ops detail names who cleared an identity hold', async () => {
      const { company, offer, product: car } = await showroom();
      const asha = await customerUser(ctx, 'cleared-asha', 'Asha Verma');
      expect((await createCustomerDraft(asha.agent, { product: car, offer })).status).toBe(201);
      const bilal = await customerUser(ctx, 'cleared-bilal', 'Bilal Rahman');
      const secondCar = await seedProduct(ctx.prisma, { companyId: company.id, offerId: offer.id });
      const draft = await createCustomerDraft(bilal.agent, {
        product: secondCar,
        offer,
        snapshot: customerSnapshotFixture({ full_name: 'Bilal Rahman', firstName: 'Bilal', lastName: 'Rahman' }),
      });
      expect(draft.body.identity_hold_reason).toBe('qid_identity_mismatch');

      const admin = await staffUser(ctx, 'cleared-admin', 'admin', {}, 'Amina Admin');
      const cleared = await authed(admin.agent)
        .post(`/api/v1/ops/applications/${draft.body.id}/identity-hold/clear`)
        .send({ note: 'Verified at the branch' });
      expect(cleared.status).toBe(200);
      expect(cleared.body.identity_hold_cleared_by_name).toBe('Amina Admin');

      const detail = await authed(admin.agent).get(`/api/v1/applications/${draft.body.id}`);
      expect(detail.body.identity_hold_cleared_by_name).toBe('Amina Admin');
      const own = await authed(bilal.agent).get(`/api/v1/applications/${draft.body.id}`);
      expect(own.body.identity_hold_cleared_at).toBeTruthy();
    });
  });
});
