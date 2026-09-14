import fs from 'node:fs';
import { buildCamPdf } from '../src/applications/documents/cam-pdf';
import type { ContractFieldContext } from '../src/applications/documents/field-maps';

const ctx: ContractFieldContext = {
  applicationId: 'cmtyrppq00003mn01gisjxqql',
  approvedAt: new Date('2026-03-12'),
  lenderName: 'BloX Finance',
  lenderAddress: 'QFC Tower, West Bay, Doha, Qatar',
  signatoryName: 'Authorised Signatory',
  signatoryTitle: 'Director',
  customerEmail: 'customer@example.com',
  customerSnapshot: {
    full_name: 'FARES MAHMOUD',
    qid: '28912345678',
    phone: '+97450000000',
    nationality: 'Egyptian',
    residency: 'Resident',
    residenceDuration: '5',
    monthlyIncome: 18000,
    monthlyLiabilities: 3500,
    employment: {
      company: 'Qatar Airways',
      employmentType: 'Salaried — Tier 1',
      employmentDuration: '4',
    },
    address: { line1: 'West Bay', city: 'Doha' },
  },
  pricing: { list_price: 200000, down_payment: 40000, rate: 11.9, tenor: 36, monthly: 5306.65 },
  vehicle: { make: 'Jaguar', model: 'E-Pace', year: 2024, condition: 'New', vin: 'SADFA2GX9KA123456' },
  dealerName: 'QA Motors',
  listPrice: 200000,
  downPayment: 40000,
  downPaymentPct: 20,
  monthly: 5306.65,
  tenor: 36,
  annualRate: 11.9,
  financedTotal: 191039.43,
  schedule: [],
  approverName: 'Credit Officer',
  approverRole: 'credit_officer',
  credit: {
    assessment: {
      path: 'approve_standard',
      approvalAuthority: 'credit_officer',
      reasons: ['DBR within cap', 'LTV within policy'],
      ruleFlags: [{ code: 'DBR001', severity: 'soft', params: {} }],
      assessedAt: '2026-03-12T10:00:00Z',
      affordability: {
        dbr: 0.48,
        cap: 0.5,
        hard_cap: 0.55,
        status: 'within_cap',
        exception_tier: 0,
        max_installment_within_cap: 5500,
        headroom: 200,
        stressed: null,
      },
    },
    financedAmount: 160000,
    monthlyInstallment: 5306.65,
  },
};

async function main() {
  const t0 = Date.now();
  const pdf = await buildCamPdf(ctx);
  fs.writeFileSync('test-cam.pdf', pdf);
  console.log('OK', pdf.length, 'bytes in', Date.now() - t0, 'ms');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
