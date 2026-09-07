"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CASH_LIKE_EVENT_TYPES = void 0;
exports.computeScheduleAmountsFromEvents = computeScheduleAmountsFromEvents;
const client_1 = require("@prisma/client");
const ZERO = new client_1.Prisma.Decimal(0);
exports.CASH_LIKE_EVENT_TYPES = new Set([
    client_1.PaymentEventType.installment,
    client_1.PaymentEventType.down_payment,
    client_1.PaymentEventType.blox_credits,
]);
async function computeScheduleAmountsFromEvents(tx, scheduleId, scheduleAmount) {
    const events = await tx.paymentEvent.findMany({
        where: { scheduleId },
        orderBy: { createdAt: 'asc' },
    });
    let cashPaid = ZERO;
    let waived = ZERO;
    for (const event of events) {
        if (exports.CASH_LIKE_EVENT_TYPES.has(event.type)) {
            cashPaid = cashPaid.add(event.amount);
        }
        else if (event.type === client_1.PaymentEventType.reversal) {
            cashPaid = cashPaid.sub(event.amount);
        }
        else if (event.type === client_1.PaymentEventType.waive) {
            waived = waived.add(event.amount);
        }
    }
    if (waived.gt(0)) {
        return { paidAmount: scheduleAmount, remainingAmount: ZERO };
    }
    let remaining = scheduleAmount.sub(cashPaid);
    if (remaining.lessThan(ZERO)) {
        remaining = ZERO;
    }
    return { paidAmount: cashPaid, remainingAmount: remaining };
}
//# sourceMappingURL=payment-ledger.js.map