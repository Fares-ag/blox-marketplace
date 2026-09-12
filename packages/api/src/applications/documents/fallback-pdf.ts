import fs from 'node:fs';
import path from 'node:path';
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import type { ContractScheduleRow } from '../contract-pdf';
import { resolveBrandAssetsDir } from './apply-docx-branding';

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN_X = 48;

const BRAND = {
  deepGreen: rgb(0.086, 0.325, 0.357),
  emerald: rgb(0, 0.812, 0.635),
  slate: rgb(0.439, 0.502, 0.565),
  ink: rgb(0.071, 0.22, 0.239),
  canvas: rgb(0.957, 0.969, 0.969),
} as const;

function qar(amount: string | number): string {
  const n = typeof amount === 'number' ? amount : Number(String(amount).replace(/[^\d.-]/g, ''));
  if (!Number.isFinite(n)) return String(amount);
  return `QAR ${n.toLocaleString('en-QA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function tryReadLogo(doc: PDFDocument): Promise<Awaited<ReturnType<typeof doc.embedPng>> | null> {
  try {
    const logoPath = path.join(resolveBrandAssetsDir(), 'blox-logo-nav.png');
    if (!fs.existsSync(logoPath)) return Promise.resolve(null);
    return doc.embedPng(fs.readFileSync(logoPath));
  } catch {
    return Promise.resolve(null);
  }
}

function drawBrandHeader(
  page: PDFPage,
  title: string,
  applicationId: string,
  logo: Awaited<ReturnType<PDFDocument['embedPng']>> | null,
  bold: PDFFont,
  regular: PDFFont,
): number {
  page.drawRectangle({
    x: 0,
    y: PAGE_HEIGHT - 72,
    width: PAGE_WIDTH,
    height: 72,
    color: BRAND.deepGreen,
  });
  page.drawRectangle({
    x: 0,
    y: PAGE_HEIGHT - 76,
    width: PAGE_WIDTH,
    height: 4,
    color: BRAND.emerald,
  });

  const textX = logo ? MARGIN_X + 118 : MARGIN_X;
  if (logo) {
    page.drawImage(logo, {
      x: MARGIN_X,
      y: PAGE_HEIGHT - 58,
      width: 96,
      height: 28,
    });
  } else {
    page.drawText('BloX', { x: MARGIN_X, y: PAGE_HEIGHT - 42, size: 18, font: bold, color: rgb(1, 1, 1) });
  }

  page.drawText(title, {
    x: textX,
    y: PAGE_HEIGHT - 38,
    size: 13,
    font: bold,
    color: rgb(1, 1, 1),
  });
  page.drawText(`Application ${applicationId}`, {
    x: textX,
    y: PAGE_HEIGHT - 54,
    size: 9,
    font: regular,
    color: rgb(0.88, 0.95, 0.95),
  });

  return PAGE_HEIGHT - 96;
}

function drawBrandFooter(page: PDFPage, pageNumber: number, regular: PDFFont): void {
  page.drawLine({
    start: { x: MARGIN_X, y: 42 },
    end: { x: PAGE_WIDTH - MARGIN_X, y: 42 },
    thickness: 1,
    color: BRAND.emerald,
  });
  page.drawText('BloX LLC · blox-it.com · Own it, don\'t owe it.', {
    x: MARGIN_X,
    y: 24,
    size: 8,
    font: regular,
    color: BRAND.slate,
  });
  page.drawText(String(pageNumber), {
    x: PAGE_WIDTH - MARGIN_X - 12,
    y: 24,
    size: 8,
    font: regular,
    color: BRAND.slate,
  });
}

export async function buildFallbackPdf(input: {
  title: string;
  applicationId: string;
  fields: Array<[string, string]>;
  schedule?: ContractScheduleRow[];
}): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const logo = await tryReadLogo(doc);
  let page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = drawBrandHeader(page, input.title, input.applicationId, logo, bold, font);
  let pageNumber = 1;

  const ensure = (need: number) => {
    if (y - need < 72) {
      drawBrandFooter(page, pageNumber, font);
      pageNumber += 1;
      page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = drawBrandHeader(page, input.title, input.applicationId, logo, bold, font);
    }
  };

  const line = (text: string, size = 10, useBold = false, color = BRAND.ink) => {
    ensure(16);
    page.drawText(text.slice(0, 110), { x: MARGIN_X, y, size, font: useBold ? bold : font, color });
    y -= size + 6;
  };

  y -= 8;
  for (const [label, value] of input.fields) {
    if (!value) continue;
    line(`${label}: ${value}`);
  }

  if (input.schedule?.length) {
    line('');
    line('Ownership / rental schedule', 12, true);
    line('#  Due date      Payment        Units rent     Balance', 8, true, BRAND.slate);
    for (const row of input.schedule) {
      line(
        `${String(row.sequence).padStart(2, ' ')}  ${row.dueDate}  ${qar(row.payment).padStart(12, ' ')}  ${qar(row.interest).padStart(12, ' ')}  ${qar(row.balance).padStart(12, ' ')}`,
        8,
      );
    }
  }

  drawBrandFooter(page, pageNumber, font);
  return Buffer.from(await doc.save());
}
