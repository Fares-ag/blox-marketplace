export declare const FALLBACK_LENDER_NAME = "Blox Finance";
export type LenderOfRecordInput = {
    taggedPartnerName?: string | null;
    offerPartnerName?: string | null;
    defaultLenderName?: string | null;
    configuredName?: string | null;
};
export declare function resolveLenderOfRecord(input: LenderOfRecordInput): string;
