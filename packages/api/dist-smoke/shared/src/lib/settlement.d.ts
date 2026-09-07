export type SettlementScheduleRow = {
    sequence: number;
    dueDate: string | Date;
    amount: number;
    paidAmount?: number | null;
    remainingAmount?: number | null;
    status?: string | null;
};
export type SettlementRowBreakdown = {
    sequence: number;
    dueDate: string;
    kind: 'settled' | 'overdue' | 'current' | 'future';
    principalOutstanding: number;
    rentOutstanding: number;
    accruedRent: number;
    forgivenRent: number;
};
export type EarlySettlementQuote = {
    asOf: string;
    principalOutstanding: number;
    accruedProfit: number;
    overdueAmount: number;
    forgivenRent: number;
    settlementAmount: number;
    remainingScheduled: number;
    savings: number;
    rows: SettlementRowBreakdown[];
};
export declare function computeEarlySettlementQuote(input: {
    rows: SettlementScheduleRow[];
    pricingSnapshot?: Record<string, unknown> | null;
    asOf?: Date;
    activatedAt?: Date | string | null;
}): EarlySettlementQuote;
