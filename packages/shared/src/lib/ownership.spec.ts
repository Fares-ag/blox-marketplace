import { describe, expect, it } from 'vitest';
import { addMonths, firstInstallmentDueFrom, formatDateYmd } from './date-utils';
import {
  buildInstallmentAmounts,
  buildPricingSnapshot,
  buildPrincipalAmounts,
  paymentInputFromPricingSnapshot,
  sumInstallmentAmounts,
} from './pricing';
import {
  calculateOwnershipTimeline,
  overlayRegisterOnTimeline,
  filterKeyMilestones,
  ownershipPlanAnchorDate,
  customerFacingApplicationDate,
  rebaseScheduleToAnchor,
  projectOwnershipSchedule,
} from './ownership';

describe('ownership from principal ledger', () => {
  const snapshot = buildPricingSnapshot({
    listPrice: 100_000,
    annualRatePercent: 12.5,
    minDownPaymentPct: 10,
    tenureMonths: 36,
    downPaymentPct: 10,
  });

  it('principal schedule sums to the financed loan, not the full installment total', () => {
    const input = paymentInputFromPricingSnapshot(snapshot);
    const principals = buildPrincipalAmounts(input);
    const installments = buildInstallmentAmounts(input);
    const principalTotal = principals.reduce((sum, amount) => sum + amount, 0);

    expect(principalTotal).toBe(input.price - input.downPayment);
    expect(sumInstallmentAmounts(installments)).toBeGreaterThan(principalTotal);
  });

  it('counts only principal toward current ownership, not profit', () => {
    const input = paymentInputFromPricingSnapshot(snapshot);
    const principals = buildPrincipalAmounts(input);
    const schedules = principals.map((_, index) => ({
      id: `sched-${index + 1}`,
      sequence: index + 1,
      dueDate: `2026-${String(index + 1).padStart(2, '0')}-01`,
      amount: snapshot.monthly,
      paidAmount: index < 3 ? snapshot.monthly : 0,
      status: index < 3 ? 'paid' : 'pending',
    }));

    const timeline = calculateOwnershipTimeline(snapshot, schedules);
    const paidInstallments = 3 * snapshot.monthly;
    const paidPrincipal = principals.slice(0, 3).reduce((sum, amount) => sum + amount, 0);

    expect(timeline.currentOwnershipAmount).toBeCloseTo(snapshot.down_payment + paidPrincipal, 2);
    expect(timeline.currentOwnershipAmount).toBeLessThan(snapshot.down_payment + paidInstallments);
  });

  it('uses ledger principal metadata when payment events are supplied', () => {
    const schedules = [
      {
        id: 'sched-1',
        sequence: 1,
        dueDate: '2026-01-01',
        amount: 3_000,
        paidAmount: 1_500,
        status: 'pending',
      },
    ];

    const timeline = calculateOwnershipTimeline(snapshot, schedules, [
      {
        type: 'down_payment',
        amount: snapshot.down_payment,
      },
      {
        type: 'installment',
        scheduleId: 'sched-1',
        amount: 1_500,
        principalAmount: 900,
      },
    ]);

    expect(timeline.currentOwnershipAmount).toBe(snapshot.down_payment + 900);
  });

  it('splits milestone shares into equity (customer) and profit (blox)', () => {
    const input = paymentInputFromPricingSnapshot(snapshot);
    const principals = buildPrincipalAmounts(input);
    const schedules = [
      {
        sequence: 1,
        dueDate: '2026-01-01',
        amount: snapshot.monthly,
        status: 'pending',
      },
    ];

    const timeline = calculateOwnershipTimeline(snapshot, schedules);
    const milestone = timeline.milestones[0];

    expect(milestone.customerShare).toBeCloseTo(principals[0], 2);
    expect(milestone.bloxShare).toBeCloseTo(snapshot.monthly - principals[0], 2);
    expect(milestone.customerShare + milestone.bloxShare).toBeCloseTo(snapshot.monthly, 2);
  });

  it('overlays register units onto the computed timeline when dual-read is on', () => {
    const schedules = [
      { sequence: 1, dueDate: '2026-01-01', amount: snapshot.monthly, status: 'pending' },
    ];
    const timeline = calculateOwnershipTimeline(snapshot, schedules);
    const overlaid = overlayRegisterOnTimeline(timeline, { customerUnits: 40, totalUnits: 100 });
    expect(overlaid.currentOwnership).toBe(40);
    expect(overlaid.progressPercentage).toBe(40);
  });

  it('treats waived remaining installments as settled after early settlement', () => {
    const input = paymentInputFromPricingSnapshot(snapshot);
    const principals = buildPrincipalAmounts(input);
    const settlementAt = '2026-09-17T08:00:00.000Z';
    const schedules = principals.map((_, index) => {
      const paid = index < 4;
      return {
        sequence: index + 1,
        dueDate: new Date(Date.UTC(2026, index, 15)).toISOString(),
        amount: snapshot.monthly,
        paidAmount: snapshot.monthly,
        paidAt: paid ? new Date(Date.UTC(2026, index, 15)).toISOString() : settlementAt,
        status: paid ? 'paid' : 'waived',
      };
    });

    const timeline = calculateOwnershipTimeline(snapshot, schedules);
    expect(timeline.currentOwnership).toBe(100);
    expect(timeline.completedPayments).toBe(4);
    expect(timeline.remainingPayments).toBe(0);
    expect(timeline.projected).toBe(false);
    expect(timeline.hasOverdue).toBe(false);
    expect(timeline.estimatedCompletionDate).toBe(settlementAt);
    expect(timeline.milestones.every((m) => m.paymentStatus === 'paid' || m.paymentStatus === 'waived')).toBe(true);
    expect(timeline.milestones.filter((m) => m.paymentStatus === 'scheduled')).toHaveLength(0);

    const last = timeline.milestones[timeline.milestones.length - 1];
    expect(last?.milestone).toBe('full_owner');
    expect(last?.paymentStatus).toBe('waived');
    expect(last?.date).toBe(settlementAt);
    expect(last?.ownershipPercentage).toBe(100);

    const keys = filterKeyMilestones(timeline.milestones);
    expect(keys.some((m) => m.milestone === 'full_owner')).toBe(true);
    expect(keys.filter((m) => m.paymentStatus === 'scheduled')).toHaveLength(0);
    expect(keys.some((m) => m.milestone === 'halfway' && m.paymentStatus === 'waived')).toBe(false);
    expect(keys.some((m) => m.milestone === 'almost_there')).toBe(false);
  });

  it('closes remaining schedule display when the register is fully transferred', () => {
    const schedules = Array.from({ length: 12 }, (_, index) => ({
      sequence: index + 1,
      dueDate: new Date(Date.UTC(2027, index, 15)).toISOString(),
      amount: snapshot.monthly,
      paidAmount: index < 2 ? snapshot.monthly : 0,
      status: index < 2 ? 'paid' : 'pending',
    }));
    const timeline = calculateOwnershipTimeline(snapshot, schedules);
    expect(timeline.remainingPayments).toBeGreaterThan(0);

    const overlaid = overlayRegisterOnTimeline(timeline, { customerUnits: 100, totalUnits: 100 });
    expect(overlaid.currentOwnership).toBe(100);
    expect(overlaid.remainingPayments).toBe(0);
    expect(overlaid.projected).toBe(false);
    expect(overlaid.hasOverdue).toBe(false);
    expect(overlaid.milestones.at(-1)?.milestone).toBe('full_owner');
    expect(overlaid.milestones.at(-1)?.paymentStatus).toBe('waived');
  });
});

