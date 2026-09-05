import type { InstallmentPlan, PaymentScheduleRow } from '../types/installment-plan';
import { generatePaymentScheduleFallback } from './generate-schedule';

export type DisplayScheduleRow = PaymentScheduleRow & {
  sequence?: number;
  source: 'plan' | 'live' | 'merged';
  /** Raw API status for live rows (`pending`, `overdue`, …); `status` is the display mapping. */
  liveStatus?: string;
  customerShare?: number;
  bloxShare?: number;
};

export type OpsPaymentScheduleDto = {
  id: string;
  sequence: number;
  due_date: string;
  amount: number | null;
  paid_amount?: number | null;
  remaining_amount?: number | null;
  status: string;
  paid_at?: string | null;
};

/**
 * Resolve rows for Installment Schedule tab — never blank during review.
 * Pre-active: installment_plan.schedule (with fallback generation).
 * Post-active: live payment_schedules merged with plan metadata.
 */
export function resolveDisplaySchedule(args: {
  installmentPlan?: InstallmentPlan | null;
  paymentSchedules?: OpsPaymentScheduleDto[] | null;
  vehiclePrice?: number;
  isActiveOrLater?: boolean;
}): DisplayScheduleRow[] {
  const plan = args.installmentPlan;
  const live = args.paymentSchedules ?? [];

  if (args.isActiveOrLater && live.length > 0) {
    return live.map((row) => ({
      id: row.id,
      sequence: row.sequence,
      dueDate: typeof row.due_date === 'string' ? row.due_date.slice(0, 10) : String(row.due_date),
      amount: Number(row.amount ?? 0),
      paidAmount: row.paid_amount != null ? Number(row.paid_amount) : undefined,
      remainingAmount: row.remaining_amount != null ? Number(row.remaining_amount) : undefined,
      status: mapLiveStatus(row.status),
      liveStatus: row.status,
      paidDate: row.paid_at ? String(row.paid_at).slice(0, 10) : undefined,
      source: 'live' as const,
    }));
  }

  let planRows: PaymentScheduleRow[] = [];
  if (plan?.schedule?.length) {
    planRows = plan.schedule;
  } else if (plan) {
    planRows = generatePaymentScheduleFallback({
      installmentPlan: plan,
      vehiclePrice: args.vehiclePrice,
    });
  }

  return planRows.map((row, index) => ({
    ...row,
    sequence: index + 1,
    source: 'plan' as const,
  }));
}

function mapLiveStatus(status: string): PaymentScheduleRow['status'] {
  switch (status) {
    case 'paid':
      return 'paid';
    case 'overdue':
      return 'due';
    case 'pending':
      return 'upcoming';
    default:
      return status as PaymentScheduleRow['status'];
  }
}

export function isPreActiveStatus(status: string): boolean {
  return ![
    'active',
    'completed',
    'cancelled',
    'rejected',
  ].includes(status);
}
