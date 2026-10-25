/**
 * QA: generate full contract packs (including QAuto prefilled CAs) for visual review.
 * Run: npx tsx scripts/qa-generate-contracts.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildProgrammaticContractPdf } from '../src/applications/documents/programmatic-documents';
import { normalizeContractContext } from '../src/applications/documents/contract-terms';
import { buildPlanFromPricingSnapshot } from '@drivemarket/shared/installment-plan';
import { documentsForFinancingType } from '../src/applications/documents/template-catalog';
import type { ContractFieldContext } from '../src/applications/documents/field-maps';

const root = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(root, '..', '.tmp-contract-pdfs', 'qa-run');
fs.mkdirSync(outDir, { recursive: true });

function baseCtx(overrides: Partial<ContractFieldContext>): ContractFieldContext {
  return normalizeContractContext({
    applicationId: 'qa-app-001',
    referenceNo: 'BLOX-9001',
    approvedAt: new Date('2026-10-22T10:00:00.000Z'),
    lenderName: 'Blox Finance',
    lenderAddress: 'Qatar Financial Centre, Doha, Qatar',
    signatoryName: 'Authorised Signatory',
    signatoryTitle: 'CEO',
    customerEmail: 'customer@example.com',
    customerSnapshot: {
      full_name: 'Mike Rafone',
      phone: '+97466886688',
      qid: '30063400121',
      email: 'customer@example.com',
      applicantType: 'individual',
      nationality: 'Qatari',
      city: 'Doha',
      address: { line1: 'Street 12', zone: '45', city: 'Doha', poBox: '1234' },
      employment: { company: 'Qatar Energy' },
      guarantor: { fullName: 'Ali Guarantor', phone: '+97455551111' },
    },
    pricing: { list_price: 89000, down_payment: 17800, tenor: 36, monthly: 2360.85, rate: 11.9 },
    vehicle: { make: 'Audi', model: 'Q5', year: 2026, vin: 'WAUZZZ12345678901' },
    dealerName: 'QAuto Audi',
    companyCode: 'qauto-audi',
    salesmanName: 'Sara Sales',
    intakeSource: 'walk_in',
    uploadedCategories: ['qid', 'salary', 'bank', 'credit_bureau'],
    listPrice: 89000,
    downPayment: 17800,
    downPaymentPct: 20,
    monthly: 2360.85,
    tenor: 36,
    annualRate: 11.9,
    financedTotal: 85000,
    schedule: [],
    financingType: 'diminishing_musharakah',
    approverName: 'QAuto Credit',
    approverRole: 'credit_officer',
    ...overrides,
  });
}

type Scenario = {
  folder: string;
  financingType: 'diminishing_musharakah' | 'conventional_interest';
  companyCode: string;
  applicantType: 'individual' | 'corporate';
  ctx: ContractFieldContext;
};

const scenarios: Scenario[] = [
  {
    folder: 'qauto-retail-musharakah',
    financingType: 'diminishing_musharakah',
    companyCode: 'qauto-audi',
    applicantType: 'individual',
    ctx: baseCtx({ financingType: 'diminishing_musharakah' }),
  },
  {
    folder: 'qauto-fleet-corporate',
    financingType: 'diminishing_musharakah',
    companyCode: 'qauto-vw',
    applicantType: 'corporate',
    ctx: baseCtx({
      financingType: 'diminishing_musharakah',
      companyCode: 'qauto-vw',
      dealerName: 'QAuto Volkswagen',
      customerSnapshot: {
        full_name: 'Fleet Contact',
        phone: '+97466886688',
        qid: '30063400121',
        email: 'fleet@example.com',
        applicantType: 'corporate',
        corporate: {
          legalName: 'Ada Logistics WLL',
          crNumber: '12345678901234',
          registeredAddress: { line1: 'Industrial Area', city: 'Doha', poBox: '88' },
          authorizedSignatory: {
            firstName: 'Ada',
            lastName: 'Lovelace',
            phone: '+97466886688',
            email: 'fleet@example.com',
          },
        },
      },
      uploadedCategories: ['cr', 'trade_license', 'bank', 'audited_financials', 'guarantor_qid'],
    }),
  },
  {
    folder: 'qauto-inhouse-conventional',
    financingType: 'conventional_interest',
    companyCode: 'qauto-audi',
    applicantType: 'individual',
    ctx: baseCtx({
      financingType: 'conventional_interest',
      lenderName: 'In-house finance',
      annualRate: 11.9,
    }),
  },
  {
    folder: 'qauto-inhouse-balloon',
    financingType: 'conventional_interest',
    companyCode: 'qauto-audi',
    applicantType: 'individual',
    ctx: (() => {
      const approvedAt = new Date('2026-10-22T10:00:00.000Z');
      const pricing = {
        list_price: 120_000,
        down_payment: 24_000,
        down_payment_pct: 20,
        rate: 11.9,
        tenor: 48,
        calculation_method: 'balloon_payment',
        balloon_pct: 30,
        installment_pct: 50,
        first_installment_date: '2026-11-01',
      };
      const installmentPlan = buildPlanFromPricingSnapshot({ pricingSnapshot: pricing, asOf: approvedAt });
      return baseCtx({
        financingType: 'conventional_interest',
        lenderName: 'In-house finance',
        approvedAt,
        pricing,
        installmentPlan,
        annualRate: 11.9,
        vehicle: { make: 'Audi', model: 'A6', year: 2026, vin: 'WAUZZZ98765432109' },
      });
    })(),
  },
  {
    folder: 'non-qauto-blox-only',
    financingType: 'diminishing_musharakah',
    companyCode: 'chery-elite',
    applicantType: 'individual',
    ctx: baseCtx({
      companyCode: 'chery-elite',
      dealerName: 'Chery Elite Motors',
      salesmanName: undefined,
      intakeSource: 'web_lead',
    }),
  },
];

async function main() {
  const manifest: string[] = [];
  for (const scenario of scenarios) {
    const dir = path.join(outDir, scenario.folder);
    fs.mkdirSync(dir, { recursive: true });
    const specs = documentsForFinancingType(scenario.financingType, {
      companyCode: scenario.companyCode,
      applicantType: scenario.applicantType,
    });
    for (const spec of specs) {
      const pdf = await buildProgrammaticContractPdf(spec.documentType, scenario.ctx);
      const file = path.join(dir, `${spec.documentType}.pdf`);
      fs.writeFileSync(file, pdf);
      manifest.push(`${scenario.folder}/${spec.documentType}.pdf (${pdf.length} bytes)`);
    }
  }
  const manifestPath = path.join(outDir, 'manifest.txt');
  fs.writeFileSync(manifestPath, manifest.join('\n') + '\n');
  console.log('Generated contract packs under:', outDir);
  for (const line of manifest) console.log(' ', line);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
