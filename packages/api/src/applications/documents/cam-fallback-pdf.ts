import fs from 'node:fs';
import path from 'node:path';
import { PDFDocument, StandardFonts, rgb, type PDFFont } from 'pdf-lib';
import { resolveBrandAssetsDir } from './apply-docx-branding';
import { camFields, commonDealFields, type ContractFieldContext } from './field-maps';
import { readCustomerSnapshot } from '../customer-snapshot';

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN_X = 48;

const BRAND = {
  deepGreen: rgb(0.086, 0.325, 0.357),
  emerald: rgb(0, 0.812, 0.635),
  slate: rgb(0.439, 0.502, 0.565),
  ink: rgb(0.071, 0.22, 0.239),
} as const;

type EmbeddedLogo = Awaited<ReturnType<PDFDocument['embedPng']>>;

async function tryReadLogo(doc: PDFDocument): Promise<EmbeddedLogo | null> {
  try {
    const logoPath = path.join(resolveBrandAssetsDir(), 'blox-logo-nav.png');
    if (!fs.existsSync(logoPath)) return null;
    return doc.embedPng(fs.readFileSync(logoPath));
  } catch {
    return null;
  }
}

function headerBand(page: PDFPage, logo: EmbeddedLogo | null, bold: PDFFont, font: PDFFont) {
  page.drawRectangle({ x: 0, y: PAGE_HEIGHT - 68, width: PAGE_WIDTH, height: 68, color: BRAND.deepGreen });
  page.drawRectangle({ x: 0, y: PAGE_HEIGHT - 72, width: PAGE_WIDTH, height: 4, color: BRAND.emerald });
  const textX = logo ? MARGIN_X + 110 : MARGIN_X;
  if (logo) page.drawImage(logo, { x: MARGIN_X, y: PAGE_HEIGHT - 54, width: 90, height: 26 });
  page.drawText('Credit Appraisal Memorandum', { x: textX, y: PAGE_HEIGHT - 36, size: 12, font: bold, color: rgb(1, 1, 1) });
  page.drawText('INTERNAL — CONFIDENTIAL', { x: textX, y: PAGE_HEIGHT - 52, size: 8, font, color: rgb(0.88, 0.95, 0.95) });
}

export async function buildCamFallbackPdf(ctx: ContractFieldContext): Promise<Buffer> {
  const snap = readCustomerSnapshot(ctx.customerSnapshot);
  const deal = commonDealFields(ctx);
  const cam = camFields(ctx);
  const fields = { ...deal, ...cam };

  const sections: Array<[string, string[]]> = [
    [
      '1. Facility summary',
      [
        'CAM.Ref',
        'Application.Number',
        'Customer.FullNameEN',
        'Customer.QID',
        'Vehicle.MakeModel',
        'Price.TotalCost',
        'Price.CustomerContribution',
        'Price.BloXContribution',
        'Credit.LTV',
        'Deal.RentalRate',
        'Deal.PeriodicPayment',
        'Offer.TermMonths',
      ],
    ],
    [
      '2. Affordability',
      ['Income.TotalMonthly', 'Obligation.TotalMonthly', 'Deal.PeriodicPayment', 'Credit.DBR', 'Credit.DBRResult', 'Credit.ResidualIncome'],
    ],
    [
      '3. Credit decision',
      ['BRE.Decision', 'BRE.RiskGrade', 'BRE.RulesTriggered', 'BRE.OverrideApplied', 'BRE.OverrideReason', 'CAM.Recommendation'],
    ],
    [
      '4. Compliance screening',
      ['Screen.eKYCResult', 'Screen.LivenessResult', 'Screen.SanctionsResult', 'Screen.PEPResult', 'KYC.CaseStatus'],
    ],
    [
      '5. Underwriter assessment',
      ['CAM.Strengths', 'CAM.Weaknesses', 'CAM.Mitigants', 'Decision.Outcome', 'Approval.Approver.Name', 'Approval.Approver.Timestamp'],
    ],
  ];

  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const logo = await tryReadLogo(doc);
  let page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - 88;
  let pageNo = 1;

  headerBand(page, logo, bold, font);

  const ensure = (need: number) => {
    if (y - need < 48) {
      page.drawText(`BloX LLC · INTERNAL · Page ${pageNo}`, { x: MARGIN_X, y: 24, size: 8, font, color: BRAND.slate });
      pageNo += 1;
      page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      headerBand(page, logo, bold, font);
      y = PAGE_HEIGHT - 88;
    }
  };

  const line = (text: string, size = 9, useBold = false) => {
    ensure(size + 8);
    page.drawText(text.slice(0, 105), { x: MARGIN_X, y, size, font: useBold ? bold : font, color: BRAND.ink });
    y -= size + 5;
  };

  line(`Applicant: ${snap.full_name} · Application ${ctx.applicationId}`, 10);
  line('');

  for (const [heading, keys] of sections) {
    line(heading, 11, true);
    for (const key of keys) {
      const value = fields[key];
      if (!value) continue;
      line(`${key.replace(/\./g, ' ')}: ${value}`);
    }
    line('');
  }

  page.drawText(`BloX LLC · INTERNAL · Page ${pageNo}`, { x: MARGIN_X, y: 24, size: 8, font, color: BRAND.slate });
  return Buffer.from(await doc.save());
}
