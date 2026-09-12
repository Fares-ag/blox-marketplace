/**
 * Generate sample contract PDFs locally for visual inspection.
 * Run: node packages/api/scripts/test-contract-documents.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(root, '..', '.tmp-contract-pdfs');
fs.mkdirSync(outDir, { recursive: true });

const ctx = {
  applicationId: 'cmtybzhdw0035or01nmf4fpb2',
  approvedAt: new Date('2026-09-12'),
  lenderName: 'Blox Finance',
  lenderAddress: 'Qatar Financial Centre, Doha, Qatar',
  signatoryName: 'Authorised Signatory',
  signatoryTitle: 'CEO',
  customerEmail: 'asd@gmail.com',
  customerSnapshot: {
    full_name: 'Mike Rafone',
    phone: '+97466886688',
    qid: '30063400121',
    city: 'Doha',
    monthly_income: 25000,
    monthly_liabilities: 5000,
  },
  pricing: { list_price: 89000, down_payment: 17795.4, tenor: 36, monthly: 2360.85, rate: 11.9 },
  vehicle: { make: 'Chery', model: 'Tiggo 7 Pro', year: 2025, vin: 'VIN123' },
  dealerName: 'QA-TEST Motors',
  listPrice: 89000,
  downPayment: 17795.4,
  downPaymentPct: 20,
  monthly: 2360.85,
  tenor: 36,
  annualRate: 11.9,
  financedTotal: 84990.58,
  schedule: Array.from({ length: 36 }, (_, i) => ({
    sequence: i + 1,
    dueDate: `2026-${String((i % 12) + 10).padStart(2, '0')}-12`,
    payment: 2361.61,
    principal: 1655.5 - i * 10,
    interest: 706.11 - i * 5,
    balance: 69549.1 - i * 1900,
  })),
  credit: {
    path: 'approve',
    approvalAuthority: 'credit_officer',
    assessedAt: '2026-09-12',
    reasons: ['Within policy DBR'],
    ruleFlags: [],
    assessment: {
      path: 'approve',
      approvalAuthority: 'credit_officer',
      assessedAt: '2026-09-12',
      reasons: ['Within policy DBR'],
      ruleFlags: [],
      decision: { tier: 'standard' },
      affordability: { dbr: 0.35, status: 'pass', cap: 0.5 },
    },
  },
  approverName: 'Demo Credit',
  approverRole: 'credit_officer',
};

const { buildContractPdf } = await import(pathToFileURL(path.join(root, '../src/applications/contract-pdf.ts')).href);
const { buildOwnershipSchedulePdf } = await import(
  pathToFileURL(path.join(root, '../src/applications/documents/ownership-schedule-pdf.ts')).href,
);
const { buildCamFallbackPdf } = await import(
  pathToFileURL(path.join(root, '../src/applications/documents/cam-fallback-pdf.ts')).href,
);
const { contractPdfInputFromContext } = await import(
  pathToFileURL(path.join(root, '../src/applications/documents/contract-pdf-input.ts')).href,
);

const agreement = await buildContractPdf(contractPdfInputFromContext(ctx));
fs.writeFileSync(path.join(outDir, 'musharakah_agreement.pdf'), agreement.buffer);
console.log('wrote musharakah_agreement.pdf', agreement.buffer.length);

const schedule = await buildOwnershipSchedulePdf(ctx);
fs.writeFileSync(path.join(outDir, 'ownership_rental_schedule.pdf'), schedule);
console.log('wrote ownership_rental_schedule.pdf', schedule.length);

const cam = await buildCamFallbackPdf(ctx);
fs.writeFileSync(path.join(outDir, 'credit_appraisal_memorandum.pdf'), cam);
console.log('wrote credit_appraisal_memorandum.pdf', cam.length);

console.log('output:', outDir);
