import { describe, expect, it } from 'vitest';
import { ApplicationStatus, DocumentCategory } from '@prisma/client';
import {
  approverFor,
  creditAssessmentForRole,
  customerFromSnapshot,
  financingFromPricing,
  isPartnerVisibleDocument,
  normalizeAffordability,
  PARTNER_DOCUMENT_CATEGORIES,
  PARTNER_VISIBLE_STATUSES,
  partnerApplicationWhere,
  partnerSummary,
  toPartnerApplicationDto,
  type PartnerApplicationRow,
} from './partner-logic';

const PARTNER = 'fp_1';

describe('partner scoping', () => {
  it('filters to the viewer\'s own provider and the post-submission statuses', () => {
    expect(PARTNER_VISIBLE_STATUSES).not.toContain('draft');
    expect(PARTNER_VISIBLE_STATUSES).toContain('under_review');
    expect(PARTNER_VISIBLE_STATUSES).toContain('active');
    expect(partnerApplicationWhere(PARTNER)).toEqual({
      financePartnerId: PARTNER,
      status: { in: PARTNER_VISIBLE_STATUSES },
    });
  });

  it('a requested status narrows the filter; an invisible one yields nothing rather than everything', () => {
    expect(partnerApplicationWhere(PARTNER, ApplicationStatus.active)).toEqual({
      financePartnerId: PARTNER,
      status: 'active',
    });
    expect(partnerApplicationWhere(PARTNER, ApplicationStatus.draft)).toEqual({
      financePartnerId: PARTNER,
      status: { in: [] },
    });
  });

  it('exposes identity and income documents only', () => {
    for (const category of [DocumentCategory.qid, DocumentCategory.salary, DocumentCategory.guarantor_bank]) {
      expect(isPartnerVisibleDocument(category)).toBe(true);
    }
    for (const category of [
      DocumentCategory.selfie,
      DocumentCategory.vehicle_quotation,
      DocumentCategory.takaful_policy,
      DocumentCategory.other,
    ]) {
      expect(isPartnerVisibleDocument(category)).toBe(false);
      expect(PARTNER_DOCUMENT_CATEGORIES).not.toContain(category);
    }
  });
});

