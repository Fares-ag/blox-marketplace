import { describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { buildQautoVehiclesFinanceAgreementPdf } from './qauto-vfa-pdf';
import type { ContractFieldContext } from './field-maps';

function ctx(overrides?: Partial<ContractFieldContext>): ContractFieldContext {
  return {
    applicationId: 'app-vfa-1',
    referenceNo: 'BLOX-9001',
    approvedAt: new Date('2026-10-27T00:00:00Z'),
    lenderName: 'In-house finance',
    lenderAddress: 'Doha',
    signatoryName: 'Credit Desk',
    signatoryTitle: 'Credit officer',
    customerEmail: 'customer@example.com',
    customerSnapshot: {
      full_name: 'Ibrahim Yassein',
      phone: '+97455808586',
      qid: '26681803810',
      email: 'customer@example.com',
      applicantType: 'individual',
      nationality: 'Egypt',
      address: { building: '62', street: '903', zone: '31', poBox: '8044', city: 'Doha' },
      employment: { company: 'Law Firm', position: 'Executive Director', phone: '30858538' },
    },
    pricing: { list_price: 119900, down_payment: 23980, admin_fee: 1000, tenor: 36, cheque_bank: 'QNB' },
    vehicle: {
      make: 'Skoda',
      model: 'Karoq Sportline',
      year: 2026,
      engineNumber: 'DJK 356920',
      chassisNumber: 'TMBJC4NU8T5044768',
    },
    dealerName: 'QAuto Skoda',
    companyCode: 'qauto-skoda',
    sapNumber: '107431',
    contractSeries: 'RSK',
    contractNumber: '0076',
    listPrice: 119900,
    downPayment: 23980,
    downPaymentPct: 20,
    monthly: 3095.25,
    tenor: 36,
    annualRate: 11.9,
    financedTotal: 111429,
    schedule: [],
    financingType: 'conventional_interest',
    ...overrides,
  };
}

describe('QAuto Vehicles Finance Agreement', () => {
  it('generates a 9-page PDF from the scanned template', async () => {
    const pdf = await buildQautoVehiclesFinanceAgreementPdf(ctx());
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    const doc = await PDFDocument.load(pdf);
    expect(doc.getPageCount()).toBe(9);
  });

  it('still generates when credit has not saved a contract number', async () => {
    const pdf = await buildQautoVehiclesFinanceAgreementPdf(
      ctx({ contractSeries: null, contractNumber: null }),
    );
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    const doc = await PDFDocument.load(pdf);
    expect(doc.getPageCount()).toBe(9);
  });
});

describe('QAuto Vehicles Finance Agreement — schedule and input safety', () => {
  const longSchedule = Array.from({ length: 49 }, (_, index) => ({
    sequence: index + 1,
    dueDate: `20${27 + Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}-05`,
    payment: index === 48 ? 36000 : 2200,
    principal: 0,
    interest: 0,
    balance: 0,
  }));

  it('continues the cheque schedule on extra pages beyond 36 cheques', async () => {
    const pdf = await buildQautoVehiclesFinanceAgreementPdf(
      ctx({ tenor: 48, monthly: 2200, schedule: longSchedule, pricing: { balloon: 36000 } }),
    );
    const doc = await PDFDocument.load(pdf);
    expect(doc.getPageCount()).toBe(10);
  });

  it('does not fail on characters the form font cannot encode (Arabic names)', async () => {
    const pdf = await buildQautoVehiclesFinanceAgreementPdf(
      ctx({
        customerSnapshot: {
          full_name: 'إبراهيم ياسين Ibrahim Yassein',
          phone: '+97455808586',
          qid: '26681803810',
          applicantType: 'individual',
          guarantor: { fullName: 'علي', qid: '27863400155' },
        },
      }),
    );
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('ships a blank master (no sample customer text layer, nine pages)', async () => {
    const fs = await import('node:fs');
    const { resolveQautoFormPath } = await import('./qauto-ca-pdf');
    const master = await PDFDocument.load(fs.readFileSync(resolveQautoFormPath('QAuto_Vehicles_Finance_Agreement.pdf')));
    expect(master.getPageCount()).toBe(9);
    expect(master.getSubject()).toBe('Blank master form');
  });
});
