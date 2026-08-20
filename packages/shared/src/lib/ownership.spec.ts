import { describe, expect, it } from 'vitest';
import {
  buildInstallmentAmounts,
  buildPricingSnapshot,
  buildPrincipalAmounts,
  paymentInputFromPricingSnapshot,
  sumInstallmentAmounts,
} from './pricing';
import { calculateOwnershipTimeline } from './ownership';

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
});
