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
  status: string;
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

function calculateOwnershipAtPayment(
  vehiclePrice: number,
  downPayment: number,
  totalPayments: number,
  paymentIndex: number,
): { customerOwnership: number; bloxOwnership: number } {
  const loanAmount = Math.max(vehiclePrice - downPayment, 0);
  const principalPerMonth = totalPayments > 0 ? loanAmount / totalPayments : 0;
  const customerOwnership = Math.min(downPayment + principalPerMonth * (paymentIndex + 1), vehiclePrice);
  const bloxOwnership = Math.max(vehiclePrice - customerOwnership, 0);
  return { customerOwnership, bloxOwnership };
}

export function calculateOwnershipTimeline(
  pricingSnapshot?: Record<string, unknown> | null,
  paymentSchedules?: Array<OwnershipScheduleInput & { id?: string }> | null,
): OwnershipTimeline {
  const vehiclePrice = num(pricingSnapshot?.list_price);
  const downPayment = num(pricingSnapshot?.down_payment);
  const schedules = [...(paymentSchedules ?? [])].sort((a, b) => a.sequence - b.sequence);
  const totalPayments = schedules.length;
  const completedPayments = schedules.filter((s) => s.status === 'paid').length;
  const paidAmount = schedules
    .filter((s) => s.status === 'paid')
    .reduce((sum, s) => sum + num(s.amount), 0);
  const _principal = Math.max(vehiclePrice - downPayment, 0);
  const currentOwnershipAmount = downPayment + paidAmount;
  const currentOwnership =
    vehiclePrice > 0 ? Math.min(100, (currentOwnershipAmount / vehiclePrice) * 100) : 0;
  const progressPercentage = currentOwnership;

  const hasOverdue = schedules.some(
    (s) => s.status === 'overdue' || (s.status !== 'paid' && new Date(s.dueDate) < new Date()),
  );

  const milestones: OwnershipMilestone[] = schedules.map((s, index) => {
    const { customerOwnership, bloxOwnership } = calculateOwnershipAtPayment(
      vehiclePrice,
      downPayment,
      totalPayments,
      index,
    );
    const ownershipPercentage =
      vehiclePrice > 0 ? Math.round((customerOwnership / vehiclePrice) * 10000) / 100 : 0;
    const kind = milestoneKindForProgress(ownershipPercentage, index);
    const paymentStatus = paymentStatusForSchedule(s.status, s.dueDate);
    const amount = num(s.amount);

    return {
      sequence: s.sequence,
      milestone: kind,
      labelKey:
        kind === 'first_payment' && index === 0
          ? 'ownership.paymentNumber'
          : milestoneBadgeKey(kind),
      paymentStatus,
      date: s.dueDate,
      dueDate: s.dueDate,
      amount,
      ownershipPercentage,
      ownershipAmount: Math.round(customerOwnership * 100) / 100,
      customerShare: amount,
      bloxShare: Math.round(bloxOwnership * 100) / 100,
    };
  });

  const _lastPaid = [...schedules].reverse().find((s) => s.status === 'paid');
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
