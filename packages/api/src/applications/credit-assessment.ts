import {
  APPROVAL_AUTHORITY_ROLES,
  MAX_EXCEPTION_TIER_BY_ROLE,
  assessCredit,
  employerCategoryFromEmploymentType,
  roleMayApprove,
  type AffordabilityResult,
  type CreditAssessment,
  type CreditAssessmentInput,
  type ProductRuleCode,
  type ProductRuleViolation,
} from '@drivemarket/shared/domain-rules';
import type { Prisma } from '@prisma/client';
import { ruleFlagsOf, vehicleCategoryFor } from './application-rules';
import { employmentTypeOf, hasGuarantorOf, readCustomerSnapshot, residencyOf } from './customer-snapshot';

/**
 * Server-side credit assessment for an application (LOS FSD §1.5 approval
 * matrix, DBR001 caps, EXC001 exception tiers). The maths lives in the shared
 * `credit-assessment` module so the marketplace preview, the partner view and
 * the ops decision panel all show the same numbers; this file only derives the
 * inputs from the stored snapshots and shapes the wire DTO.
 *
 * Pure — no Prisma, no Nest — so the derivation is unit-tested directly.
 */

/** Matches `AffordabilityDto` in packages/shared/src/types/customer-platform.ts field for field. */
export type AffordabilityDto = {
  dbr: number;
  cap: number;
  hard_cap: number;
  status: AffordabilityResult['status'];
  exception_tier: 0 | 1 | 2 | 3;
  max_installment_within_cap: number;
  headroom: number;
  stressed: { dbr: number; within_limit: boolean } | null;
};

/** Matches `CreditAssessmentDto` in packages/shared/src/types/customer-platform.ts field for field. */
export type CreditAssessmentDto = {
  affordability: AffordabilityDto | null;
  affordability_with_guarantor: AffordabilityDto | null;
  approval_authority: CreditAssessment['approvalAuthority'];
  path: CreditAssessment['path'];
  reasons: string[];
  rule_flags: Array<{ code: string; severity: 'hard' | 'soft'; params: Record<string, number | string> }>;
  assessed_at: string;
  financed_amount: number;
  monthly_installment: number;
  /** Computed for the requesting officer (neutral values on the stored copy). */
  approver: { role_may_approve: boolean; required_roles: string[]; max_tier_for_role: number };
};

export type CreditAssessmentSource = {
  customerSnapshot: unknown;
  pricingSnapshot: unknown;
  /** Motorcycles are recognised from the listing attributes / body type. */
  product?: { attributes?: unknown; bodyType?: string | null } | null;
};

