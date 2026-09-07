export type ContractScheduleRow = {
    sequence: number;
    dueDate: string;
    payment: number;
    principal: number;
    interest: number;
    balance: number;
};
export type ContractPdfInput = {
    applicationId: string;
    approvedAt: string;
    customerName: string;
    customerEmail: string;
    customerPhone: string;
    customerQid: string;
    vehicleLabel: string;
    dealerName: string;
    listPrice: number;
    downPayment: number;
    downPaymentPct: number;
    monthly: number;
    tenor: number;
    annualRate: number;
    financedTotal: number;
    lenderName: string;
    schedule: ContractScheduleRow[];
};
export type ContractPdfResult = {
    buffer: Buffer;
    contentSha256: string;
};
export declare function hashContractContent(input: ContractPdfInput): string;
export declare function verifySignedContractReferencesOriginal(signedPdf: Buffer, expectedContentSha256: string, applicationId: string): Promise<boolean>;
export declare function buildContractAmortizationSchedule(pricingSnapshot: Record<string, unknown>, approvedAt: Date): ContractScheduleRow[];
export type ContractLine = {
    text: string;
    bold?: boolean;
    size?: number;
    gap?: number;
};
export declare function contractTrailerLines(contentSha256: string): string[];
export declare function buildContractLines(input: ContractPdfInput): ContractLine[];
export declare function contractTextFor(input: ContractPdfInput): string;
export declare function buildContractPdf(input: ContractPdfInput): Promise<ContractPdfResult>;
export declare function resolveFinancedTotal(pricingSnapshot: Record<string, unknown>): number;
