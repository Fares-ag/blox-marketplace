import { describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { buildQautoFleetCreditApplicationPdf, buildQautoRetailCreditApplicationPdf } from './qauto-ca-pdf';
import type { ContractFieldContext } from './field-maps';

function ctx(overrides?: Partial<ContractFieldContext>): ContractFieldContext {
  return {
    applicationId: 'app-qauto-1',
    referenceNo: 'BLOX-2042',
    approvedAt: new Date('2026-10-22T00:00:00Z'),
    lenderName: 'In-house finance',
    lenderAddress: 'Doha',
    signatoryName: 'Credit Desk',
    signatoryTitle: 'Credit officer',
    customerEmail: 'ada@example.com',
    customerSnapshot: {
      full_name: 'Ada Lovelace',
      phone: '+97455550000',
      qid: '28912345678',
      email: 'ada@example.com',
      applicantType: 'individual',
      nationality: 'Qatari',
      address: { line1: 'Street 12', zone: '45', city: 'Doha', poBox: '1234' },
      employment: { company: 'Qatar Energy' },
      guarantor: { fullName: 'Ali Guarantor', phone: '+97455551111' },
    },
    pricing: { list_price: 100000, down_payment: 20000, tenor: 36 },
    vehicle: { make: 'Audi', model: 'Q5', year: 2026 },
    dealerName: 'QAuto Audi',
    companyCode: 'qauto-audi',
    salesmanName: 'Sara Sales',
    intakeSource: 'walk_in',
    uploadedCategories: ['qid', 'salary', 'bank'],
    listPrice: 100000,
    downPayment: 20000,
    downPaymentPct: 20,
    monthly: 2500,
    tenor: 36,
    annualRate: 11.9,
    financedTotal: 90000,
    schedule: [],
    ...overrides,
  };
}

describe('QAuto credit application forms', () => {
  it('prefills the retail form with customer, vehicle and finance fields', async () => {
    const pdf = await buildQautoRetailCreditApplicationPdf(ctx());
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    const doc = await PDFDocument.load(pdf);
    expect(doc.getPageCount()).toBe(2);
  });

  it('prefills the fleet form from a corporate snapshot', async () => {
    const pdf = await buildQautoFleetCreditApplicationPdf(
      ctx({
        customerSnapshot: {
          full_name: 'Ada Lovelace',
          phone: '+97455550000',
          qid: '28912345678',
          email: 'fleet@example.com',
          applicantType: 'corporate',
          corporate: {
            legalName: 'Ada Logistics WLL',
            registeredAddress: { line1: 'Industrial Area', city: 'Doha', poBox: '88' },
            authorizedSignatory: { firstName: 'Ada', lastName: 'Lovelace', phone: '+97455550000' },
          },
        },
      }),
    );
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    const doc = await PDFDocument.load(pdf);
    expect(doc.getPageCount()).toBe(1);
  });
});