export type AssessedApplicationCredit = {
  assessment: CreditAssessment;
  financedAmount: number;
  monthlyInstallment: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function num(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function pricingOf(raw: unknown): Record<string, unknown> {
  return isRecord(raw) ? raw : {};
}

/** Amount Blox finances: the explicit snapshot value, else price − down payment. */
export function financedAmountOf(pricingRaw: unknown): number {
  const pricing = pricingOf(pricingRaw);
  const explicit = num(pricing.financed_amount ?? pricing.financedAmount ?? pricing.loan_amount);
  if (explicit != null && explicit > 0) return explicit;
  const price = num(pricing.selling_price ?? pricing.list_price) ?? 0;
  const down = num(pricing.down_payment) ?? 0;
  return Math.max(0, Math.round((price - down) * 100) / 100);
}

export function monthlyInstallmentOf(pricingRaw: unknown): number {
  const pricing = pricingOf(pricingRaw);
  return num(pricing.monthly ?? pricing.monthly_payment) ?? 0;
}

/** Net monthly income: `monthlyIncome`, else `income`, else `employment.salary` (must be positive). */
export function monthlyIncomeOf(snapshotRaw: unknown): number | null {
  const snapshot = readCustomerSnapshot(snapshotRaw);
  const employment = isRecord(snapshot.employment) ? snapshot.employment : null;
  for (const candidate of [snapshot.monthlyIncome, snapshot.income, employment?.salary]) {
    const n = num(candidate);
    if (n != null && n > 0) return n;
  }
  return null;
}

export function monthlyLiabilitiesOf(snapshotRaw: unknown): number {
  const snapshot = readCustomerSnapshot(snapshotRaw);
  return Math.max(0, num(snapshot.monthlyLiabilities) ?? 0);
}

export function guarantorMonthlyIncomeOf(snapshotRaw: unknown): number | null {
  const snapshot = readCustomerSnapshot(snapshotRaw);
  if (!hasGuarantorOf(snapshot) || !isRecord(snapshot.guarantor)) return null;
  const n = num(snapshot.guarantor.monthlyIncome);
  return n != null && n > 0 ? n : null;
}

/** Stored soft flags (hard violations never reach a stored snapshot) in the shared violation shape. */
export function ruleViolationsOf(pricingRaw: unknown): ProductRuleViolation[] {
  return ruleFlagsOf(pricingRaw).map((flag) => ({
    code: flag.code as ProductRuleCode,
    severity: 'soft' as const,
    params: { ...flag.params },
  }));
}

/** Everything `assessCredit` needs, derived from the snapshots; affordability is null when income or residency is unknown. */
export function creditAssessmentInputFor(source: CreditAssessmentSource): {
  input: CreditAssessmentInput;
  financedAmount: number;
  monthlyInstallment: number;
} {
  const financedAmount = financedAmountOf(source.pricingSnapshot);
  const monthlyInstallment = monthlyInstallmentOf(source.pricingSnapshot);
  const snapshot = readCustomerSnapshot(source.customerSnapshot);
  const income = monthlyIncomeOf(snapshot);
  const residency = residencyOf(snapshot);
  const affordability =
    income != null && residency
      ? {
          monthlyIncome: income,
          monthlyLiabilities: monthlyLiabilitiesOf(snapshot),
          proposedInstallment: monthlyInstallment,
          residency,
          employerCategory: employerCategoryFromEmploymentType(employmentTypeOf(snapshot)),
          financedAmount,
        }
      : null;
  return {
    input: {
      affordability,
      financedAmount,
      vehicleCategory: source.product ? vehicleCategoryFor(source.product) : 'car',
      ruleFlags: ruleViolationsOf(source.pricingSnapshot),
      guarantorMonthlyIncome: guarantorMonthlyIncomeOf(snapshot),
    },
    financedAmount,
    monthlyInstallment,
  };
}

export function assessApplicationCredit(source: CreditAssessmentSource, now = new Date()): AssessedApplicationCredit {
  const { input, financedAmount, monthlyInstallment } = creditAssessmentInputFor(source);
  return { assessment: assessCredit(input, now), financedAmount, monthlyInstallment };
}

export function toAffordabilityDto(result: AffordabilityResult | null | undefined): AffordabilityDto | null {
  if (!result) return null;
  return {
    dbr: Number.isFinite(result.dbr) ? result.dbr : 99,
    cap: result.cap,
    hard_cap: result.hardCap,
    status: result.status,
    exception_tier: result.exceptionTier,
    max_installment_within_cap: result.maxInstallmentWithinCap,
    headroom: result.headroom,
    stressed: result.stressed ? { dbr: result.stressed.dbr, within_limit: result.stressed.withinLimit } : null,
  };
}

/** `approver` block for a given role; a null role yields the neutral values used on the stored copy. */
export function approverFor(
  role: string | null | undefined,
  authority: CreditAssessment['approvalAuthority'],
): CreditAssessmentDto['approver'] {
  return {
    role_may_approve: role ? roleMayApprove(role, authority) : false,
    required_roles: [...APPROVAL_AUTHORITY_ROLES[authority]],
    max_tier_for_role: role ? (MAX_EXCEPTION_TIER_BY_ROLE[role] ?? 0) : 0,
  };
}

export function toCreditAssessmentDto(
  assessed: AssessedApplicationCredit,
  role: string | null | undefined,
): CreditAssessmentDto {
  const { assessment } = assessed;
  return {
    affordability: toAffordabilityDto(assessment.affordability),
    affordability_with_guarantor: toAffordabilityDto(assessment.affordabilityWithGuarantor),
    approval_authority: assessment.approvalAuthority,
    path: assessment.path,
    reasons: [...assessment.reasons],
    rule_flags: assessment.ruleFlags.map((flag) => ({
      code: flag.code,
      severity: flag.severity,
      params: { ...flag.params },
    })),
    assessed_at: assessment.assessedAt,
    financed_amount: assessed.financedAmount,
    monthly_installment: assessed.monthlyInstallment,
    approver: approverFor(role, assessment.approvalAuthority),
  };
}

/** Column values persisted on the application at submit / decision time. */
export function creditAssessmentColumns(assessed: AssessedApplicationCredit): {
  creditAssessment: CreditAssessmentDto;
  approvalAuthority: CreditAssessment['approvalAuthority'];
} {
  return {
    creditAssessment: toCreditAssessmentDto(assessed, null),
    approvalAuthority: assessed.assessment.approvalAuthority,
  };
}

/** Same columns typed for a Prisma write (`creditAssessment` is a Json column). */
export function creditAssessmentData(assessed: AssessedApplicationCredit): {
  creditAssessment: Prisma.InputJsonValue;
  approvalAuthority: CreditAssessment['approvalAuthority'];
} {
  const columns = creditAssessmentColumns(assessed);
  return {
    creditAssessment: columns.creditAssessment as unknown as Prisma.InputJsonValue,
    approvalAuthority: columns.approvalAuthority,
  };
}

/** Audit metadata for `credit_assessed` — the path and authority the officer will see. */
export function creditAssessedLogMetadata(assessed: AssessedApplicationCredit, stage: 'submit' | 'approval') {
  const effective = assessed.assessment.affordabilityWithGuarantor ?? assessed.assessment.affordability;
  return {
    stage,
    path: assessed.assessment.path,
    authority: assessed.assessment.approvalAuthority,
    reasons: assessed.assessment.reasons,
    financed_amount: assessed.financedAmount,
    monthly_installment: assessed.monthlyInstallment,
    dbr: assessed.assessment.affordability?.dbr ?? null,
    exception_tier: effective?.exceptionTier ?? null,
  };
}
