import { describe, expect, it } from 'vitest';
import type { PartnerApplicationDto } from '../types/customer-platform';
import {
  filterPartnerApplications,
  normalizePartnerList,
  normalizePartnerSummary,
  partnerListPath,
  partnerStatusesFor,
  partnerSummaryCount,
} from './partner-view';

function app(overrides: Partial<PartnerApplicationDto>): PartnerApplicationDto {
  return {
    id: 'app-1',
    status: 'under_review',
    submitted_at: '2026-09-01T00:00:00.000Z',
    updated_at: '2026-09-02T00:00:00.000Z',
    company_name: 'Doha Motors',
    branch_name: null,
    vehicle: { make: 'Toyota', model: 'Land Cruiser', model_year: 2026, price: 250_000 },
    customer: { name: 'Ahmed Al-Thani', qid_masked: 'XXXXXXX8901', nationality: 'Qatar', residency: 'qatari' },
    financing: { financed_amount: 200_000, tenure_months: 48, monthly: 4800, down_payment_pct: 20 },
    credit_assessment: null,
    consents_completed_at: null,
    documents: [],
    ...overrides,
  };
}

describe('partner list request', () => {
  it('builds the status filter as a comma list and pages with limit/offset', () => {
    expect(partnerListPath({ tab: 'all', page: 0, pageSize: 25 })).toBe('/api/partner/applications?limit=25&offset=0');
    expect(partnerListPath({ tab: 'review', page: 2, pageSize: 25 })).toBe(
      '/api/partner/applications?status=under_review%2Cresubmission_required&limit=25&offset=50',
    );
    expect(partnerStatusesFor('unknown')).toEqual([]);
  });

  it('accepts a bare array or a paginated envelope', () => {
    const row = app({});
    expect(normalizePartnerList([row])).toEqual({ items: [row], total: 1 });
    expect(normalizePartnerList({ items: [row], total: 40 })).toEqual({ items: [row], total: 40 });
    expect(normalizePartnerList(undefined)).toEqual({ items: [], total: 0 });
  });
});

describe('partner summary', () => {
  it('reads counts from every shape the endpoint might use', () => {
    expect(normalizePartnerSummary({ by_status: { under_review: 2, active: 3 }, total: 5 })).toEqual({
      by_status: { under_review: 2, active: 3 },
      total: 5,
    });
    expect(normalizePartnerSummary({ counts: { active: 1 } }).total).toBe(1);
    expect(normalizePartnerSummary({ items: [{ status: 'active', count: 4 }] }).by_status).toEqual({ active: 4 });
    expect(normalizePartnerSummary({ under_review: 1, completed: 2 })).toEqual({
      by_status: { under_review: 1, completed: 2 },
      total: 3,
    });
    expect(normalizePartnerSummary(null)).toEqual({ by_status: {}, total: 0 });
  });

  it('sums the statuses behind a tab', () => {
    const summary = normalizePartnerSummary({ by_status: { under_review: 2, resubmission_required: 1, active: 3 } });
    expect(partnerSummaryCount(summary, partnerStatusesFor('review'))).toBe(3);
    expect(partnerSummaryCount(summary, partnerStatusesFor('active'))).toBe(3);
  });
});

describe('client-side partner search', () => {
  it('matches name, masked QID, vehicle and dealer', () => {
    const rows = [app({}), app({ id: 'app-2', customer: { name: 'Sara', qid_masked: 'XXXXXXX1234', nationality: null, residency: 'expat' } })];
    expect(filterPartnerApplications(rows, 'thani').map((r) => r.id)).toEqual(['app-1']);
    expect(filterPartnerApplications(rows, '1234').map((r) => r.id)).toEqual(['app-2']);
    expect(filterPartnerApplications(rows, 'land').length).toBe(2);
    expect(filterPartnerApplications(rows, '  ').length).toBe(2);
  });
});
