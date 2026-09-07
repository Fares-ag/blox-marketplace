import { BadRequestException } from '@nestjs/common';
import { ApplicationStatus } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import {
  aggregateOriginationFunnel,
  firstApprovalAt,
  median,
  resolveFunnelBranchId,
  resolveFunnelRange,
  type FunnelApplication,
  type FunnelLabels,
  type FunnelTransition,
} from './origination-funnel';

const d = (iso: string) => new Date(iso);
const from = d('2026-08-01T00:00:00.000Z');
const to = d('2026-08-31T23:59:59.999Z');

const labels: FunnelLabels = {
  companies: new Map([
    ['c1', { name: 'Chery Elite Motors' }],
    ['c2', { name: 'QAuto Audi' }],
  ]),
  branches: new Map([
    ['b1', { name: 'Doha Main', companyId: 'c1' }],
    ['b2', { name: 'Lusail', companyId: 'c2' }],
  ]),
  agents: new Map([
    ['a1', { name: 'Amal', homeBranchId: 'b1' }],
    ['a2', { name: 'Bilal', homeBranchId: null }],
  ]),
};

function app(overrides: Partial<FunnelApplication> & Pick<FunnelApplication, 'id' | 'companyId'>): FunnelApplication {
  return {
    branchId: null,
    agentUserId: null,
    status: ApplicationStatus.draft,
    createdAt: from,
    submittedAt: null,
    activatedAt: null,
    updatedAt: from,
    ...overrides,
  };
}

const applications: FunnelApplication[] = [
  // Approved 10h after submission; branch comes from the agent's home branch.
  app({
    id: 'A',
    companyId: 'c1',
    agentUserId: 'a1',
    status: ApplicationStatus.contract_signing_required,
    createdAt: d('2026-08-02T09:00:00Z'),
    submittedAt: d('2026-08-03T10:00:00Z'),
    updatedAt: d('2026-08-03T20:00:00Z'),
  }),
  // Approved 48h after submission, then activated.
  app({
    id: 'B',
    companyId: 'c1',
    branchId: 'b1',
    agentUserId: 'a1',
    status: ApplicationStatus.active,
    createdAt: d('2026-08-04T09:00:00Z'),
    submittedAt: d('2026-08-05T00:00:00Z'),
    activatedAt: d('2026-08-10T00:00:00Z'),
    updatedAt: d('2026-08-10T00:00:00Z'),
  }),
  // Customer draft with no agent or branch.
  app({ id: 'C', companyId: 'c1', createdAt: d('2026-08-06T00:00:00Z'), updatedAt: d('2026-08-06T00:00:00Z') }),
  // Submitted before the window, rejected inside it.
  app({
    id: 'D',
    companyId: 'c2',
    branchId: 'b2',
    agentUserId: 'a2',
    status: ApplicationStatus.rejected,
    createdAt: d('2026-07-20T00:00:00Z'),
    submittedAt: d('2026-07-25T00:00:00Z'),
    updatedAt: d('2026-08-02T00:00:00Z'),
  }),
  // Still under review.
  app({
    id: 'E',
    companyId: 'c2',
    branchId: 'b2',
    agentUserId: 'a2',
    status: ApplicationStatus.under_review,
    createdAt: d('2026-08-15T00:00:00Z'),
    submittedAt: d('2026-08-16T00:00:00Z'),
    updatedAt: d('2026-08-16T00:00:00Z'),
  }),
  // Draft created before the window: contributes nothing.
  app({
    id: 'F',
    companyId: 'c1',
    branchId: 'b1',
    agentUserId: 'a1',
    createdAt: d('2026-07-01T00:00:00Z'),
    updatedAt: d('2026-07-01T00:00:00Z'),
  }),
  // Zoho partner: draft → partner_processing is a submission, not an approval.
  app({
    id: 'G',
    companyId: 'c2',
    agentUserId: 'a2',
    status: ApplicationStatus.partner_processing,
    createdAt: d('2026-08-20T12:00:00Z'),
    submittedAt: d('2026-08-20T12:00:00Z'),
    updatedAt: d('2026-08-20T12:00:00Z'),
  }),
];

const transitions: FunnelTransition[] = [
  { applicationId: 'A', fromValue: 'draft', toValue: 'under_review', createdAt: d('2026-08-03T10:00:00Z') },
  { applicationId: 'A', fromValue: 'under_review', toValue: 'contract_signing_required', createdAt: d('2026-08-03T20:00:00Z') },
  { applicationId: 'B', fromValue: 'under_review', toValue: 'pending_finance_activation', createdAt: d('2026-08-07T00:00:00Z') },
  { applicationId: 'B', fromValue: 'pending_finance_activation', toValue: 'active', createdAt: d('2026-08-10T00:00:00Z') },
  { applicationId: 'D', fromValue: 'under_review', toValue: 'rejected', createdAt: d('2026-08-02T00:00:00Z') },
  { applicationId: 'G', fromValue: 'draft', toValue: 'partner_processing', createdAt: d('2026-08-20T12:00:00Z') },
];

