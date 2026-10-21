import { describe, expect, it } from 'vitest';
import { toCanonicalBureauFacility, type CanonicalSnapshotInput } from './canonical-snapshot';

const asOf = new Date('2026-09-30T21:00:00+03:00');

function input(over: Partial<CanonicalSnapshotInput> = {}): CanonicalSnapshotInput {
  return {
    id: 'app-1',
    referenceSeq: 42,
    status: 'active',
    activatedAt: new Date('2026-03-15T00:00:00Z'),
    completedAt: null,
    qid: '28912345678',
    defaultClassification: 'performing',
    customerSnapshot: {
      full_name: 'Sara Al Thani',
      phone: '97450000000',
      qid: '28912345678',
      applicantType: 'individual',
      nationality: 'Qatari',
      dateOfBirth: '1989-05-01',
    },
    pricingSnapshot: { financed_amount: 90000, down_payment: 10000, selling_price: 100000, monthly: 2500 },
    register: { bloxUnits: 70, customerUnits: 30, totalUnits: 100, unitNominalValue: 1000 },
    schedules: [
      { status: 'paid', remainingAmount: 0, dueDate: new Date('2026-04-01'), paidAt: new Date('2026-04-01') },
      { status: 'overdue', remainingAmount: 2500, dueDate: new Date('2026-08-01'), paidAt: null },
      { status: 'pending', remainingAmount: 2500, dueDate: new Date('2026-10-01'), paidAt: null },
    ],
    forgivenRentTotal: 0,
    rentCollectedInPeriod: 400,
    ...over,
  };
}

describe('toCanonicalBureauFacility', () => {
  it('uses BLOX units × unit value as Islamic outstanding', () => {
    const row = toCanonicalBureauFacility(input(), asOf);
    expect(row.facilityId).toBe('BLOX-0042');
    expect(row.originalAmount).toBe(90000);
    expect(row.outstanding).toBe(70000);
    expect(row.outstandingSource).toBe('register');
    expect(row.ownershipPctCustomer).toBe(30);
    expect(row.rentAmount).toBe(400);
    expect(row.installmentAmount).toBe(2500);
  });

  it('falls back to unpaid schedule remaining when the register is absent', () => {
    const row = toCanonicalBureauFacility(input({ register: null }), asOf);
    expect(row.outstandingSource).toBe('schedule');
    expect(row.outstanding).toBe(5000);
  });

  it('does not treat sticker price as original credit', () => {
    const row = toCanonicalBureauFacility(
      input({ pricingSnapshot: { selling_price: 100000, down_payment: 20000 } }),
      asOf,
    );
    expect(row.originalAmount).toBe(80000);
  });

  it('records Ibra as forgiven rent and zero outstanding after settlement', () => {
    const row = toCanonicalBureauFacility(
      input({
        status: 'completed',
        completedAt: new Date('2026-09-10'),
        register: { bloxUnits: 0, customerUnits: 100, totalUnits: 100, unitNominalValue: 1000 },
        forgivenRentTotal: 1500.5,
        schedules: [
          { status: 'paid', remainingAmount: 0, dueDate: new Date('2026-04-01'), paidAt: new Date('2026-04-01') },
          { status: 'waived', remainingAmount: 0, dueDate: new Date('2026-09-01'), paidAt: null },
        ],
      }),
      asOf,
    );
    expect(row.outstanding).toBe(0);
    expect(row.ibraAmount).toBe(1500.5);
    expect(row.applicationStatus).toBe('completed');
  });

  it('counts overdue arrears without mixing rent into outstanding', () => {
    const row = toCanonicalBureauFacility(input(), asOf);
    expect(row.arrearsCount).toBe(1);
    expect(row.arrearsAmount).toBe(2500);
    expect(row.outstanding).toBe(70000);
  });
});
