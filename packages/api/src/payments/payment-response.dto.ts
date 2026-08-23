import type { PaymentTransaction, Prisma, ScheduleStatus } from '@prisma/client';

export function toPaymentScheduleDto(s: {
  id: string;
  applicationId: string;
  sequence: number;
  dueDate: Date;
  amount: Prisma.Decimal;
  paidAmount: Prisma.Decimal;
  remainingAmount: Prisma.Decimal;
  status: ScheduleStatus;
  paymentMethod: string | null;
  paymentReference: string | null;
  paidAt: Date | null;
  pendingWaiveReason?: string | null;
  pendingWaiveRequestedById?: string | null;
  pendingWaiveRequestedAt?: Date | null;
}) {
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

export function toPaymentTransactionDto(txn: PaymentTransaction) {
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