describe('origination funnel aggregation', () => {
  it('groups by company with stage counts, approval rate and timing', () => {
    const result = aggregateOriginationFunnel({ applications, transitions, groupBy: 'company', from, to, labels });

    expect(result.group_by).toBe('company');
    expect(result.from).toBe('2026-08-01T00:00:00.000Z');
    expect(result.rows.map((r) => r.key)).toEqual(['c1', 'c2']);

    const [c1, c2] = result.rows;
    expect(c1).toMatchObject({
      label: 'Chery Elite Motors',
      drafts: 1,
      submitted: 2,
      approved: 2,
      activated: 1,
      rejected: 0,
      approval_rate: 1,
      median_approval_hours: 29,
      under_24h_rate: 0.5,
    });
    expect(c2).toMatchObject({
      label: 'QAuto Audi',
      drafts: 0,
      submitted: 2,
      approved: 0,
      activated: 0,
      rejected: 1,
      approval_rate: 0,
      median_approval_hours: null,
      under_24h_rate: null,
    });
    expect(result.totals).toEqual({
      company_name: null,
      branch_name: null,
      drafts: 1,
      submitted: 4,
      approved: 2,
      activated: 1,
      rejected: 1,
      approval_rate: 0.5,
      median_approval_hours: 29,
      under_24h_rate: 0.5,
    });
  });

  it('groups by branch, falling back to the agent home branch and bucketing the rest as unassigned', () => {
    const result = aggregateOriginationFunnel({ applications, transitions, groupBy: 'branch', from, to, labels });
    const byKey = Object.fromEntries(result.rows.map((r) => [r.key, r]));

    expect(byKey.b1).toMatchObject({
      label: 'Doha Main',
      company_name: 'Chery Elite Motors',
      branch_name: 'Doha Main',
      submitted: 2,
      approved: 2,
      activated: 1,
    });
    expect(byKey.b2).toMatchObject({ label: 'Lusail', submitted: 1, rejected: 1 });
    expect(byKey['unassigned:c1']).toMatchObject({ label: 'Unassigned', company_name: 'Chery Elite Motors', drafts: 1 });
    expect(byKey['unassigned:c2']).toMatchObject({ label: 'Unassigned', company_name: 'QAuto Audi', submitted: 1 });
  });

  it('groups by sales executive with the home branch as context', () => {
    const result = aggregateOriginationFunnel({ applications, transitions, groupBy: 'agent', from, to, labels });
    const byKey = Object.fromEntries(result.rows.map((r) => [r.key, r]));

    expect(byKey.a1).toMatchObject({ label: 'Amal', branch_name: 'Doha Main', submitted: 2, approved: 2, activated: 1 });
    expect(byKey.a2).toMatchObject({ label: 'Bilal', branch_name: null, submitted: 2, rejected: 1, approved: 0 });
    expect(byKey['unassigned:c1']).toMatchObject({ drafts: 1 });
    expect(result.rows[0]?.key).toBe('a1');
  });

  it('returns empty rows and null rates when nothing happened in the window', () => {
    const result = aggregateOriginationFunnel({
      applications,
      transitions,
      groupBy: 'company',
      from: d('2027-01-01T00:00:00Z'),
      to: d('2027-01-31T00:00:00Z'),
      labels,
    });
    expect(result.rows.every((r) => r.submitted === 0 && r.approval_rate === null)).toBe(true);
    expect(result.totals.median_approval_hours).toBeNull();
  });
});

describe('origination funnel helpers', () => {
  it('only counts approvals that leave under_review, picking the earliest', () => {
    expect(firstApprovalAt(transitions.filter((t) => t.applicationId === 'G'))).toBeNull();
    expect(
      firstApprovalAt([
        { applicationId: 'x', fromValue: 'under_review', toValue: 'pending_finance_activation', createdAt: d('2026-08-09T00:00:00Z') },
        { applicationId: 'x', fromValue: 'under_review', toValue: 'contract_signing_required', createdAt: d('2026-08-08T00:00:00Z') },
        { applicationId: 'x', fromValue: 'under_review', toValue: 'resubmission_required', createdAt: d('2026-08-07T00:00:00Z') },
      ])?.toISOString(),
    ).toBe('2026-08-08T00:00:00.000Z');
  });

  it('computes medians for odd and even sets', () => {
    expect(median([])).toBeNull();
    expect(median([5])).toBe(5);
    expect(median([10, 48])).toBe(29);
    expect(median([3, 1, 2])).toBe(2);
  });

  it('resolves the branch from the application first, then the agent', () => {
    expect(resolveFunnelBranchId({ branchId: 'b9', agentUserId: 'a1' }, labels.agents)).toBe('b9');
    expect(resolveFunnelBranchId({ branchId: null, agentUserId: 'a1' }, labels.agents)).toBe('b1');
    expect(resolveFunnelBranchId({ branchId: null, agentUserId: 'a2' }, labels.agents)).toBeNull();
    expect(resolveFunnelBranchId({ branchId: null, agentUserId: null }, labels.agents)).toBeNull();
  });

  it('defaults the range to the last 30 days and expands date-only bounds to whole days', () => {
    const now = d('2026-09-07T12:00:00Z');
    const range = resolveFunnelRange(undefined, undefined, now);
    expect(range.to).toEqual(now);
    expect(range.from.toISOString()).toBe('2026-08-08T12:00:00.000Z');

    const explicit = resolveFunnelRange('2026-08-01', '2026-08-31', now);
    expect(explicit.from.toISOString()).toBe('2026-08-01T00:00:00.000Z');
    expect(explicit.to.toISOString()).toBe('2026-08-31T23:59:59.999Z');

    expect(() => resolveFunnelRange('not-a-date', undefined, now)).toThrow(BadRequestException);
    expect(() => resolveFunnelRange('2026-09-01', '2026-08-01', now)).toThrow('invalid_date_range');
  });
});
