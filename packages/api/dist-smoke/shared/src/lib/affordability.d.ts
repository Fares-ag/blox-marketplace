import { type EmployerCategory, type FinancingRequest, type ProductRuleViolation, type ResidencyClass } from './product-rules';
export type DbrStatus = 'within_cap' | 'exception_tier_1' | 'exception_tier_2' | 'exception_tier_3' | 'above_hard_cap';
export type AffordabilityInput = {
    monthlyIncome: number;
    monthlyLiabilities: number;
    proposedInstallment: number;
    residency: ResidencyClass;
    employerCategory: EmployerCategory;
    financedAmount?: number;
};
export type AffordabilityResult = {
    dbr: number;
    cap: number;
    hardCap: number;
    status: DbrStatus;
    exceptionTier: 0 | 1 | 2 | 3;
    maxInstallmentWithinCap: number;
    headroom: number;
    stressed?: {
        dbr: number;
        withinLimit: boolean;
    };
};
export declare function dbrCapFor(residency: ResidencyClass, employer: EmployerCategory): number;
export declare function assessAffordability(input: AffordabilityInput): AffordabilityResult;
export declare function maxFinancingForInstallment(maxInstallment: number, annualRatePercent: number, tenureMonths: number): number;
export type EligibilityCheckCode = 'age_band' | 'income_floor' | 'residency_duration' | 'dbr' | 'stress_test' | 'applicant_type' | 'product_rules';
export type EligibilityCheck = {
    code: EligibilityCheckCode;
    status: 'pass' | 'warn' | 'fail' | 'unknown';
    params: Record<string, number | string>;
};
export type EligibilityOutcome = 'likely_eligible' | 'needs_review' | 'not_eligible' | 'incomplete';
export type EligibilityInput = {
    residency: ResidencyClass | null;
    dateOfBirth?: string | null;
    monthlyIncome: number;
    monthlyLiabilities: number;
    employerCategory: EmployerCategory;
    residencyMonths?: number | null;
    financing: FinancingRequest;
    annualRatePercent: number;
    proposedInstallment?: number | null;
    now?: Date;
};
export type EligibilityResult = {
    outcome: EligibilityOutcome;
    checks: EligibilityCheck[];
    affordability: AffordabilityResult | null;
    violations: ProductRuleViolation[];
    installment: number;
    financedAmount: number;
    maxFinancingWithinCap: number;
};
export declare function preCheckEligibility(input: EligibilityInput): EligibilityResult;
