import {
  principalAmountsFromPricingSnapshot,
  principalCollectedFromInstallment,
  roundMoney,
} from './pricing';

export type OwnershipMilestoneKind =
  | 'first_payment'
  | 'quarter'
  | 'halfway'
  | 'three_quarters'
  | 'almost_there'
  | 'full_owner';

export type OwnershipScheduleInput = {
  sequence: number;
  dueDate: string;
  amount: number | string;
  paid_amount?: number | string;
  paidAmount?: number | string;
  status: string;
};

export type PaymentLedgerEventInput = {
  type: 'installment' | 'down_payment' | 'reversal' | 'waive';
  amount: number | string;
  schedule_id?: string | null;
  scheduleId?: string | null;
  principal_amount?: number | string;
  principalAmount?: number | string;
};

export type OwnershipMilestone = {
  sequence: number;
  milestone: OwnershipMilestoneKind;
  labelKey: string;
  paymentStatus: 'paid' | 'missed' | 'scheduled';
  date: string;
  dueDate?: string;
  amount?: number;
  ownershipPercentage: number;
  ownershipAmount: number;
  customerShare: number;
  bloxShare: number;
};

export type OwnershipTimeline = {
  vehiclePrice: number;
  downPayment: number;
  totalPayments: number;
  paidPayments: number;
  completedPayments: number;
  currentOwnership: number;
  currentOwnershipAmount: number;
  progressPercentage: number;
  estimatedCompletionDate: string | null;
  projected: boolean;
  hasOverdue: boolean;
  milestones: OwnershipMilestone[];
};

