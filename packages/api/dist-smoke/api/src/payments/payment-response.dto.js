"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toPaymentScheduleDto = toPaymentScheduleDto;
exports.toPaymentTransactionDto = toPaymentTransactionDto;
function toPaymentScheduleDto(s) {
    return {
        id: s.id,
        application_id: s.applicationId,
        sequence: s.sequence,
        due_date: s.dueDate.toISOString().slice(0, 10),
        amount: Number(s.amount),
        paid_amount: Number(s.paidAmount),
        remaining_amount: Number(s.remainingAmount),
        status: s.status,
        payment_method: s.paymentMethod,
        payment_reference: s.paymentReference,
        paid_at: s.paidAt?.toISOString() ?? null,
        pending_waive_reason: s.pendingWaiveReason ?? null,
        pending_waive_requested_by_id: s.pendingWaiveRequestedById ?? null,
        pending_waive_requested_at: s.pendingWaiveRequestedAt?.toISOString() ?? null,
    };
}
function toPaymentTransactionDto(txn) {
    return {
        id: txn.id,
        idempotency_key: txn.idempotencyKey,
        application_id: txn.applicationId,
        schedule_id: txn.scheduleId,
        amount: Number(txn.amount),
        status: txn.status,
        gateway_payment_id: txn.gatewayPaymentId,
        created_at: txn.createdAt,
        updated_at: txn.updatedAt,
    };
}
//# sourceMappingURL=payment-response.dto.js.map