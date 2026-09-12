import { describe, expect, it } from 'vitest';
import { nestDottedFields } from './docx-template';
import { documentsForFinancingType } from './template-catalog';
import { commonDealFields, fieldsForDocument, type ContractFieldContext } from './field-maps';

function ctx(overrides?: Partial<ContractFieldContext>): ContractFieldContext {
  return {
    applicationId: 'app-1',
    approvedAt: new Date('2026-09-12T00:00:00Z'),
    lenderName: 'Blox Finance',
    lenderAddress: 'QFC, Doha',
    signatoryName: 'Blox Signatory',
    signatoryTitle: 'CEO',
    customerEmail: 'ada@example.com',
    customerSnapshot: {
      full_name: 'Ada Lovelace',
      phone: '+97455550000',
      qid: '28912345678',
      email: 'ada@example.com',
    },
    pricing: { list_price: 100000, down_payment: 20000, tenor: 24, monthly: 4000, rate: 6 },
    vehicle: { make: 'Toyota', model: 'Camry', year: 2024, vin: 'VIN1', chassisNumber: 'CH1' },
    dealerName: 'Demo Dealer',
    listPrice: 100000,
    downPayment: 20000,
    downPaymentPct: 20,
    monthly: 4000,
    tenor: 24,
    annualRate: 6,
    financedTotal: 96000,
    schedule: [
      { sequence: 1, dueDate: '2026-10-12', payment: 4000, principal: 3333.33, interest: 666.67, balance: 76666.67 },
      { sequence: 24, dueDate: '2028-09-12', payment: 4000, principal: 3333.33, interest: 100, balance: 0 },
    ],
    ...overrides,
  };
}

describe('contract document field maps', () => {
  it('nests dotted merge fields for docxtemplater', () => {
    const nested = nestDottedFields({ 'Deal.Ref': 'app-1', 'Customer.QID': '28912345678' });
    expect(nested).toEqual({ Deal: { Ref: 'app-1' }, Customer: { QID: '28912345678' } });
  });

  it('fills ijarah and schedule customer fields from the application', () => {
    const fields = commonDealFields(ctx());
    expect(fields['Customer.FullNameEN']).toBe('Ada Lovelace');
    expect(fields['Deal.Ref']).toBe('app-1');
    expect(fields['Price.CustomerContribution']).toContain('20,000');
    expect(fields['Vehicle.MakeModel']).toBe('Toyota Camry');
  });

  it('writes first and last schedule rows', () => {
    const fields = fieldsForDocument('ownership_rental_schedule', ctx());
    expect(fields['Sch.1.DueDate']).toBe('2026-10-12');
    expect(fields['Sch.n.DueDate']).toBe('2028-09-12');
    expect(fields['Sch.2.DueDate']).toBe('2028-09-12');
  });

  it('selects ijarah vs musharakah by offer type and always includes CAM + schedule', () => {
    const ijarah = documentsForFinancingType('ijarah');
    expect(ijarah.map((doc) => doc.documentType)).toEqual([
      'ijarah_agreement',
      'ownership_rental_schedule',
      'credit_appraisal_memorandum',
    ]);
    const dm = documentsForFinancingType('diminishing_musharakah');
    expect(dm.map((doc) => doc.documentType)).toEqual([
      'musharakah_agreement',
      'ownership_rental_schedule',
      'credit_appraisal_memorandum',
    ]);
    expect(ijarah.find((doc) => doc.documentType === 'credit_appraisal_memorandum')?.audience).toBe('ops');
  });
});