function num(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function schedulePaidAmount(schedule: OwnershipScheduleInput): number {
  return num(schedule.paidAmount ?? schedule.paid_amount);
}

function eventPrincipalAmount(event: PaymentLedgerEventInput): number | null {
  const raw = event.principalAmount ?? event.principal_amount;
  if (raw == null) return null;
  const parsed = num(raw, Number.NaN);
  return Number.isFinite(parsed) ? parsed : null;
}

function eventScheduleId(event: PaymentLedgerEventInput): string | null {
  return event.scheduleId ?? event.schedule_id ?? null;
}

function milestoneKindForProgress(pct: number, index: number): OwnershipMilestoneKind {
  if (pct >= 100) return 'full_owner';
  if (pct >= 95) return 'almost_there';
  if (pct >= 75) return 'three_quarters';
  if (pct >= 50) return 'halfway';
  if (pct >= 25) return 'quarter';
  if (index === 0 || pct > 0) return 'first_payment';
  return 'first_payment';
}

function paymentStatusForSchedule(status: string, dueDate: string): OwnershipMilestone['paymentStatus'] {
  if (status === 'paid') return 'paid';
  if (status === 'overdue') return 'missed';
  const due = new Date(dueDate);
  if (!Number.isNaN(due.getTime()) && due < new Date()) return 'missed';
  return 'scheduled';
}

function ownershipPct(vehiclePrice: number, ownershipAmount: number): number {
  if (vehiclePrice <= 0) return 0;
  return Math.min(100, roundMoney((ownershipAmount / vehiclePrice) * 100));
}

function sumCollectedPrincipalFromEvents(
  paymentEvents: PaymentLedgerEventInput[],
  schedules: Array<OwnershipScheduleInput & { id?: string }>,
  principalBySequence: number[],
): number {
  const scheduleById = new Map(
    schedules.filter((s) => s.id).map((s) => [s.id as string, s]),
  );
  let collected = 0;

  for (const event of paymentEvents) {
    const amount = num(event.amount);
    if (amount <= 0) continue;

    if (event.type === 'installment') {
      const explicitPrincipal = eventPrincipalAmount(event);
      if (explicitPrincipal != null) {
        collected += explicitPrincipal;
        continue;
      }

      const scheduleId = eventScheduleId(event);
      const schedule = scheduleId ? scheduleById.get(scheduleId) : undefined;
      if (!schedule) continue;

      const scheduledPrincipal = principalBySequence[schedule.sequence - 1] ?? 0;
      collected += principalCollectedFromInstallment(
        amount,
        num(schedule.amount),
        scheduledPrincipal,
      );
      continue;
    }

    if (event.type === 'reversal') {
      const explicitPrincipal = eventPrincipalAmount(event);
      if (explicitPrincipal != null) {
        collected -= explicitPrincipal;
        continue;
      }

      const scheduleId = eventScheduleId(event);
      const schedule = scheduleId ? scheduleById.get(scheduleId) : undefined;
      if (!schedule) continue;

      const scheduledPrincipal = principalBySequence[schedule.sequence - 1] ?? 0;
      collected -= principalCollectedFromInstallment(
        amount,
        num(schedule.amount),
        scheduledPrincipal,
      );
    }
  }

  return Math.max(0, roundMoney(collected));
}

function sumCollectedPrincipalFromSchedules(
  schedules: OwnershipScheduleInput[],
  principalBySequence: number[],
): number {
  let collected = 0;

  for (const schedule of schedules) {
    const paidAmount = schedulePaidAmount(schedule);
    if (paidAmount <= 0) continue;

    const scheduledPrincipal = principalBySequence[schedule.sequence - 1] ?? 0;
    collected += principalCollectedFromInstallment(
      paidAmount,
      num(schedule.amount),
      scheduledPrincipal,
    );
  }

  return roundMoney(collected);
}

function resolveDownPaymentEquity(
  pricingSnapshot: Record<string, unknown> | null | undefined,
  paymentEvents?: PaymentLedgerEventInput[] | null,
): number {
  if (paymentEvents?.length) {
    let recorded = 0;
    for (const event of paymentEvents) {
      if (event.type !== 'down_payment') continue;
      recorded += num(event.amount);
    }
    if (recorded > 0) {
      return roundMoney(recorded);
    }
  }
  return roundMoney(num(pricingSnapshot?.down_payment));
}

export function calculateOwnershipTimeline(
  pricingSnapshot?: Record<string, unknown> | null,
  paymentSchedules?: Array<OwnershipScheduleInput & { id?: string }> | null,
  paymentEvents?: PaymentLedgerEventInput[] | null,
): OwnershipTimeline {
  const vehiclePrice = roundMoney(num(pricingSnapshot?.list_price));
  const downPayment = resolveDownPaymentEquity(pricingSnapshot, paymentEvents);
  const schedules = [...(paymentSchedules ?? [])].sort((a, b) => a.sequence - b.sequence);
  const totalPayments = schedules.length;
  const completedPayments = schedules.filter((s) => s.status === 'paid').length;

  const principalBySequence = pricingSnapshot
    ? principalAmountsFromPricingSnapshot(pricingSnapshot)
    : (() => {
        const loan = Math.max(vehiclePrice - downPayment, 0);
        if (schedules.length <= 0 || loan <= 0) return [] as number[];
        const linear = roundMoney(loan / schedules.length);
        return schedules.map((_, index) =>
          index === schedules.length - 1
            ? roundMoney(loan - linear * (schedules.length - 1))
            : linear,
        );
      })();

  const installmentPrincipalCollected = paymentEvents?.length
    ? sumCollectedPrincipalFromEvents(paymentEvents, schedules, principalBySequence)
    : sumCollectedPrincipalFromSchedules(schedules, principalBySequence);

  const currentOwnershipAmount = roundMoney(downPayment + installmentPrincipalCollected);
  const currentOwnership = ownershipPct(vehiclePrice, currentOwnershipAmount);
  const progressPercentage = currentOwnership;

  const hasOverdue = schedules.some(
    (s) => s.status === 'overdue' || (s.status !== 'paid' && new Date(s.dueDate) < new Date()),
  );

  let cumulativePrincipal = 0;
  const milestones: OwnershipMilestone[] = schedules.map((schedule, index) => {
    const scheduledPrincipal = principalBySequence[schedule.sequence - 1] ?? 0;
    cumulativePrincipal = roundMoney(cumulativePrincipal + scheduledPrincipal);
    const ownershipAmount = roundMoney(downPayment + cumulativePrincipal);
    const ownershipPercentage = ownershipPct(vehiclePrice, ownershipAmount);
    const kind = milestoneKindForProgress(ownershipPercentage, index);
    const paymentStatus = paymentStatusForSchedule(schedule.status, schedule.dueDate);
    const amount = num(schedule.amount);
    const profitShare = roundMoney(Math.max(amount - scheduledPrincipal, 0));

    return {
      sequence: schedule.sequence,
      milestone: kind,
      labelKey:
        kind === 'first_payment' && index === 0
          ? 'ownership.paymentNumber'
          : milestoneBadgeKey(kind),
      paymentStatus,
      date: schedule.dueDate,
      dueDate: schedule.dueDate,
      amount,
      ownershipPercentage,
      ownershipAmount,
      customerShare: roundMoney(scheduledPrincipal),
      bloxShare: profitShare,
    };
  });

  const lastSchedule = schedules[schedules.length - 1];
  const estimatedCompletionDate = lastSchedule?.dueDate ?? null;
  const projected = totalPayments > 0 && completedPayments < totalPayments;

  return {
    vehiclePrice,
    downPayment,
    totalPayments,
    paidPayments: completedPayments,
    completedPayments,
    currentOwnership,
    currentOwnershipAmount,
    progressPercentage,
    estimatedCompletionDate,
    projected,
    hasOverdue,
    milestones,
  };
}

function milestoneBadgeKey(kind: OwnershipMilestoneKind): string {
  const map: Record<OwnershipMilestoneKind, string> = {
    first_payment: 'ownership.milestoneFirstPayment',
    quarter: 'ownership.milestone25',
    halfway: 'ownership.milestone50',
    three_quarters: 'ownership.milestone75',
    almost_there: 'ownership.milestone95',
    full_owner: 'ownership.milestone100',
  };
  return map[kind];
}

const KEY_KINDS: OwnershipMilestoneKind[] = [
  'first_payment',
  'quarter',
  'halfway',
  'three_quarters',
  'almost_there',
  'full_owner',
];

export function filterKeyMilestones(milestones: OwnershipMilestone[]): OwnershipMilestone[] {
  const seen = new Set<OwnershipMilestoneKind>();
  const result: OwnershipMilestone[] = [];
  for (const m of milestones) {
    if (!KEY_KINDS.includes(m.milestone) || seen.has(m.milestone)) continue;
    seen.add(m.milestone);
    result.push(m);
  }
  return result;
}
