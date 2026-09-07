"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildScheduleDraftsFromInstallmentPlan = buildScheduleDraftsFromInstallmentPlan;
exports.buildScheduleDrafts = buildScheduleDrafts;
const pricing_1 = require("@drivemarket/shared/pricing");
function parseDueDate(value) {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) {
        throw new Error('invalid_schedule_due_date');
    }
    return d;
}
function installmentRowsFromPlan(plan) {
    return (plan.schedule ?? []).filter((row) => row.paymentType !== 'down_payment' &&
        !row.isBalloon &&
        (Number(row.amount) || 0) > 0);
}
function buildScheduleDraftsFromInstallmentPlan(plan) {
    const rows = installmentRowsFromPlan(plan);
    if (rows.length === 0) {
        throw new Error('empty_installment_plan_schedule');
    }
    return rows.map((row, index) => ({
        sequence: index + 1,
        dueDate: parseDueDate(row.dueDate),
        amount: Number(row.amount),
    }));
}
function buildScheduleDrafts(pricingSnapshot, start = new Date(), installmentPlan) {
    if (installmentPlan?.schedule?.length) {
        try {
            return buildScheduleDraftsFromInstallmentPlan(installmentPlan);
        }
        catch {
        }
    }
    const monthly = Number(pricingSnapshot.monthly);
    const tenorHint = Number(pricingSnapshot.tenor ?? pricingSnapshot.tenure ?? 0);
    if (!(monthly > 0) || !(tenorHint > 0)) {
        throw new Error('invalid_pricing_snapshot');
    }
    const amounts = (0, pricing_1.installmentAmountsFromPricingSnapshot)(pricingSnapshot);
    const tenor = amounts.length;
    if (tenor <= 0) {
        throw new Error('invalid_pricing_snapshot');
    }
    const drafts = [];
    for (let sequence = 1; sequence <= tenor; sequence += 1) {
        const dueDate = new Date(start);
        dueDate.setUTCMonth(dueDate.getUTCMonth() + sequence);
        drafts.push({ sequence, dueDate, amount: amounts[sequence - 1] });
    }
    return drafts;
}
//# sourceMappingURL=payment-schedules.js.map