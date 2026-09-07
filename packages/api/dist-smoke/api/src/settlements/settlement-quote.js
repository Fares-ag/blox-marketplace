"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.settlementRowsFrom = settlementRowsFrom;
exports.quoteForApplication = quoteForApplication;
exports.toSettlementQuoteDto = toSettlementQuoteDto;
exports.settlementRequestValues = settlementRequestValues;
exports.settlementSavings = settlementSavings;
const domain_rules_1 = require("@drivemarket/shared/domain-rules");
function asNumber(value) {
    if (value == null)
        return 0;
    const n = typeof value === 'object' ? value.toNumber() : Number(value);
    return Number.isFinite(n) ? n : 0;
}
function settlementRowsFrom(schedules) {
    return schedules.map((row) => ({
        sequence: row.sequence,
        dueDate: row.dueDate,
        amount: asNumber(row.amount),
        paidAmount: row.paidAmount == null ? null : asNumber(row.paidAmount),
        remainingAmount: row.remainingAmount == null ? null : asNumber(row.remainingAmount),
        status: row.status ?? null,
    }));
}
function quoteForApplication(source, asOf = new Date()) {
    const pricing = source.pricingSnapshot && typeof source.pricingSnapshot === 'object'
        ? source.pricingSnapshot
        : null;
    return (0, domain_rules_1.computeEarlySettlementQuote)({
        rows: settlementRowsFrom(source.paymentSchedules),
        pricingSnapshot: pricing,
        asOf,
        activatedAt: source.activatedAt ?? null,
    });
}
function toSettlementQuoteDto(quote) {
    return {
        as_of: quote.asOf,
        principal_outstanding: quote.principalOutstanding,
        accrued_profit: quote.accruedProfit,
        overdue_amount: quote.overdueAmount,
        forgiven_rent: quote.forgivenRent,
        settlement_amount: quote.settlementAmount,
        remaining_scheduled: quote.remainingScheduled,
        savings: quote.savings,
        rows: quote.rows.map((row) => ({
            sequence: row.sequence,
            due_date: row.dueDate,
            kind: row.kind,
            principal_outstanding: row.principalOutstanding,
            rent_outstanding: row.rentOutstanding,
            accrued_rent: row.accruedRent,
            forgiven_rent: row.forgivenRent,
        })),
    };
}
function settlementRequestValues(quote) {
    return {
        settlementAmount: quote.settlementAmount,
        remainingPrincipal: quote.principalOutstanding,
        forgivenRent: quote.forgivenRent,
        accruedProfit: quote.accruedProfit,
        quoteAsOf: new Date(quote.asOf),
    };
}
function settlementSavings(row) {
    return Math.round((asNumber(row.forgivenRent) + asNumber(row.discountAmount)) * 100) / 100;
}
//# sourceMappingURL=settlement-quote.js.map