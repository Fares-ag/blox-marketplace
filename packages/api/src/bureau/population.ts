import { financingSource } from '../applications/partner-finance';
import { isValidQid } from '../common/qid';

/** Activated BLOX facilities that may appear in a month-end Bureau file. */
export const BUREAU_REPORTABLE_STATUSES = [
  'active',
  'hardship',
  'repossession_in_progress',
  'total_loss',
  'completed',
] as const;

export type BureauExcludeReason =
  | 'not_activated'
  | 'status_not_reportable'
  | 'kyc_unverified'
  | 'qid_missing'
  | 'qid_invalid'
  | 'identity_hold'
  | 'partner_book'
  | 'corporate'
  | 'company_not_allowlisted';

export type BureauPopulationPolicy = {
  companyIds: ReadonlySet<string>;
  includeAllCompanies: boolean;
  includeCorporate: boolean;
};

export type BureauPopulationCandidate = {
  id: string;
  status: string;
  activatedAt: Date | null;
  kycStatus: string | null;
  qid: string | null;
  identityHoldReason: string | null;
  identityHoldClearedAt: Date | null;
  companyId: string;
  applicantType: string;
  crmAdapter: string | null;
};

export type BureauPopulationDecision =
  | { include: true }
  | { include: false; reason: BureauExcludeReason };

/**
 * Who is in the national file. Changing this is a controlled change, not a
 * month-end judgement. Official Bureau codes come later; the include/exclude
 * gate does not wait for them.
 */
export function evaluateBureauPopulation(
  candidate: BureauPopulationCandidate,
  policy: BureauPopulationPolicy,
): BureauPopulationDecision {
  if (!policy.includeAllCompanies) {
    if (policy.companyIds.size === 0 || !policy.companyIds.has(candidate.companyId)) {
      return { include: false, reason: 'company_not_allowlisted' };
    }
  }
  if (!candidate.activatedAt) return { include: false, reason: 'not_activated' };
  if (!BUREAU_REPORTABLE_STATUSES.includes(candidate.status as (typeof BUREAU_REPORTABLE_STATUSES)[number])) {
    return { include: false, reason: 'status_not_reportable' };
  }
  if (candidate.kycStatus !== 'verified') return { include: false, reason: 'kyc_unverified' };
  const qid = candidate.qid?.trim() || null;
  if (!qid) return { include: false, reason: 'qid_missing' };
  if (!isValidQid(qid)) return { include: false, reason: 'qid_invalid' };
  if (candidate.identityHoldReason && !candidate.identityHoldClearedAt) {
    return { include: false, reason: 'identity_hold' };
  }
  if (financingSource(candidate.crmAdapter) === 'partner') {
    return { include: false, reason: 'partner_book' };
  }
  if (candidate.applicantType === 'corporate' && !policy.includeCorporate) {
    return { include: false, reason: 'corporate' };
  }
  return { include: true };
}
