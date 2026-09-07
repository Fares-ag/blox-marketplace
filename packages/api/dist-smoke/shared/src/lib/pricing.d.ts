export declare function roundMoney(amount: number): number;
export declare function toMinor(major: number): number;
export declare function fromMinor(minor: number): number;
export type MonthlyPaymentInput = {
    price: number;
    downPayment: number;
    annualRatePercent: number;
    tenureMonths: number;
};
export declare function computeExactMonthlyPayment(opts: MonthlyPaymentInput): number;
export declare function buildInstallmentAmounts(opts: MonthlyPaymentInput): number[];
export declare function estimateMonthlyPayment(opts: MonthlyPaymentInput): number;
export declare function sumInstallmentAmounts(amounts: number[]): number;
export declare function financedTotal(opts: MonthlyPaymentInput): number;
export type PricingInput = {
    listPrice: number;
    annualRatePercent: number;
    minDownPaymentPct: number;
    tenureMonths: number;
    downPaymentPct?: number;
};
export type PricingSnapshot = {
    list_price: number;
    down_payment: number;
    down_payment_pct: number;
    tenor: number;
    rate: number;
    monthly: number;
    financed_total: number;
};
export declare function clampDownPaymentPct(downPct: number, minDownPaymentPct: number, maxPct?: number): number;
export declare function buildPricingSnapshot(input: PricingInput): PricingSnapshot;
export declare function installmentAmountsFromPricingSnapshot(snapshot: Record<string, unknown>): number[];
export declare function paymentInputFromPricingSnapshot(snapshot: Record<string, unknown>): MonthlyPaymentInput;
export declare function buildPrincipalAmounts(opts: MonthlyPaymentInput): number[];
export declare function principalAmountsFromPricingSnapshot(snapshot: Record<string, unknown>): number[];
export declare function principalCollectedFromInstallment(paidAmount: number, scheduleAmount: number, scheduledPrincipal: number): number;
