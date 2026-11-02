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
      qid: '28881800121',
      email: 'customer@example.com',
      applicantType: 'individual',
      nationality: 'Egypt',
      city: 'Doha',
      passportNumber: 'A41196196',
      passportExpiry: '2032-04-04',
      qidExpiry: '2029-11-15',
      address: { line1: 'Bldg 62, Street 903, Al Sadd', area: 'Al Sadd', zone: '38', city: 'Doha', poBox: '8044' },
      employment: {
        company: 'Qatar Energy',
        jobTitle: 'Senior Engineer',
        employmentDuration: 'more-than-12-months',
        employmentType: 'gov-or-semi-gov',
        salary: 32000,
      },
      guarantor: { fullName: 'Ali Hassan Guarantor', qid: '27863400155', phone: '+97455551111', relationship: 'sibling' },
    },
    pricing: { list_price: 89000, down_payment: 17800, tenor: 36, monthly: 2360.85, rate: 11.9 },
    vehicle: { make: 'Audi', model: 'Q5', trim: '45 TFSI quattro', year: 2026, vin: 'WAUZZZFY5T2012345', chassisNumber: 'WAUZZZFY5T2012345', engineNumber: 'DNP 104223' },
    dealerName: 'QAuto Audi',
    companyCode: 'qauto-audi',
    salesmanName: 'Sara Sales',
    intakeSource: 'walk_in',
    uploadedCategories: ['qid', 'passport', 'salary', 'bank', 'credit_bureau', 'national_address', 'guarantor_qid', 'guarantor_salary'],
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
    sapNumber: '107431',
    contractSeries: 'RSK',
    contractNumber: '0076',
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
        guarantor: { fullName: 'Grace Hopper', qid: '27863400155', phone: '+97455551111' },
      },
      uploadedCategories: ['qid', 'cr', 'trade_license', 'bank', 'audited_financials', 'guarantor_qid', 'guarantor_bank'],
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
        vehicle: { make: 'Audi', model: 'A6', trim: 'Sportback e-tron', year: 2026, vin: 'WAUZZZ4A9TN098765', chassisNumber: 'WAUZZZ4A9TN098765', engineNumber: 'EBJ 778120' },
      });
    })(),
  },
  {
    folder: 'qauto-inhouse-sparse',
    financingType: 'conventional_interest',
    companyCode: 'qauto-skoda',
    applicantType: 'individual',
    ctx: baseCtx({
      financingType: 'conventional_interest',
      lenderName: 'In-house finance',
      companyCode: 'qauto-skoda',
      dealerName: 'QAuto Skoda',
      sapNumber: null,
      contractSeries: null,
      contractNumber: null,
      intakeSource: 'web_lead',
      uploadedCategories: ['qid'],
      customerSnapshot: {
        full_name: 'Sara Ahmed',
        phone: '+97433445566',
        qid: '29963400777',
        applicantType: 'individual',
        address: { line1: 'Lusail Marina', city: 'Lusail' },
      },
      vehicle: { make: 'Skoda', model: 'Kodiaq', year: 2025, vin: null },
    }),
  },
  {
    folder: 'qauto-inhouse-long-values',
    financingType: 'conventional_interest',
    companyCode: 'qauto-vw',
    applicantType: 'individual',
    ctx: baseCtx({
      financingType: 'conventional_interest',
      lenderName: 'In-house finance',
      companyCode: 'qauto-vw',
      overrideReason: 'Approved above DBR cap: stable government employment, guarantor income verified, and 25% down payment.',
      customerSnapshot: {
        full_name: 'Mohammed Abdulrahman Khalifa Al-Mohannadi Al-Thani',
        phone: '+97455808586',
        qid: '28863400999',
        email: 'mohammed.abdulrahman.almohannadi@ministry-of-municipality.gov.qa',
        applicantType: 'individual',
        nationality: 'Qatar',
        address: {
          line1: 'Building 1123, Street 340, Al Waab Street, Villa Compound 7',
          area: 'Al Waab',
          zone: '55',
          city: 'Doha',
          poBox: '22781',
        },
        employment: { company: 'Ministry of Municipality and Environment', jobTitle: 'Director of Planning', employmentDuration: 'between-6-12-months' },
      },
      vehicle: { make: 'Volkswagen', model: 'Touareg', trim: 'R-Line Black Edition V6', year: 2026, chassisNumber: 'WVGZZZCRZTD012345', engineNumber: 'DCB 555001' },
    }),
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
