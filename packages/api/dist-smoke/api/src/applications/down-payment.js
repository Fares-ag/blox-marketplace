"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requiredDownPaymentAmount = requiredDownPaymentAmount;
exports.sumDownPaymentRecorded = sumDownPaymentRecorded;
exports.assertDownPaymentSatisfied = assertDownPaymentSatisfied;
exports.assertDownPaymentRecordedForDirectActivation = assertDownPaymentRecordedForDirectActivation;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const ZERO = new client_1.Prisma.Decimal(0);
function requiredDownPaymentAmount(pricingSnapshot) {
    const fromSnapshot = pricingSnapshot.down_payment;
    if (fromSnapshot != null && Number.isFinite(Number(fromSnapshot))) {
        return new client_1.Prisma.Decimal(String(fromSnapshot));
    }
    const listPrice = Number(pricingSnapshot.list_price ?? 0);
    const pct = Number(pricingSnapshot.down_payment_pct ?? 0);
    if (!Number.isFinite(listPrice) || !Number.isFinite(pct)) {
        return ZERO;
    }
    return new client_1.Prisma.Decimal(listPrice).mul(pct).div(100);
}
async function sumDownPaymentRecorded(db, applicationId) {
    const events = await db.paymentEvent.findMany({
        where: { applicationId, type: client_1.PaymentEventType.down_payment },
        select: { amount: true },
    });
    return events.reduce((total, event) => total.add(event.amount), ZERO);
}
function assertDownPaymentSatisfied(required, recorded) {
    if (recorded.gte(required))
        return;
    throw new common_1.BadRequestException('down_payment_incomplete');
}
async function assertDownPaymentRecordedForDirectActivation(db, applicationId, pricingSnapshot) {
    const required = requiredDownPaymentAmount(pricingSnapshot);
    if (required.lte(0))
        return;
    const recorded = await sumDownPaymentRecorded(db, applicationId);
    if (recorded.lt(required)) {
        throw new common_1.BadRequestException('down_payment_required_before_activation');
    }
}
//# sourceMappingURL=down-payment.js.map