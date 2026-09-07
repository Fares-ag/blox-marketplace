export declare const CONSENT_CODES: readonly ["credit_bureau", "terms", "kyc_biometric", "aml"];
export type ConsentCodeValue = (typeof CONSENT_CODES)[number];
export type ConsentLocaleText = {
    en: string;
    ar: string;
};
export type ConsentDefinition = {
    code: ConsentCodeValue;
    version: string;
    title: ConsentLocaleText;
    summary: ConsentLocaleText;
    body: ConsentLocaleText;
};
export declare const CONSENT_CATALOG: Record<ConsentCodeValue, ConsentDefinition>;
export declare const CONSENT_CATALOG_VERSION = "2026-09-v1";
export declare function consentDefinition(code: string): ConsentDefinition | null;
export declare function isConsentCode(value: unknown): value is ConsentCodeValue;
export declare function consentFullText(def: ConsentDefinition, locale: 'en' | 'ar'): string;
export type ConsentAcceptance = {
    code: string;
    version: string;
};
export declare function missingConsents(accepted: ConsentAcceptance[]): ConsentCodeValue[];
