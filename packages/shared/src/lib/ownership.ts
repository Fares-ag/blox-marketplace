import { addMonths, firstInstallmentDueFrom, formatDateYmd } from './date-utils';
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
  paid_at?: string | Date | null;
  paidAt?: string | Date | null;
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
  paymentStatus: 'paid' | 'waived' | 'missed' | 'scheduled';
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
  remainingPayments: number;
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

function isClosedScheduleStatus(status: string): boolean {
  return status === 'paid' || status === 'waived';
}

function scheduleClosedAt(schedule: OwnershipScheduleInput): string | null {
  const raw = schedule.paidAt ?? schedule.paid_at;
  if (raw == null || raw === '') return null;
  if (raw instanceof Date) return Number.isNaN(raw.getTime()) ? null : raw.toISOString();
  return String(raw);
}

function latestClosedAt(schedules: OwnershipScheduleInput[]): string | null {
  let latest: string | null = null;
  let latestTime = Number.NEGATIVE_INFINITY;
  for (const schedule of schedules) {
    if (!isClosedScheduleStatus(schedule.status)) continue;
    const raw = scheduleClosedAt(schedule) ?? schedule.dueDate;
    const time = new Date(raw).getTime();
    if (Number.isNaN(time) || time < latestTime) continue;
    latestTime = time;
    latest = raw;
  }
  return latest;
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
  if (status === 'waived') return 'waived';
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
  const openPayments = schedules.filter((s) => !isClosedScheduleStatus(s.status)).length;

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

  const scheduleComplete = openPayments === 0 && totalPayments > 0;
  const ownershipComplete = currentOwnership >= 100 || scheduleComplete;
  const remainingPayments = ownershipComplete ? 0 : openPayments;
  const hasOverdue =
    remainingPayments > 0 &&
    schedules.some(
      (s) =>
        !isClosedScheduleStatus(s.status) &&
        (s.status === 'overdue' || new Date(s.dueDate) < new Date()),
    );

  let cumulativePrincipal = 0;
  const milestones: OwnershipMilestone[] = schedules.map((schedule, index) => {
    const scheduledPrincipal = principalBySequence[schedule.sequence - 1] ?? 0;
    cumulativePrincipal = roundMoney(cumulativePrincipal + scheduledPrincipal);
    const ownershipAmount = roundMoney(downPayment + cumulativePrincipal);
    const ownershipPercentage = ownershipPct(vehiclePrice, ownershipAmount);
    const isLast = index === schedules.length - 1;
    const kind =
      isLast && ownershipComplete ? 'full_owner' : milestoneKindForProgress(ownershipPercentage, index);
    let paymentStatus = paymentStatusForSchedule(schedule.status, schedule.dueDate);
    if (ownershipComplete && paymentStatus !== 'paid' && paymentStatus !== 'waived') {
      paymentStatus = 'waived';
    }
    const amount = num(schedule.amount);
    const profitShare = roundMoney(Math.max(amount - scheduledPrincipal, 0));
    const closedAt = scheduleClosedAt(schedule);
    const date = paymentStatus === 'waived' && closedAt ? closedAt : schedule.dueDate;

    return {
      sequence: schedule.sequence,
      milestone: kind,
      labelKey:
        kind === 'first_payment' && index === 0
          ? 'ownership.paymentNumber'
          : milestoneBadgeKey(kind),
      paymentStatus,
      date,
      dueDate: schedule.dueDate,
      amount,
      ownershipPercentage: isLast && ownershipComplete ? 100 : ownershipPercentage,
      ownershipAmount: isLast && ownershipComplete ? vehiclePrice : ownershipAmount,
      customerShare: roundMoney(scheduledPrincipal),
      bloxShare: profitShare,
    };
  });

  const lastSchedule = schedules[schedules.length - 1];
  const estimatedCompletionDate =
    remainingPayments === 0
      ? (latestClosedAt(schedules) ?? lastSchedule?.dueDate ?? null)
      : (lastSchedule?.dueDate ?? null);
  const projected = remainingPayments > 0;

  return {
    vehiclePrice,
    downPayment,
    totalPayments,
    paidPayments: completedPayments,
    completedPayments,
    remainingPayments,
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

export function overlayRegisterOnTimeline(
  timeline: OwnershipTimeline,
  register?: { customerUnits: number; totalUnits: number } | null,
): OwnershipTimeline {
  if (!register || register.totalUnits <= 0) return timeline;
  const currentOwnership = Math.min(100, roundMoney((register.customerUnits / register.totalUnits) * 100));
  const currentOwnershipAmount = roundMoney((currentOwnership / 100) * timeline.vehiclePrice);
  const complete = currentOwnership >= 100;
  return {
    ...timeline,
    currentOwnership,
    currentOwnershipAmount,
    progressPercentage: currentOwnership,
    ...(complete
      ? {
          remainingPayments: 0,
          projected: false,
          hasOverdue: false,
          milestones: timeline.milestones.map((milestone, index, rows) => {
            const isLast = index === rows.length - 1;
            const paymentStatus =
              milestone.paymentStatus === 'paid' || milestone.paymentStatus === 'waived'
                ? milestone.paymentStatus
                : 'waived';
            return {
              ...milestone,
              paymentStatus,
              milestone: isLast ? 'full_owner' : milestone.milestone,
              ownershipPercentage: isLast ? 100 : milestone.ownershipPercentage,
              ownershipAmount: isLast ? timeline.vehiclePrice : milestone.ownershipAmount,
            };
          }),
        }
      : {}),
  };
}

function parseInstant(value: string | Date | null | undefined): Date | null {
  if (value == null || value === '') return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Date the customer-facing ownership plan is anchored to.
 * Live financing uses activation; a submitted application uses submit time.
 * Drafts (no submit yet) use "now" so a month-old draft is not dated from when it was started.
 */
export function ownershipPlanAnchorDate(app: {
  activatedAt?: string | Date | null;
  submittedAt?: string | Date | null;
  asOf?: Date;
}): Date {
  return parseInstant(app.activatedAt) ?? parseInstant(app.submittedAt) ?? app.asOf ?? new Date();
}

/** Date shown next to Submitted / Created on customer plan cards. */
export function customerFacingApplicationDate(app: {
  status: string;
  createdAt?: string | Date | null;
  submittedAt?: string | Date | null;
}): string | Date | null {
  if (app.status === 'draft') return app.createdAt ?? null;
  return app.submittedAt ?? app.createdAt ?? null;
}

/**
 * Keep installment amounts, move due dates so the first period follows `anchor`
 * (submit / activation) instead of when the draft was opened.
 */
export function rebaseScheduleToAnchor<T extends { dueDate: string }>(rows: T[], anchor: Date): T[] {
  if (rows.length === 0) return rows;
  const targetFirst = firstInstallmentDueFrom(anchor);
  const dateOnly = rows[0]!.dueDate.length <= 10;
  return rows.map((row, index) => {
    const next = addMonths(targetFirst, index);
    return { ...row, dueDate: dateOnly ? formatDateYmd(next) : next.toISOString() };
  });
}

/** Projected monthly rows when there is no live schedule and no stored plan. */
export function projectOwnershipSchedule(args: {
  tenor: number;
  monthly: number;
  anchor: Date;
}): OwnershipScheduleInput[] {
  if (!(args.tenor > 0)) return [];
  const start = firstInstallmentDueFrom(args.anchor);
  return Array.from({ length: args.tenor }, (_, index) => ({
    sequence: index + 1,
    dueDate: addMonths(start, index).toISOString(),
    amount: args.monthly,
    status: 'pending',
  }));
}

export function filterKeyMilestones(milestones: OwnershipMilestone[]): OwnershipMilestone[] {
  const seen = new Set<OwnershipMilestoneKind>();
  const result: OwnershipMilestone[] = [];
  for (const m of milestones) {
    // Waived future checkpoints were never reached on the original plan; keep
    // only the full-owner card so early settlement does not show leftover dates.
    if (m.paymentStatus === 'waived' && m.milestone !== 'full_owner') continue;
    if (!KEY_KINDS.includes(m.milestone) || seen.has(m.milestone)) continue;
    seen.add(m.milestone);
    result.push(m);
  }
  return result;
}