describe('ownership plan dates follow submit, not draft start', () => {
  it('anchors to submittedAt rather than createdAt', () => {
    const submitted = new Date('2026-04-18T10:00:00.000Z');
    const created = new Date('2026-01-02T09:00:00.000Z');
    const anchor = ownershipPlanAnchorDate({
      submittedAt: submitted,
      asOf: created,
    });
    expect(anchor.toISOString()).toBe(submitted.toISOString());
  });

  it('prefers activation over submit', () => {
    const anchor = ownershipPlanAnchorDate({
      activatedAt: '2026-06-01T00:00:00.000Z',
      submittedAt: '2026-04-18T00:00:00.000Z',
    });
    expect(anchor.toISOString()).toBe('2026-06-01T00:00:00.000Z');
  });

  it('shows submitted date on customer cards, created date only for drafts', () => {
    expect(
      customerFacingApplicationDate({
        status: 'under_review',
        createdAt: '2026-01-02T00:00:00.000Z',
        submittedAt: '2026-04-18T00:00:00.000Z',
      }),
    ).toBe('2026-04-18T00:00:00.000Z');
    expect(
      customerFacingApplicationDate({
        status: 'draft',
        createdAt: '2026-01-02T00:00:00.000Z',
        submittedAt: null,
      }),
    ).toBe('2026-01-02T00:00:00.000Z');
  });

  it('rebases a draft-era schedule onto the submit month', () => {
    const rows = [
      { sequence: 1, dueDate: '2026-02-01', amount: 1_000 },
      { sequence: 2, dueDate: '2026-03-01', amount: 1_000 },
    ];
    const submitted = new Date('2026-04-18T12:00:00.000Z');
    const first = firstInstallmentDueFrom(submitted);
    const shifted = rebaseScheduleToAnchor(rows, submitted);
    expect(shifted[0]!.dueDate).toBe(formatDateYmd(first));
    expect(shifted[1]!.dueDate).toBe(formatDateYmd(addMonths(first, 1)));
  });

  it('projects tenure from the submit anchor, not draft start', () => {
    const submitted = new Date('2026-04-18T12:00:00.000Z');
    const first = firstInstallmentDueFrom(submitted);
    const projected = projectOwnershipSchedule({
      tenor: 3,
      monthly: 2_000,
      anchor: submitted,
    });
    expect(projected).toHaveLength(3);
    expect(projected[0]!.dueDate).toBe(first.toISOString());
    expect(projected[2]!.dueDate).toBe(addMonths(first, 2).toISOString());
  });
});
