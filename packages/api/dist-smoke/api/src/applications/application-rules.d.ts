import { type ApplicantKind, type ProductRuleViolation, type ResidencyClass, type VehicleCategory } from "@drivemarket/shared/domain-rules";
export type ProductRuleEnforcement = {
    enforceFinancingCaps: boolean;
    enforceIndividualsOnly: boolean;
};
export declare const PRODUCT_RULE_ENV_KEYS: {
    readonly enforceFinancingCaps: "PRODUCT_RULES_ENFORCE_FINANCING_CAPS";
    readonly enforceIndividualsOnly: "PRODUCT_RULES_ENFORCE_INDIVIDUALS_ONLY";
};
export declare function parseBooleanFlag(value: unknown, fallback?: boolean): boolean;
export declare function productRuleEnforcementFrom(read: (key: string) => unknown): ProductRuleEnforcement;
export declare function productRuleEnforcementFromEnv(env?: NodeJS.ProcessEnv): ProductRuleEnforcement;
export declare function vehicleCategoryFor(product: {
    attributes?: unknown;
    bodyType?: string | null;
}): VehicleCategory;
export declare function offerTenureOptionsOf(raw: unknown): number[] | null;
export type ProductRuleInput = {
    product: {
        price: unknown;
        condition?: string | null;
        modelYear?: number | null;
        attributes?: unknown;
        bodyType?: string | null;
    };
    offer: {
        tenureOptions?: unknown;
        minDownPaymentPct?: unknown;
    };
    pricingSnapshot: Record<string, unknown>;
    applicantType?: ApplicantKind | null;
    residency?: ResidencyClass | null;
    enforcement?: Partial<ProductRuleEnforcement> | null;
    now?: Date;
};
export declare function evaluateProductRules(input: ProductRuleInput): ProductRuleViolation[];
export type RuleFlag = {
    code: string;
    params: Record<string, number | string>;
};
export declare function softRuleFlags(violations: ProductRuleViolation[]): RuleFlag[];
export declare function assertNoHardViolations(violations: ProductRuleViolation[]): void;
export declare function withRuleFlags(pricing: Record<string, unknown>, violations: ProductRuleViolation[]): Record<string, unknown>;
export declare function ruleFlagsOf(pricing: unknown): RuleFlag[];
