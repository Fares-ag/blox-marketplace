import { describe, expect, it } from 'vitest';
import { resolveDisplaySchedule } from './resolve-display-schedule';
import type { InstallmentPlan } from '../types/installment-plan';

describe('resolveDisplaySchedule', () => {
  const plan: InstallmentPlan = {
    tenure: '12 Months',
    interval: 'Monthly',
    monthlyAmount: 1000,
    totalAmount: 12000,
    downPayment: 5000,
    schedule: [
      { dueDate: '2026-02-01', amount: 1000, status: 'upcoming' },
      { dueDate: '2026-03-01', amount: 1000, status: 'upcoming' },
    ],
    calculationMethod: 'dynamic_rent',
  };

  it('returns plan rows when pre-active and no live schedules', () => {
    const rows = resolveDisplaySchedule({
      installmentPlan: plan,
      paymentSchedules: [],
      vehiclePrice: 50000,
      isActiveOrLater: false,
    });
    expect(rows).toHaveLength(2);
    expect(rows[0]?.source).toBe('plan');
    expect(rows[0]?.amount).toBe(1000);
  });

  it('returns live schedules when active', () => {
    const rows = resolveDisplaySchedule({
      installmentPlan: plan,
      paymentSchedules: [
        {
          id: 's1',
          sequence: 1,
          due_date: '2026-02-01',
          amount: 1000,
          status: 'pending',
        },
      ],
      isActiveOrLater: true,
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.source).toBe('live');
    expect(rows[0]?.id).toBe('s1');
  });
});
