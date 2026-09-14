import fs from 'node:fs';
import { buildOwnershipSchedulePdf } from '../src/applications/documents/ownership-schedule-pdf';

const ctx = {
  applicationId: 'cmtyrppq00003mn01gisjxqql',
  approvedAt: new Date('2026-03-12'),
  lenderName: 'BloX Finance',
  lenderAddress: 'QFC Tower, West Bay, Doha, Qatar',
  signatoryName: 'Authorised Signatory',
  signatoryTitle: 'Director',
  customerEmail: 'customer@example.com',
  customerSnapshot: {
    full_name: 'FARES MAHMOUD',
    qid: '12345678901',
    phone: '+97450000000',
    address: { line1: 'West Bay', city: 'Doha' },
  },
  pricing: { list_price: 200000, down_payment: 40000, rate: 11.9, tenor: 36, monthly: 5306.65 },
  vehicle: { make: 'Jaguar', model: 'E-Pace', year: 2026, condition: 'new', bodyType: 'SUV' },
  dealerName: 'QA Motors',
  listPrice: 200000,
  downPayment: 40000,
  downPaymentPct: 20,
  monthly: 5306.65,
  tenor: 36,
  annualRate: 11.9,
  financedTotal: 191039.43,
  schedule: [],
};

async function main() {
  const t0 = Date.now();
  const pdf = await buildOwnershipSchedulePdf(ctx);
  fs.writeFileSync('test-schedule.pdf', pdf);
  console.log('OK', pdf.length, 'bytes in', Date.now() - t0, 'ms');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
