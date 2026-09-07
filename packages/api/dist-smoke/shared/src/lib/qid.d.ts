import type { ResidencyClass } from './product-rules';
export declare const QID_LENGTH = 11;
export declare const QATAR_NUMERIC_CODE = "634";
export declare const ISO_NUMERIC_COUNTRIES: Record<string, {
    en: string;
    ar: string;
    alpha2: string;
}>;
export type ParsedQid = {
    valid: boolean;
    qid: string | null;
    birthYear: number | null;
    nationalityCode: string | null;
    nationality: {
        en: string;
        ar: string;
        alpha2: string;
    } | null;
    residency: ResidencyClass | null;
    reason?: 'length' | 'digits' | 'century' | 'year';
};
export declare function normalizeQid(raw: string | null | undefined): string;
export declare function parseQid(raw: string | null | undefined, now?: Date): ParsedQid;
export declare function dateOfBirthMatchesQid(dateOfBirth: string | null | undefined, qid: string | null | undefined): boolean | null;
export declare function ageFromDateOfBirth(dateOfBirth: string | null | undefined, now?: Date): number | null;
