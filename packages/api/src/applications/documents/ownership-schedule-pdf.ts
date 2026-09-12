import fs from 'node:fs';
import path from 'node:path';
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import { roundMoney } from '@drivemarket/shared/pricing';
import type { ContractScheduleRow } from '../contract-pdf';
import { resolveBrandAssetsDir } from './apply-docx-branding';
import type { ContractFieldContext } from './field-maps';
import { readCustomerSnapshot } from '../customer-snapshot';

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN_X = 40;

const BRAND = {
  deepGreen: rgb(0.086, 0.325, 0.357),
  emerald: rgb(0, 0.812, 0.635),
  slate: rgb(0.439, 0.502, 0.565),
  ink: rgb(0.071, 0.22, 0.239),
} as const;

function qar(amount: number): string {
  return roundMoney(amount).toLocaleString('en-QA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function unitsFor(listPrice: number, downPayment: number, tenor: number) {
  const totalUnits = 100;
  const customerOpening = listPrice > 0 ? roundMoney((downPayment / listPrice) * totalUnits) : 0;
  const bloxOpening = roundMoney(Math.max(totalUnits - customerOpening, 0));
  const unitsPerPeriod = tenor > 0 ? roundMoney(bloxOpening / tenor) : 0;
  const unitPrice = totalUnits > 0 ? roundMoney(listPrice / totalUnits) : 0;
  return { totalUnits, customerOpening, bloxOpening, unitsPerPeriod, unitPrice };
}

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

function headerBand(page: PDFPage, title: string, subtitle: string, logo: EmbeddedLogo | null, bold: PDFFont, font: PDFFont) {
  page.drawRectangle({ x: 0, y: PAGE_HEIGHT - 68, width: PAGE_WIDTH, height: 68, color: BRAND.deepGreen });
  page.drawRectangle({ x: 0, y: PAGE_HEIGHT - 72, width: PAGE_WIDTH, height: 4, color: BRAND.emerald });
  const textX = logo ? MARGIN_X + 110 : MARGIN_X;
  if (logo) {
    page.drawImage(logo, { x: MARGIN_X, y: PAGE_HEIGHT - 54, width: 90, height: 26 });
  }
  page.drawText(title, { x: textX, y: PAGE_HEIGHT - 36, size: 12, font: bold, color: rgb(1, 1, 1) });
  page.drawText(subtitle, { x: textX, y: PAGE_HEIGHT - 52, size: 8, font, color: rgb(0.88, 0.95, 0.95) });
}

export async function buildOwnershipSchedulePdf(ctx: ContractFieldContext): Promise<Buffer> {
  const snap = readCustomerSnapshot(ctx.customerSnapshot);
  const units = unitsFor(ctx.listPrice, ctx.downPayment, ctx.tenor);
  const customerOpeningPct = ctx.listPrice > 0 ? (ctx.downPayment / ctx.listPrice) * 100 : 0;

  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const logo: EmbeddedLogo | null = await tryReadLogo(doc);
  let page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - 88;
  let pageNo = 1;

  headerBand(
    page,
    'Schedule of Ownership and Rental',
    `Agreement ${ctx.applicationId} · Schedule 2 to Diminishing Musharakah Agreement`,
    logo,
    bold,
    font,
  );

  const ensure = (need: number) => {
    if (y - need < 56) {
      page.drawText(`BloX LLC · blox-it.com · Page ${pageNo}`, {
        x: MARGIN_X,
        y: 28,
        size: 8,
        font,
        color: BRAND.slate,
      });
      pageNo += 1;
      page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      headerBand(page, 'Schedule of Ownership and Rental (continued)', ctx.applicationId, logo, bold, font);
      y = PAGE_HEIGHT - 88;
    }
  };

  const line = (text: string, size = 9, useBold = false) => {
    ensure(size + 8);
    page.drawText(text.slice(0, 120), { x: MARGIN_X, y, size, font: useBold ? bold : font, color: BRAND.ink });
    y -= size + 5;
  };

  line('Agreement summary', 11, true);
  line(`Customer: ${snap.full_name}`);
  line(`Vehicle: ${ctx.vehicle.make} ${ctx.vehicle.model}${ctx.vehicle.year ? ` ${ctx.vehicle.year}` : ''}${ctx.vehicle.vin ? ` · VIN ${ctx.vehicle.vin}` : ''}`);
  line(`Total ownership units: ${units.totalUnits} · Unit price: QAR ${qar(units.unitPrice)}`);
  line(
    `Opening units — Customer: ${units.customerOpening} (${customerOpeningPct.toFixed(2)}%) · BloX: ${units.bloxOpening} (${(100 - customerOpeningPct).toFixed(2)}%)`,
  );
  line(`Units per period: ${units.unitsPerPeriod} · Rental rate: ${ctx.annualRate.toFixed(2)}% p.a. · Periods: ${ctx.tenor}`);
  line('');

  line('#  Due date    Units  Unit cost   Rental      Total       You own   BloX share', 8, true);
  for (const row of ctx.schedule) {
    const bought = units.unitsPerPeriod;
    const ownedPct =
      ctx.listPrice > 0
        ? `${(((ctx.downPayment + row.principal * row.sequence) / ctx.listPrice) * 100).toFixed(2)}%`
        : '';
    line(
      `${String(row.sequence).padStart(2, ' ')}  ${row.dueDate}  ${String(bought).padStart(5, ' ')}  ${qar(row.principal).padStart(10, ' ')}  ${qar(row.interest).padStart(10, ' ')}  ${qar(row.payment).padStart(10, ' ')}  ${ownedPct.padStart(8, ' ')}  ${qar(row.balance).padStart(10, ' ')}`,
      8,
    );
  }

  page.drawText(`BloX LLC · blox-it.com · Page ${pageNo}`, {
    x: MARGIN_X,
    y: 28,
    size: 8,
    font,
    color: BRAND.slate,
  });

  return Buffer.from(await doc.save());
}
