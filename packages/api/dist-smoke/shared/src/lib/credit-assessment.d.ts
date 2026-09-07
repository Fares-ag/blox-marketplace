import { type AffordabilityInput, type AffordabilityResult } from './affordability';
import { type ProductRuleViolation, type VehicleCategory } from './product-rules';
export type ApprovalAuthority = 'senior_manager' | 'head_of_credit' | 'above_matrix';
export type CreditDecisionPath = 'approve' | 'refer' | 'decline';
export type CreditAssessmentInput = {
    affordability: AffordabilityInput | null;
    financedAmount: number;
    vehicleCategory: VehicleCategory;
    ruleFlags?: ProductRuleViolation[] | null;
    guarantorMonthlyIncome?: number | null;
};
export type CreditAssessment = {
    affordability: AffordabilityResult | null;
    affordabilityWithGuarantor: AffordabilityResult | null;
    approvalAuthority: ApprovalAuthority;
    path: CreditDecisionPath;
    reasons: string[];
    ruleFlags: ProductRuleViolation[];
    assessedAt: string;
};
export declare function assessCredit(input: CreditAssessmentInput, now?: Date): CreditAssessment;
export declare const APPROVAL_AUTHORITY_ROLES: Record<ApprovalAuthority, ReadonlyArray<string>>;
export declare function roleMayApprove(role: string, authority: ApprovalAuthority): boolean;
export declare const MAX_EXCEPTION_TIER_BY_ROLE: Record<string, number>;
export declare function roleMayApproveTier(role: string, tier: number): boolean;
export declare const HARD_CAP_PERCENT: number;
