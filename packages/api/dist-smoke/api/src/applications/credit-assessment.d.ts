import { type AffordabilityResult, type CreditAssessment, type CreditAssessmentInput, type ProductRuleViolation } from "@drivemarket/shared/domain-rules";
import type { Prisma } from '@prisma/client';
export type AffordabilityDto = {
    dbr: number;
    cap: number;
    hard_cap: number;
    status: AffordabilityResult['status'];
    exception_tier: 0 | 1 | 2 | 3;
    max_installment_within_cap: number;
    headroom: number;
    stressed: {
        dbr: number;
        within_limit: boolean;
    } | null;
};
export type CreditAssessmentDto = {
    affordability: AffordabilityDto | null;
    affordability_with_guarantor: AffordabilityDto | null;
    approval_authority: CreditAssessment['approvalAuthority'];
    path: CreditAssessment['path'];
    reasons: string[];
    rule_flags: Array<{
        code: string;
        severity: 'hard' | 'soft';
        params: Record<string, number | string>;
    }>;
    assessed_at: string;
    financed_amount: number;
    monthly_installment: number;
    approver: {
        role_may_approve: boolean;
        required_roles: string[];
        max_tier_for_role: number;
    };
};
export type CreditAssessmentSource = {
    customerSnapshot: unknown;
    pricingSnapshot: unknown;
    product?: {
        attributes?: unknown;
        bodyType?: string | null;
    } | null;
};
export type AssessedApplicationCredit = {
    assessment: CreditAssessment;
    financedAmount: number;
    monthlyInstallment: number;
};
export declare function financedAmountOf(pricingRaw: unknown): number;
export declare function monthlyInstallmentOf(pricingRaw: unknown): number;
export declare function monthlyIncomeOf(snapshotRaw: unknown): number | null;
export declare function monthlyLiabilitiesOf(snapshotRaw: unknown): number;
export declare function guarantorMonthlyIncomeOf(snapshotRaw: unknown): number | null;
export declare function ruleViolationsOf(pricingRaw: unknown): ProductRuleViolation[];
export declare function creditAssessmentInputFor(source: CreditAssessmentSource): {
    input: CreditAssessmentInput;
    financedAmount: number;
    monthlyInstallment: number;
};
export declare function assessApplicationCredit(source: CreditAssessmentSource, now?: Date): AssessedApplicationCredit;
export declare function toAffordabilityDto(result: AffordabilityResult | null | undefined): AffordabilityDto | null;
export declare function approverFor(role: string | null | undefined, authority: CreditAssessment['approvalAuthority']): CreditAssessmentDto['approver'];
export declare function toCreditAssessmentDto(assessed: AssessedApplicationCredit, role: string | null | undefined): CreditAssessmentDto;
export declare function creditAssessmentColumns(assessed: AssessedApplicationCredit): {
    creditAssessment: CreditAssessmentDto;
    approvalAuthority: CreditAssessment['approvalAuthority'];
};
export declare function creditAssessmentData(assessed: AssessedApplicationCredit): {
    creditAssessment: Prisma.InputJsonValue;
    approvalAuthority: CreditAssessment['approvalAuthority'];
};
export declare function creditAssessedLogMetadata(assessed: AssessedApplicationCredit, stage: 'submit' | 'approval'): {
    stage: "approval" | "submit";
    path: import("@drivemarket/shared/domain-rules").CreditDecisionPath;
    authority: import("@drivemarket/shared/domain-rules").ApprovalAuthority;
    reasons: string[];
    financed_amount: number;
    monthly_installment: number;
    dbr: number | null;
    exception_tier: 0 | 1 | 2 | 3 | null;
};