describe('partner DTO', () => {
  const row: PartnerApplicationRow = {
    id: 'app_1',
    status: ApplicationStatus.under_review,
    submittedAt: new Date('2026-09-06T08:00:00Z'),
    updatedAt: new Date('2026-09-07T08:00:00Z'),
    customerSnapshot: {
      full_name: 'Aisha Al Thani',
      phone: '+97455512345',
      qid: '28863412345',
      email: 'aisha@example.com',
      nationality: 'Qatar',
      residency: 'qatari',
      address: { line1: 'Villa 3' },
    },
    pricingSnapshot: { list_price: 150000, down_payment: 30000, down_payment_pct: 20, tenor: 48, monthly: 2950.5 },
    creditAssessment: {
      affordability: { dbr: 0.42, cap: 0.5, hard_cap: 0.75, status: 'within_cap', exception_tier: 0, max_installment_within_cap: 6000, headroom: 0.08, stressed: { dbr: 0.45, within_limit: true } },
      affordability_with_guarantor: null,
      approval_authority: 'senior_manager',
      path: 'approve',
      reasons: [],
      rule_flags: [{ code: 'financing_cap', severity: 'soft', params: { cap: 50000 } }],
      assessed_at: '2026-09-06T08:00:00.000Z',
      financed_amount: 120000,
      monthly_installment: 2950.5,
      approver: { role_may_approve: true, required_roles: ['credit_officer'], max_tier_for_role: 1 },
    },
    consentsCompletedAt: new Date('2026-09-05T08:00:00Z'),
    company: { name: 'Chery Elite Motors' },
    branch: { name: 'Main Branch' },
    product: { make: 'Chery', model: 'Tiggo 8', modelYear: 2026, price: '150000.00' },
    customer: { name: 'Aisha Al Thani' },
    documents: [
      { id: 'd1', category: DocumentCategory.qid, originalName: 'qid.pdf', createdAt: new Date('2026-09-05T09:00:00Z') },
      { id: 'd2', category: DocumentCategory.selfie, originalName: 'selfie.jpg', createdAt: new Date('2026-09-05T09:00:00Z') },
    ],
  };

  it('masks the QID, omits the phone and address, and keeps only visible documents', () => {
    const dto = toPartnerApplicationDto(row);
    expect(dto.customer).toEqual({ name: 'Aisha Al Thani', qid_masked: 'XXXXXXX2345', nationality: 'Qatar', residency: 'qatari' });
    const json = JSON.stringify(dto);
    expect(json).not.toContain('55512345');
    expect(json).not.toContain('28863412345');
    expect(json).not.toContain('Villa 3');
    expect(json).not.toContain('aisha@example.com');
    expect(dto.documents.map((d) => d.id)).toEqual(['d1']);
    expect(dto.vehicle).toEqual({ make: 'Chery', model: 'Tiggo 8', model_year: 2026, price: 150000 });
    expect(dto.financing).toEqual({ financed_amount: 120000, tenure_months: 48, monthly: 2950.5, down_payment_pct: 20 });
    expect(dto.company_name).toBe('Chery Elite Motors');
    expect(dto.branch_name).toBe('Main Branch');
    expect(dto.submitted_at).toBe('2026-09-06T08:00:00.000Z');
    expect(dto.consents_completed_at).toBe('2026-09-05T08:00:00.000Z');
  });

  it('re-evaluates the approver for the partner viewer, who may never approve', () => {
    const assessment = toPartnerApplicationDto(row).credit_assessment;
    expect(assessment?.approval_authority).toBe('senior_manager');
    expect(assessment?.path).toBe('approve');
    expect(assessment?.affordability?.dbr).toBe(0.42);
    expect(assessment?.rule_flags).toEqual([{ code: 'financing_cap', severity: 'soft', params: { cap: 50000 } }]);
    expect(assessment?.approver).toEqual({
      role_may_approve: false,
      required_roles: ['credit_officer', 'admin', 'super_admin'],
      max_tier_for_role: 0,
    });
    expect(approverFor('admin', 'head_of_credit')).toEqual({
      role_may_approve: true,
      required_roles: ['admin', 'super_admin'],
      max_tier_for_role: 2,
    });
  });

  it('derives residency and nationality from the QID when the snapshot lacks them', () => {
    expect(customerFromSnapshot({ qid: '28863412345' }, 'Fallback Name')).toEqual({
      name: 'Fallback Name',
      qid_masked: 'XXXXXXX2345',
      nationality: 'Qatar',
      residency: 'qatari',
    });
    expect(customerFromSnapshot({ firstName: 'A', lastName: 'B' }, null)).toMatchObject({ name: 'A B', qid_masked: null });
    expect(customerFromSnapshot(null, null)).toEqual({ name: null, qid_masked: null, nationality: null, residency: null });
  });

  it('accepts the raw shared-lib assessment shape and tolerates missing pieces', () => {
    const raw = {
      affordability: { dbr: 0.8, cap: 0.5, hardCap: 0.75, status: 'above_hard_cap', exceptionTier: 3, maxInstallmentWithinCap: 5000, headroom: -0.3, stressed: { dbr: 0.85, withinLimit: false } },
      affordabilityWithGuarantor: { dbr: 0.4, cap: 0.5, hardCap: 0.75, status: 'within_cap', exceptionTier: 0, maxInstallmentWithinCap: 5000, headroom: 0.1, stressed: null },
      approvalAuthority: 'above_matrix',
      path: 'refer',
      reasons: ['within_cap_with_guarantor'],
      ruleFlags: [],
      assessedAt: '2026-09-06T08:00:00.000Z',
    };
    const dto = creditAssessmentForRole(raw, 'partner_viewer');
    expect(dto?.affordability).toEqual({
      dbr: 0.8, cap: 0.5, hard_cap: 0.75, status: 'above_hard_cap', exception_tier: 3, max_installment_within_cap: 5000, headroom: -0.3, stressed: { dbr: 0.85, within_limit: false },
    });
    expect(dto?.affordability_with_guarantor?.status).toBe('within_cap');
    expect(dto?.approval_authority).toBe('above_matrix');
    expect(dto?.approver.required_roles).toEqual(['super_admin']);
    expect(dto?.financed_amount).toBe(0);
    expect(creditAssessmentForRole(null, 'partner_viewer')).toBeNull();
    expect(creditAssessmentForRole({ path: 'approve' }, 'partner_viewer')).toBeNull();
    expect(normalizeAffordability({ dbr: 0.6, cap: 0.5, hard_cap: 0.75 })).toMatchObject({ status: 'exception_tier_1', exception_tier: 1 });
    expect(normalizeAffordability({ dbr: 0.6 })).toBeNull();
  });

  it('computes financing from the pricing snapshot, preferring an explicit financed amount', () => {
    expect(financingFromPricing({ selling_price: 100000, down_payment: 20000, tenure: 36, monthly: 2600, down_payment_pct: 20 })).toEqual({
      financed_amount: 80000, tenure_months: 36, monthly: 2600, down_payment_pct: 20,
    });
    expect(financingFromPricing({ financed_amount: 75000, list_price: 100000, down_payment: 20000 }).financed_amount).toBe(75000);
    expect(financingFromPricing(null)).toEqual({ financed_amount: null, tenure_months: null, monthly: null, down_payment_pct: null });
  });
});

describe('partnerSummary', () => {
  it('counts by visible status with zeros for the rest and ignores drafts', () => {
    const summary = partnerSummary([
      { status: ApplicationStatus.under_review, count: 3 },
      { status: ApplicationStatus.active, count: 2 },
      { status: ApplicationStatus.draft, count: 9 },
    ]);
    expect(summary.total).toBe(5);
    expect(summary.by_status.under_review).toBe(3);
    expect(summary.by_status.active).toBe(2);
    expect(summary.by_status.rejected).toBe(0);
    expect(summary.by_status).not.toHaveProperty('draft');
  });
});
