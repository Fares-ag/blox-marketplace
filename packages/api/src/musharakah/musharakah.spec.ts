import { describe, expect, it } from 'vitest';
import { Prisma } from '@prisma/client';
import { evaluateAcquisitionGate, evaluatePreDisbursal } from './gates';
import { splitFromPricing } from './register';

describe('musharakah gates', () => {
  it('requires every pre-disbursal item before complete', () => {
    const checklist = evaluatePreDisbursal({
      applicationId: 'app-1',
      status: 'pending_finance_activation',
      customerPhase: 'pre_disbursal',
      kycStatus: 'verified',
      contractGenerated: true,
      signedContractPath: 'contracts/a.pdf',
      preDisbursalCompletedAt: null,
      repaymentMandateStatus: 'registered',
      requiredDown: new Prisma.Decimal(1000),
      recordedDown: new Prisma.Decimal(1000),
      takafulCoverageOk: true,
    });
    expect(checklist.complete).toBe(true);
  });

  it('fails the acquisition gate when LPO is not settled', () => {
    const gate = evaluateAcquisitionGate({
      lpoSettled: false,
      vehicle: { vin: 'VIN1', chassisNumber: 'CH1', engineNumber: 'EN1' },
      documents: [
        { category: 'delivery_note' },
        { category: 'registration_card' },
        { category: 'vin_evidence' },
      ],
      preDisbursalComplete: true,
    });
    expect(gate.ok).toBe(false);
    expect(gate.missing).toContain('lpo_not_settled');
  });

  it('opens a 100-unit split from the pricing snapshot', () => {
    const split = splitFromPricing({ list_price: 80_000, down_payment: 16_000 });
    expect(split.customerUnits).toBe(20);
    expect(split.bloxUnits).toBe(80);
  });
});
