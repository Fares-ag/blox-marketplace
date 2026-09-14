import fs from 'node:fs';
import { buildMusharakahAgreementPdf } from '../src/applications/documents/agreement-pdf';

const ctx = {
  applicationId: 'test-001',
  approvedAt: new Date('2026-09-12'),
  lenderName: 'BloX Finance',
  lenderAddress: 'QFC Tower, West Bay, Doha, Qatar',
  signatoryName: 'Authorised Signatory',
  signatoryTitle: 'Director',
  customerEmail: 'customer@example.com',
  customerSnapshot: {
    full_name: 'Fares Mahmoud',
    qid: '12345678901',
    phone: '+97450000000',
    address: { line1: 'West Bay', city: 'Doha' },
  },
  pricing: { list_price: 200000, down_payment: 40000, rate: 11.9, tenor: 36, monthly: 5500 },
  vehicle: { make: 'Jaguar', model: 'E-Pace', year: 2026, condition: 'new', bodyType: 'SUV' },
  dealerName: 'QA Motors',
  listPrice: 200000,
  downPayment: 40000,
  downPaymentPct: 20,
  monthly: 5500,
  tenor: 36,
  annualRate: 11.9,
  financedTotal: 198000,
  schedule: [],
};

async function main() {
  const t0 = Date.now();
  const pdf = await buildMusharakahAgreementPdf(ctx);
  fs.writeFileSync('test-musharakah.pdf', pdf);
  console.log('OK', pdf.length, 'bytes in', Date.now() - t0, 'ms');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
