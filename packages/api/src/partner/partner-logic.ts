import { ApplicationStatus, DocumentCategory, type Prisma } from '@prisma/client';
import {
  APPROVAL_AUTHORITY_ROLES,
  MAX_EXCEPTION_TIER_BY_ROLE,
  maskQid,
  parseQid,
  roleMayApprove,
  type ApprovalAuthority,
} from '@drivemarket/shared/domain-rules';
import type {
  AffordabilityDto,
  CreditAssessmentDto,
  PartnerApplicationDto,
} from '../../../shared/src/types/customer-platform';

/**
 * Finance-provider (NBFC) read-only view. A partner viewer sees only the
 * applications tagged to their own provider, from submission onwards, with
 * the QID masked, no phone, and just the identity/income documents.
 */

/** Everything from submission onwards — drafts are the applicant's private workspace. */
export const PARTNER_VISIBLE_STATUSES: ApplicationStatus[] = Object.values(ApplicationStatus).filter(
  (status) => status !== ApplicationStatus.draft,
);

/** Identity and income evidence (individual, corporate and guarantor); never selfies, quotations or takaful. */
export const PARTNER_DOCUMENT_CATEGORIES: DocumentCategory[] = [
  DocumentCategory.qid,
  DocumentCategory.id,
  DocumentCategory.passport,
  DocumentCategory.salary,
  DocumentCategory.bank,
  DocumentCategory.credit_bureau,
  DocumentCategory.residence_proof,
  DocumentCategory.employment_contract,
  DocumentCategory.trade_license,
  DocumentCategory.audited_financials,
  DocumentCategory.tax_card,
  DocumentCategory.business_bank,
  DocumentCategory.guarantor_qid,
  DocumentCategory.guarantor_salary,
  DocumentCategory.guarantor_bank,
  DocumentCategory.cr,
  DocumentCategory.computer_card,
  DocumentCategory.signatory_id,
];

export function isPartnerVisibleStatus(status: ApplicationStatus): boolean {
  return PARTNER_VISIBLE_STATUSES.includes(status);
}

export function isPartnerVisibleDocument(category: DocumentCategory): boolean {
  return PARTNER_DOCUMENT_CATEGORIES.includes(category);
}

