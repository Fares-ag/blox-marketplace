import { type EarlySettlementQuote, type SettlementScheduleRow } from "@drivemarket/shared/domain-rules";
type DecimalLike = {
    toNumber(): number;
} | number | string | null | undefined;
export type SettlementQuoteRowDto = {
    sequence: number;
    due_date: string;
    kind: 'settled' | 'overdue' | 'current' | 'future';
    principal_outstanding: number;
    rent_outstanding: number;
    accrued_rent: number;
    forgiven_rent: number;
};
export type SettlementQuoteDto = {
    as_of: string;
    principal_outstanding: number;
    accrued_profit: number;
    overdue_amount: number;
    forgiven_rent: number;
    settlement_amount: number;
    remaining_scheduled: number;
    savings: number;
    rows: SettlementQuoteRowDto[];
};
export type SettlementScheduleSource = {
    sequence: number;
    dueDate: Date | string;
    amount: DecimalLike;
    paidAmount?: DecimalLike;
    remainingAmount?: DecimalLike;
    status?: string | null;
};
export type SettlementQuoteSource = {
    paymentSchedules: SettlementScheduleSource[];
    pricingSnapshot: unknown;
    activatedAt?: Date | string | null;
};
export declare function settlementRowsFrom(schedules: SettlementScheduleSource[]): SettlementScheduleRow[];
export declare function quoteForApplication(source: SettlementQuoteSource, asOf?: Date): EarlySettlementQuote;
export declare function toSettlementQuoteDto(quote: EarlySettlementQuote): SettlementQuoteDto;
export declare function settlementRequestValues(quote: EarlySettlementQuote): {
    settlementAmount: number;
    remainingPrincipal: number;
    forgivenRent: number;
    accruedProfit: number;
    quoteAsOf: Date;
};
export declare function settlementSavings(row: {
    forgivenRent: DecimalLike;
    discountAmount?: DecimalLike;
}): number;
export {};
