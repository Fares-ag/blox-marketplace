"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeEarlySettlementQuote = computeEarlySettlementQuote;
const pricing_1 = require("./pricing");
const DAY_MS = 24 * 60 * 60 * 1000;
function asDate(value) {
    return value instanceof Date ? value : new Date(value);
}
function monthBefore(date) {
    const d = new Date(date);
    d.setMonth(d.getMonth() - 1);
    return d;
}
function scheduledPrincipals(rows, pricingSnapshot) {
    const fromSnapshot = pricingSnapshot ? safePrincipals(pricingSnapshot) : [];
    if (fromSnapshot.length === rows.length)
        return fromSnapshot;
    const total = rows.reduce((sum, r) => sum + Number(r.amount || 0), 0);
    const financed = Number(pricingSnapshot?.financed_amount ?? pricingSnapshot?.financedAmount ?? NaN);
    const principalTotal = Number.isFinite(financed) && financed > 0 ? financed : fromSnapshot.reduce((a, b) => a + b, 0);
    if (!(principalTotal > 0) || !(total > 0))
        return rows.map((r) => Number(r.amount || 0));
    return rows.map((r) => (0, pricing_1.roundMoney)((Number(r.amount || 0) / total) * principalTotal));
}
function safePrincipals(snapshot) {
    try {
        return (0, pricing_1.principalAmountsFromPricingSnapshot)(snapshot);
    }
    catch {
        return [];
    }
}
function computeEarlySettlementQuote(input) {
    const asOf = input.asOf ?? new Date();
    const rows = [...input.rows].sort((a, b) => a.sequence - b.sequence);
    const principals = scheduledPrincipals(rows, input.pricingSnapshot);
    let principalOutstanding = 0;
    let accruedProfit = 0;
    let overdueAmount = 0;
    let forgivenRent = 0;
    let remainingScheduled = 0;
    const breakdown = [];
    rows.forEach((row, i) => {
        const amount = Number(row.amount || 0);
        const remaining = Math.max(0, Number(row.remainingAmount ?? amount - Number(row.paidAmount ?? 0)));
        const dueDate = asDate(row.dueDate);
        const unpaidFraction = amount > 0 ? Math.min(1, remaining / amount) : 0;
        const scheduledPrincipal = Math.min(principals[i] ?? 0, amount);
        const scheduledRent = Math.max(0, amount - scheduledPrincipal);
        const rowPrincipal = (0, pricing_1.roundMoney)(scheduledPrincipal * unpaidFraction);
        const rowRent = (0, pricing_1.roundMoney)(scheduledRent * unpaidFraction);
        remainingScheduled += remaining;
        let kind = 'future';
        let accrued = 0;
        if (remaining <= 0) {
            kind = 'settled';
        }
        else if (dueDate.getTime() <= asOf.getTime()) {
            kind = 'overdue';
            accrued = rowRent;
            overdueAmount += remaining;
        }
        else {
            const periodStart = i > 0 ? asDate(rows[i - 1].dueDate) : input.activatedAt ? asDate(input.activatedAt) : monthBefore(dueDate);
            if (asOf.getTime() > periodStart.getTime()) {
                kind = 'current';
                const periodDays = Math.max(1, (dueDate.getTime() - periodStart.getTime()) / DAY_MS);
                const elapsedDays = Math.min(periodDays, (asOf.getTime() - periodStart.getTime()) / DAY_MS);
                accrued = (0, pricing_1.roundMoney)(rowRent * (elapsedDays / periodDays));
            }
        }
        if (kind !== 'settled') {
            principalOutstanding += rowPrincipal;
            accruedProfit += accrued;
            forgivenRent += (0, pricing_1.roundMoney)(rowRent - accrued);
        }
        breakdown.push({
            sequence: row.sequence,
            dueDate: dueDate.toISOString().slice(0, 10),
            kind,
            principalOutstanding: kind === 'settled' ? 0 : rowPrincipal,
            rentOutstanding: kind === 'settled' ? 0 : rowRent,
            accruedRent: accrued,
            forgivenRent: kind === 'settled' ? 0 : (0, pricing_1.roundMoney)(rowRent - accrued),
        });
    });
    const settlementAmount = (0, pricing_1.roundMoney)(principalOutstanding + accruedProfit);
    return {
        asOf: asOf.toISOString(),
        principalOutstanding: (0, pricing_1.roundMoney)(principalOutstanding),
        accruedProfit: (0, pricing_1.roundMoney)(accruedProfit),
        overdueAmount: (0, pricing_1.roundMoney)(overdueAmount),
        forgivenRent: (0, pricing_1.roundMoney)(forgivenRent),
        settlementAmount,
        remainingScheduled: (0, pricing_1.roundMoney)(remainingScheduled),
        savings: (0, pricing_1.roundMoney)(Math.max(0, remainingScheduled - settlementAmount)),
        rows: breakdown,
    };
}
//# sourceMappingURL=settlement.js.map