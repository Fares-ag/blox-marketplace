"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BLOX_CREDITS_WALLET_ACTION = exports.BLOX_CREDITS_REFERENCE_PREFIX = void 0;
exports.bloxCreditsReference = bloxCreditsReference;
exports.buildBloxCreditsLedgerEntry = buildBloxCreditsLedgerEntry;
const client_1 = require("@prisma/client");
exports.BLOX_CREDITS_REFERENCE_PREFIX = 'CR-';
exports.BLOX_CREDITS_WALLET_ACTION = 'pay_installment';
function bloxCreditsReference(creditTransactionId) {
    return `${exports.BLOX_CREDITS_REFERENCE_PREFIX}${creditTransactionId}`;
}
function buildBloxCreditsLedgerEntry(input) {
    const reference = bloxCreditsReference(input.creditTransactionId);
    const label = input.scheduleSequence != null ? `installment #${input.scheduleSequence}` : `schedule ${input.scheduleId}`;
    return {
        reference,
        description: `Blox credits applied to ${label} of application ${input.applicationId} (${reference})`,
        paymentEvent: {
            applicationId: input.applicationId,
            scheduleId: input.scheduleId,
            type: client_1.PaymentEventType.blox_credits,
            amount: new client_1.Prisma.Decimal(input.amount.toFixed(2)),
            currency: 'QAR',
            actorUserId: input.actorUserId,
            reason: 'blox_credits',
            metadata: { reference, credits_debited: input.amount },
        },
    };
}
//# sourceMappingURL=credits-ledger.js.map