/** Prisma filter for a partner viewer: their provider only, visible statuses only (an invisible filter yields nothing). */
export function partnerApplicationWhere(
  financePartnerId: string,
  status?: ApplicationStatus | null,
): Prisma.ApplicationWhereInput {
  if (status) {
    return { financePartnerId, status: isPartnerVisibleStatus(status) ? status : { in: [] } };
  }
  return { financePartnerId, status: { in: PARTNER_VISIBLE_STATUSES } };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Plan figures from the stored pricing snapshot (`list_price`, `down_payment`, `tenor`, `monthly`, `down_payment_pct`). */
export function financingFromPricing(pricing: unknown): PartnerApplicationDto['financing'] {
  const p = asRecord(pricing) ?? {};
  const price = numberOrNull(p.selling_price ?? p.list_price);
  const down = numberOrNull(p.down_payment);
  const financed =
    numberOrNull(p.financed_amount) ?? (price !== null && down !== null ? roundMoney(Math.max(price - down, 0)) : null);
  return {
    financed_amount: financed,
    tenure_months: numberOrNull(p.tenor ?? p.tenure),
    monthly: numberOrNull(p.monthly),
    down_payment_pct: numberOrNull(p.down_payment_pct),
  };
}

/** Applicant identity as the lender may see it: name, masked QID, nationality, residency. No phone, no address. */
export function customerFromSnapshot(
  snapshot: unknown,
  fallbackName: string | null,
): PartnerApplicationDto['customer'] {
  const snap = asRecord(snapshot) ?? {};
  const composed = [stringOrNull(snap.firstName), stringOrNull(snap.lastName)].filter(Boolean).join(' ');
  const qid = stringOrNull(snap.qid);
  const parsed = qid ? parseQid(qid) : null;
  const residencyRaw = snap.residency;
  const residency =
    residencyRaw === 'qatari' || residencyRaw === 'expat' ? residencyRaw : parsed?.valid ? parsed.residency : null;
  return {
    name: stringOrNull(snap.full_name) ?? (composed || null) ?? fallbackName,
    qid_masked: qid ? maskQid(qid) || null : null,
    nationality: stringOrNull(snap.nationality) ?? (parsed?.valid && parsed.nationality ? parsed.nationality.en : null),
    residency,
  };
}

const AFFORDABILITY_STATUSES: AffordabilityDto['status'][] = [
  'within_cap',
  'exception_tier_1',
  'exception_tier_2',
  'exception_tier_3',
  'above_hard_cap',
];

const APPROVAL_AUTHORITIES: ApprovalAuthority[] = ['senior_manager', 'head_of_credit', 'above_matrix'];

function tierFromStatus(status: AffordabilityDto['status']): AffordabilityDto['exception_tier'] {
  switch (status) {
    case 'exception_tier_1':
      return 1;
    case 'exception_tier_2':
      return 2;
    case 'exception_tier_3':
    case 'above_hard_cap':
      return 3;
    default:
      return 0;
  }
}

/** Stored affordability block (wire snake_case or the raw shared-lib camelCase) → `AffordabilityDto`. */
export function normalizeAffordability(raw: unknown): AffordabilityDto | null {
  const a = asRecord(raw);
  if (!a) return null;
  const dbr = numberOrNull(a.dbr);
  const cap = numberOrNull(a.cap);
  const hardCap = numberOrNull(a.hard_cap ?? a.hardCap);
  const status = a.status;
  if (dbr === null || cap === null || hardCap === null) return null;
  const safeStatus = AFFORDABILITY_STATUSES.includes(status as AffordabilityDto['status'])
    ? (status as AffordabilityDto['status'])
    : dbr > hardCap
      ? 'above_hard_cap'
      : dbr > cap
        ? 'exception_tier_1'
        : 'within_cap';
  const tierRaw = numberOrNull(a.exception_tier ?? a.exceptionTier);
  const tier = (tierRaw !== null && [0, 1, 2, 3].includes(tierRaw) ? tierRaw : tierFromStatus(safeStatus)) as
    | 0
    | 1
    | 2
    | 3;
  const stressed = asRecord(a.stressed);
  return {
    dbr,
    cap,
    hard_cap: hardCap,
    status: safeStatus,
    exception_tier: tier,
    max_installment_within_cap: numberOrNull(a.max_installment_within_cap ?? a.maxInstallmentWithinCap) ?? 0,
    headroom: numberOrNull(a.headroom) ?? 0,
    stressed: stressed
      ? {
          dbr: numberOrNull(stressed.dbr) ?? 0,
          within_limit: Boolean(stressed.within_limit ?? stressed.withinLimit),
        }
      : null,
  };
}

/** Who may sign off, evaluated for the reader's role. A partner viewer never approves. */
export function approverFor(role: string, authority: ApprovalAuthority): CreditAssessmentDto['approver'] {
  return {
    role_may_approve: roleMayApprove(role, authority),
    required_roles: [...APPROVAL_AUTHORITY_ROLES[authority]],
    max_tier_for_role: MAX_EXCEPTION_TIER_BY_ROLE[role] ?? 0,
  };
}

/**
 * Stored `Application.creditAssessment` JSON → wire DTO for a reader. Accepts
 * both the DTO shape written at submission and the raw shared-lib result.
 */
export function creditAssessmentForRole(raw: unknown, role: string): CreditAssessmentDto | null {
  const r = asRecord(raw);
  if (!r) return null;
  const authorityRaw = r.approval_authority ?? r.approvalAuthority;
  const authority = APPROVAL_AUTHORITIES.includes(authorityRaw as ApprovalAuthority)
    ? (authorityRaw as ApprovalAuthority)
    : null;
  if (!authority) return null;
  const pathRaw = r.path;
  const path: CreditAssessmentDto['path'] =
    pathRaw === 'approve' || pathRaw === 'refer' || pathRaw === 'decline' ? pathRaw : 'refer';
  const reasons = Array.isArray(r.reasons) ? r.reasons.filter((x): x is string => typeof x === 'string') : [];
  const flagsRaw = r.rule_flags ?? r.ruleFlags;
  const rule_flags: CreditAssessmentDto['rule_flags'] = Array.isArray(flagsRaw)
    ? flagsRaw
        .map((f) => asRecord(f))
        .filter((f): f is Record<string, unknown> => !!f && typeof f.code === 'string' && !!f.code)
        .map((f) => ({
          code: String(f.code),
          severity: f.severity === 'hard' ? 'hard' : 'soft',
          params: (asRecord(f.params) as Record<string, number | string> | null) ?? {},
        }))
    : [];
  const assessedAt = stringOrNull(r.assessed_at ?? r.assessedAt);
  return {
    affordability: normalizeAffordability(r.affordability),
    affordability_with_guarantor: normalizeAffordability(r.affordability_with_guarantor ?? r.affordabilityWithGuarantor),
    approval_authority: authority,
    path,
    reasons,
    rule_flags,
    assessed_at: assessedAt ?? new Date(0).toISOString(),
    financed_amount: numberOrNull(r.financed_amount ?? r.financedAmount) ?? 0,
    monthly_installment: numberOrNull(r.monthly_installment ?? r.monthlyInstallment) ?? 0,
    approver: approverFor(role, authority),
  };
}

export type PartnerApplicationRow = {
  id: string;
  status: ApplicationStatus;
  submittedAt: Date | null;
  updatedAt: Date;
  customerSnapshot: unknown;
  pricingSnapshot: unknown;
  creditAssessment: unknown;
  consentsCompletedAt: Date | null;
  company: { name: string };
  branch: { name: string } | null;
  product: { make: string; model: string; modelYear: number; price: unknown };
  customer: { name: string | null };
  documents: Array<{ id: string; category: DocumentCategory; originalName: string | null; createdAt: Date }>;
};

export function toPartnerApplicationDto(row: PartnerApplicationRow, role = 'partner_viewer'): PartnerApplicationDto {
  return {
    id: row.id,
    status: row.status,
    submitted_at: row.submittedAt?.toISOString() ?? null,
    updated_at: row.updatedAt.toISOString(),
    company_name: row.company.name,
    branch_name: row.branch?.name ?? null,
    vehicle: {
      make: row.product.make,
      model: row.product.model,
      model_year: row.product.modelYear,
      price: numberOrNull(row.product.price),
    },
    customer: customerFromSnapshot(row.customerSnapshot, row.customer.name),
    financing: financingFromPricing(row.pricingSnapshot),
    credit_assessment: creditAssessmentForRole(row.creditAssessment, role),
    consents_completed_at: row.consentsCompletedAt?.toISOString() ?? null,
    documents: row.documents
      .filter((doc) => isPartnerVisibleDocument(doc.category))
      .map((doc) => ({
        id: doc.id,
        category: doc.category,
        original_name: doc.originalName ?? null,
        created_at: doc.createdAt.toISOString(),
      })),
  };
}

export type PartnerSummary = { total: number; by_status: Record<string, number> };

/** Counts by status over the partner's visible applications; every visible status is present (zero when empty). */
export function partnerSummary(groups: Array<{ status: ApplicationStatus; count: number }>): PartnerSummary {
  const by_status: Record<string, number> = {};
  for (const status of PARTNER_VISIBLE_STATUSES) by_status[status] = 0;
  let total = 0;
  for (const group of groups) {
    if (!isPartnerVisibleStatus(group.status)) continue;
    by_status[group.status] = (by_status[group.status] ?? 0) + group.count;
    total += group.count;
  }
  return { total, by_status };
}
