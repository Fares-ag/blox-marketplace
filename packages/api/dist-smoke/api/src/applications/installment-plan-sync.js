"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncPaymentSchedulesFromInstallmentPlan = syncPaymentSchedulesFromInstallmentPlan;
exports.convertInstallmentPlanDailyToMonthly = convertInstallmentPlanDailyToMonthly;
const installment_plan_utils_1 = require("@drivemarket/shared/installment-plan-utils");
const payment_schedules_1 = require("./payment-schedules");
async function syncPaymentSchedulesFromInstallmentPlan(tx, applicationId, pricingSnapshot, installmentPlan, opts) {
    const replaceExisting = opts?.replaceExisting ?? true;
    const drafts = (0, payment_schedules_1.buildScheduleDrafts)(pricingSnapshot, new Date(), installmentPlan ?? undefined);
    if (replaceExisting) {
        await tx.paymentSchedule.deleteMany({ where: { applicationId } });
    }
    await tx.paymentSchedule.createMany({
        data: drafts.map((s) => ({
            applicationId,
            sequence: s.sequence,
            dueDate: s.dueDate,
            amount: s.amount,
            paidAmount: 0,
            remainingAmount: s.amount,
            status: 'pending',
        })),
    });
}
function convertInstallmentPlanDailyToMonthly(plan) {
    const monthlySchedule = (0, installment_plan_utils_1.aggregateDailyScheduleToMonthly)(plan.schedule ?? []);
    return {
        ...plan,
        interval: 'Monthly',
        schedule: monthlySchedule,
        monthlyAmount: monthlySchedule[0]?.amount ?? plan.monthlyAmount,
    };
}
//# sourceMappingURL=installment-plan-sync.js.map