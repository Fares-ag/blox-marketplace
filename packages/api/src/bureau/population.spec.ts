import { describe, expect, it } from 'vitest';
import { evaluateBureauPopulation, type BureauPopulationCandidate, type BureauPopulationPolicy } from './population';

const allow = new Set(['co-1']);

const policy: BureauPopulationPolicy = {
  companyIds: allow,
  includeAllCompanies: false,
  includeCorporate: false,
};

function candidate(over: Partial<BureauPopulationCandidate> = {}): BureauPopulationCandidate {
  return {
    id: 'app-1',
    status: 'active',
    activatedAt: new Date('2026-03-01T00:00:00Z'),
    kycStatus: 'verified',
    qid: '28912345678',
    identityHoldReason: null,
    identityHoldClearedAt: null,
    companyId: 'co-1',
    applicantType: 'individual',
    crmAdapter: 'none',
    ...over,
  };
}

describe('evaluateBureauPopulation', () => {
  it('includes an activated BLOX facility with a verified QID', () => {
    expect(evaluateBureauPopulation(candidate(), policy)).toEqual({ include: true });
  });

  it('never includes a draft', () => {
    const draft = candidate({ status: 'draft', activatedAt: null });
    expect(evaluateBureauPopulation(draft, policy)).toEqual({ include: false, reason: 'not_activated' });
  });

  it('excludes a draft even if activation was stamped by mistake', () => {
    expect(evaluateBureauPopulation(candidate({ status: 'draft' }), policy)).toEqual({
      include: false,
      reason: 'status_not_reportable',
    });
  });

  it('excludes rejected and cancelled applications', () => {
    expect(evaluateBureauPopulation(candidate({ status: 'rejected' }), policy).include).toBe(false);
    expect(evaluateBureauPopulation(candidate({ status: 'submission_cancelled' }), policy).include).toBe(false);
  });

  it('includes completed (settled with Ibra) and hardship', () => {
    expect(evaluateBureauPopulation(candidate({ status: 'completed' }), policy)).toEqual({ include: true });
    expect(evaluateBureauPopulation(candidate({ status: 'hardship' }), policy)).toEqual({ include: true });
  });

  it('excludes partner CRM (Zoho) facilities', () => {
    expect(evaluateBureauPopulation(candidate({ crmAdapter: 'zoho' }), policy)).toEqual({
      include: false,
      reason: 'partner_book',
    });
  });

  it('excludes unverified identity even when a QID is typed', () => {
    expect(evaluateBureauPopulation(candidate({ kycStatus: 'pending' }), policy)).toEqual({
      include: false,
      reason: 'kyc_unverified',
    });
  });

  it('excludes missing or malformed QIDs', () => {
    expect(evaluateBureauPopulation(candidate({ qid: null }), policy)).toEqual({
      include: false,
      reason: 'qid_missing',
    });
    expect(evaluateBureauPopulation(candidate({ qid: '123' }), policy)).toEqual({
      include: false,
      reason: 'qid_invalid',
    });
  });

  it('excludes uncleared identity holds', () => {
    expect(
      evaluateBureauPopulation(candidate({ identityHoldReason: 'MISMATCHED_IDENTITY' }), policy),
    ).toEqual({ include: false, reason: 'identity_hold' });
  });

  it('excludes companies not on the signed allowlist', () => {
    expect(evaluateBureauPopulation(candidate({ companyId: 'seed-dealer' }), policy)).toEqual({
      include: false,
      reason: 'company_not_allowlisted',
    });
  });

  it('includes nothing when the allowlist is empty', () => {
    const empty: BureauPopulationPolicy = { companyIds: new Set(), includeAllCompanies: false, includeCorporate: false };
    expect(evaluateBureauPopulation(candidate(), empty)).toEqual({
      include: false,
      reason: 'company_not_allowlisted',
    });
  });

  it('drops corporate applicants unless Finance opted in', () => {
    expect(evaluateBureauPopulation(candidate({ applicantType: 'corporate' }), policy)).toEqual({
      include: false,
      reason: 'corporate',
    });
    expect(
      evaluateBureauPopulation(candidate({ applicantType: 'corporate' }), { ...policy, includeCorporate: true }),
    ).toEqual({ include: true });
  });
});
