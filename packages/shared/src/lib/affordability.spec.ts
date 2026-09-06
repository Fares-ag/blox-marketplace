import { describe, expect, it } from 'vitest';
import { assessAffordability, maxFinancingForInstallment, preCheckEligibility } from './affordability';

const NOW = new Date('2026-09-07T00:00:00Z');

describe('affordability', () => {
  it('computes DBR against the residency × employer cap', () => {
    const r = assessAffordability({
      monthlyIncome: 10_000,
      monthlyLiabilities: 1_000,
      proposedInstallment: 3_000,
      residency: 'expat',
      employerCategory: 'private_unlisted',
    });
    expect(r.dbr).toBe(0.4);
    expect(r.cap).toBe(0.5);
    expect(r.status).toBe('within_cap');
    expect(r.maxInstallmentWithinCap).toBe(4_000);
    expect(r.headroom).toBe(1_000);
  });

  it('routes small excesses to exception tiers and large ones to a decline', () => {
    const tier1 = assessAffordability({
      monthlyIncome: 10_000,
      monthlyLiabilities: 0,
      proposedInstallment: 5_200,
      residency: 'expat',
      employerCategory: 'private_approved',
    });
    expect(tier1.status).toBe('exception_tier_1');
    const declined = assessAffordability({
      monthlyIncome: 10_000,
      monthlyLiabilities: 3_000,
      proposedInstallment: 5_000,
      residency: 'qatari',
      employerCategory: 'government',
    });
    expect(declined.status).toBe('above_hard_cap');
  });

  it('runs the stress test on high-ticket financing', () => {
    const r = assessAffordability({
      monthlyIncome: 20_000,
      monthlyLiabilities: 2_000,
      proposedInstallment: 8_000,
      residency: 'qatari',
      employerCategory: 'government',
      financedAmount: 120_000,
    });
    expect(r.stressed).toBeDefined();
    expect(r.stressed?.dbr).toBeGreaterThan(r.dbr);
  });

  it('inverts the annuity to a maximum financing amount', () => {
    const pv = maxFinancingForInstallment(1_000, 12, 36);
    expect(pv).toBeGreaterThan(29_000);
    expect(pv).toBeLessThan(31_000);
    expect(maxFinancingForInstallment(0, 12, 36)).toBe(0);
  });

  it('pre-checks a strong applicant as likely eligible', () => {
    const r = preCheckEligibility({
      residency: 'qatari',
      dateOfBirth: '1990-05-01',
      monthlyIncome: 25_000,
      monthlyLiabilities: 2_000,
      employerCategory: 'government',
      financing: {
        applicantType: 'individual',
        residency: 'qatari',
        vehicle: { price: 60_000, condition: 'new', modelYear: 2026 },
        tenureMonths: 48,
        downPaymentPct: 20,
      },
      annualRatePercent: 11,
      now: NOW,
    });
    expect(r.outcome).toBe('likely_eligible');
    expect(r.installment).toBeGreaterThan(0);
    expect(r.checks.find((c) => c.code === 'age_band')?.status).toBe('pass');
  });

  it('marks an expatriate below the income floor as not eligible and reports missing data as incomplete', () => {
    const low = preCheckEligibility({
      residency: 'expat',
      dateOfBirth: '1995-01-01',
      monthlyIncome: 6_000,
      monthlyLiabilities: 0,
      employerCategory: 'private_unlisted',
      residencyMonths: 3,
      financing: { residency: 'expat', vehicle: { price: 40_000, condition: 'new', modelYear: 2026 }, tenureMonths: 36, downPaymentPct: 20 },
      annualRatePercent: 11,
      now: NOW,
    });
    expect(low.outcome).toBe('not_eligible');
    expect(low.checks.find((c) => c.code === 'residency_duration')?.status).toBe('fail');

    const incomplete = preCheckEligibility({
      residency: null,
      monthlyIncome: 0,
      monthlyLiabilities: 0,
      employerCategory: 'private_unlisted',
      financing: { vehicle: { price: 40_000, condition: 'new', modelYear: 2026 }, tenureMonths: 36, downPaymentPct: 20 },
      annualRatePercent: 11,
      now: NOW,
    });
    expect(incomplete.outcome).toBe('incomplete');
  });
});
