export declare class ProductRulesController {
    rules(): {
        version: string;
        currency: "QAR";
        individuals_only: true;
        tenure: {
            min_months: 3;
            options: readonly [12, 24, 36, 48, 60];
            max_months: Record<import("@drivemarket/shared/domain-rules").ResidencyClass, number>;
        };
        down_payment: {
            min_pct_by_condition: Record<import("@drivemarket/shared/domain-rules").RuleVehicleCondition, number>;
            max_pct: 80;
        };
        premium_car_price_threshold: 90000;
        financing_cap: Record<import("@drivemarket/shared/domain-rules").ProductVariant, number>;
        vehicle_age: {
            max_years_at_tenure_end: 10;
            max_used_years_at_application: 5;
        };
        applicant: {
            age_at_contract_end: Record<import("@drivemarket/shared/domain-rules").ResidencyClass, {
                min: number;
                max: number;
            }>;
            min_net_monthly_income: Record<import("@drivemarket/shared/domain-rules").ResidencyClass, number>;
            min_residency_months_expat: 6;
        };
        dbr: {
            caps: Record<"qatari_government" | "qatari_private_approved" | "qatari_private_unlisted" | "qatari_self_employed" | "expat_government" | "expat_private_approved" | "expat_private_unlisted" | "expat_self_employed", number>;
            hard_cap: 0.75;
            exception_tiers: readonly {
                maxExcess: number;
                tier: number;
            }[];
        };
        residence_duration_options: {
            value: "less-than-6-months" | "6-12-months" | "1-3-years" | "3-5-years" | "more-than-5-years";
            min_months: 0 | 60 | 12 | 6 | 36;
        }[];
        consents: {
            catalog_version: string;
            items: {
                code: "credit_bureau" | "terms" | "kyc_biometric" | "aml";
                version: string;
                title: import("@drivemarket/shared/domain-rules").ConsentLocaleText;
                summary: import("@drivemarket/shared/domain-rules").ConsentLocaleText;
                body: import("@drivemarket/shared/domain-rules").ConsentLocaleText;
            }[];
        };
    };
}
