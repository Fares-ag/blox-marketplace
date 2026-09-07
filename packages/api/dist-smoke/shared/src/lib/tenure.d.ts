export declare const MIN_TENURE_MONTHS = 3;
export declare const MAX_TENURE_MONTHS = 60;
export declare const TENURE_PRESET_MONTHS: readonly [12, 24, 36, 48, 60];
export declare function isTenureInRange(months: number): boolean;
export declare function clampTenureMonths(months: number): number;
export declare function parseTenureToMonths(tenureStr: string): number;
export declare function formatMonthsToTenure(months: number): string;
