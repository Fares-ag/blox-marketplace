export type RuleVehicleCondition = 'new' | 'used';
export type VehicleCategory = 'car' | 'motorcycle';
export type ResidencyClass = 'qatari' | 'expat';
export type ApplicantKind = 'individual' | 'corporate';
export type ProductVariant = 'car_new_standard' | 'car_new_premium' | 'car_used' | 'motorcycle';
export type EmployerCategory = 'government' | 'private_approved' | 'private_unlisted' | 'self_employed';
export declare const PRODUCT_RULES: {
    readonly currency: "QAR";
    readonly individualsOnly: true;
    readonly tenure: {
        readonly minMonths: 3;
        readonly options: readonly [12, 24, 36, 48, 60];
        readonly maxMonths: Record<ResidencyClass, number>;
    };
    readonly downPayment: {
        readonly minPctByCondition: Record<RuleVehicleCondition, number>;
        readonly maxPct: 80;
    };
    readonly premiumCarPriceThreshold: 90000;
    readonly financingCap: Record<ProductVariant, number>;
    readonly approvalAuthority: Record<VehicleCategory, {
        seniorManager: number;
        headOfCredit: number;
    }>;
    readonly vehicleAge: {
        readonly maxYearsAtTenureEnd: 10;
        readonly maxUsedYearsAtApplication: 5;
    };
    readonly applicant: {
        readonly ageAtContractEnd: Record<ResidencyClass, {
            min: number;
            max: number;
        }>;
        readonly minNetMonthlyIncome: Record<ResidencyClass, number>;
        readonly minResidencyMonthsExpat: 6;
    };
    readonly dbr: {
        readonly caps: Record<`${ResidencyClass}_${EmployerCategory}`, number>;
        readonly exceptionTiers: ReadonlyArray<{
            maxExcess: number;
            tier: number;
        }>;
        readonly hardCap: 0.75;
        readonly stress: {
            readonly rentalIncrease: 0.02;
            readonly incomeReduction: 0.1;
            readonly highTicketThreshold: 50000;
            readonly maxStressedDbr: 0.6;
        };
    };
};
export type ProductRuleCode = 'corporate_not_eligible' | 'tenure_below_min' | 'tenure_above_max' | 'tenure_not_offered' | 'down_payment_below_min' | 'down_payment_above_max' | 'financing_amount_exceeds_cap' | 'vehicle_age_at_tenure_end' | 'used_vehicle_too_old' | 'price_not_positive';
export type ProductRuleViolation = {
    code: ProductRuleCode;
    severity: 'hard' | 'soft';
    params: Record<string, number | string>;
};
export type FinancingRequest = {
    applicantType?: ApplicantKind | null;
    residency?: ResidencyClass | null;
    vehicle: {
        price: number;
        condition: RuleVehicleCondition;
        category?: VehicleCategory | null;
        modelYear?: number | null;
    };
    tenureMonths: number;
    downPaymentPct: number;
    offerTenureOptions?: number[] | null;
    offerMinDownPaymentPct?: number | null;
    enforceFinancingCaps?: boolean;
    enforceIndividualsOnly?: boolean;
    now?: Date;
};
export declare function resolveProductVariant(vehicle: {
    price: number;
    condition: RuleVehicleCondition;
    category?: VehicleCategory | null;
}): ProductVariant;
export declare function financingCapFor(variant: ProductVariant): number;
export declare function maxTenureFor(residency: ResidencyClass | null | undefined): number;
export declare function allowedTenureOptions(residency: ResidencyClass | null | undefined, offerTenureOptions?: number[] | null): number[];
export declare function minDownPaymentPctFor(condition: RuleVehicleCondition, offerMinDownPaymentPct?: number | null): number;
export declare function vehicleAgeAtTenureEnd(modelYear: number, tenureMonths: number, now?: Date): number;
export declare function validateFinancingRequest(req: FinancingRequest): ProductRuleViolation[];
export declare function hasHardViolation(violations: ProductRuleViolation[]): boolean;
export declare function requiredApprovalAuthority(category: VehicleCategory, financedAmount: number): 'senior_manager' | 'head_of_credit' | 'above_matrix';
export declare function employerCategoryFromEmploymentType(value: string | null | undefined): EmployerCategory;
export declare function residencyFromNationality(nationality: string | null | undefined): ResidencyClass | null;
export declare const RESIDENCE_DURATION_OPTIONS: readonly [{
    readonly value: "less-than-6-months";
    readonly minMonths: 0;
    readonly labelKey: "applyFlow.residence.lt6";
}, {
    readonly value: "6-12-months";
    readonly minMonths: 6;
    readonly labelKey: "applyFlow.residence.m6_12";
}, {
    readonly value: "1-3-years";
    readonly minMonths: 12;
    readonly labelKey: "applyFlow.residence.y1_3";
}, {
    readonly value: "3-5-years";
    readonly minMonths: 36;
    readonly labelKey: "applyFlow.residence.y3_5";
}, {
    readonly value: "more-than-5-years";
    readonly minMonths: 60;
    readonly labelKey: "applyFlow.residence.gt5";
}];
export type ResidenceDurationValue = (typeof RESIDENCE_DURATION_OPTIONS)[number]['value'];
export declare function residenceMonthsFromOption(value: string | null | undefined): number | null;
