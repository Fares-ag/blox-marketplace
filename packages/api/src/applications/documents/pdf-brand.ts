import fs from 'node:fs';
import path from 'node:path';
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import { roundMoney } from '@drivemarket/shared/pricing';
import { resolveBrandAssetsDir } from './apply-docx-branding';

export const PAGE_WIDTH = 595;
export const PAGE_HEIGHT = 842;
export const MARGIN_X = 40;
export const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_X * 2;

export const BRAND = {
  deepGreen: rgb(0.086, 0.325, 0.357),
  emerald: rgb(0, 0.812, 0.635),
  slate: rgb(0.439, 0.502, 0.565),
  ink: rgb(0.071, 0.22, 0.239),
  white: rgb(1, 1, 1),
  canvas: rgb(0.957, 0.969, 0.969),
  border: rgb(0.82, 0.88, 0.88),
} as const;

export function formatQar(amount: number): string {
  return roundMoney(amount).toLocaleString('en-QA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatPct(value: number): string {
  return `${roundMoney(value).toFixed(2)}%`;
}

type EmbeddedLogo = Awaited<ReturnType<PDFDocument['embedPng']>>;

export async function embedBrandLogo(doc: PDFDocument): Promise<EmbeddedLogo | null> {
  try {
    const logoPath = path.join(resolveBrandAssetsDir(), 'blox-logo-nav.png');
    if (!fs.existsSync(logoPath)) return null;
    return doc.embedPng(fs.readFileSync(logoPath));
  } catch {
    return null;
  }
}

export type BrandedPdfWriterOptions = {
  title: string;
  subtitle?: string;
  footerTag?: string;
  confidential?: boolean;
};

export class BrandedPdfWriter {
  readonly doc: PDFDocument;
  readonly font: PDFFont;
  readonly bold: PDFFont;
  readonly logo: EmbeddedLogo | null;
  page: PDFPage;
  y: number;
  pageNo = 1;

  private constructor(
    doc: PDFDocument,
    font: PDFFont,
    bold: PDFFont,
    logo: EmbeddedLogo | null,
    page: PDFPage,
    y: number,
    private readonly opts: BrandedPdfWriterOptions,
  ) {
    this.doc = doc;
    this.font = font;
    this.bold = bold;
    this.logo = logo;
    this.page = page;
    this.y = y;
  }

  static async create(opts: BrandedPdfWriterOptions): Promise<BrandedPdfWriter> {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    const logo = await embedBrandLogo(doc);
    const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    const writer = new BrandedPdfWriter(doc, font, bold, logo, page, PAGE_HEIGHT - 88, opts);
    writer.drawHeader();
    return writer;
  }

  private drawHeader(): void {
    this.page.drawRectangle({ x: 0, y: PAGE_HEIGHT - 68, width: PAGE_WIDTH, height: 68, color: BRAND.deepGreen });
    this.page.drawRectangle({ x: 0, y: PAGE_HEIGHT - 72, width: PAGE_WIDTH, height: 4, color: BRAND.emerald });
    const textX = this.logo ? MARGIN_X + 110 : MARGIN_X;
    if (this.logo) {
      this.page.drawImage(this.logo, { x: MARGIN_X, y: PAGE_HEIGHT - 54, width: 90, height: 26 });
    } else {
      this.page.drawText('BloX', { x: MARGIN_X, y: PAGE_HEIGHT - 42, size: 16, font: this.bold, color: BRAND.white });
    }
    this.page.drawText(this.opts.title, {
      x: textX,
      y: PAGE_HEIGHT - 36,
      size: 12,
      font: this.bold,
      color: BRAND.white,
    });
    const sub = this.opts.subtitle ?? (this.opts.confidential ? 'INTERNAL — CONFIDENTIAL' : 'BloX LLC · Qatar Financial Centre · Doha, Qatar');
    this.page.drawText(sub, {
      x: textX,
      y: PAGE_HEIGHT - 52,
      size: 8,
      font: this.font,
      color: rgb(0.88, 0.95, 0.95),
    });
    this.page.drawText('BloX LLC · QFC No. 03403', {
      x: PAGE_WIDTH - MARGIN_X - 130,
      y: PAGE_HEIGHT - 36,
      size: 7,
      font: this.font,
      color: rgb(0.88, 0.95, 0.95),
    });
  }

  private drawFooter(): void {
    const tag = this.opts.footerTag ?? (this.opts.confidential ? 'BloX LLC · INTERNAL · CONFIDENTIAL · blox-it.com' : 'BloX LLC · blox-it.com · Own it, don\'t owe it.');
    this.page.drawLine({
      start: { x: MARGIN_X, y: 42 },
      end: { x: PAGE_WIDTH - MARGIN_X, y: 42 },
      thickness: 0.75,
      color: BRAND.emerald,
    });
    this.page.drawText(tag, { x: MARGIN_X, y: 26, size: 8, font: this.font, color: BRAND.slate });
    this.page.drawText(String(this.pageNo), {
      x: PAGE_WIDTH - MARGIN_X - 10,
      y: 26,
      size: 8,
      font: this.font,
      color: BRAND.slate,
    });
  }

  ensure(need: number): void {
    if (this.y - need >= 56) return;
    this.drawFooter();
    this.pageNo += 1;
    this.page = this.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    this.drawHeader();
    this.y = PAGE_HEIGHT - 88;
  }

  line(text: string, size = 9, useBold = false, color = BRAND.ink): void {
    this.ensure(size + 10);
    this.page.drawText(text.slice(0, 120), {
      x: MARGIN_X,
      y: this.y,
      size,
      font: useBold ? this.bold : this.font,
      color,
    });
    this.y -= size + 5;
  }

  section(title: string): void {
    this.y -= 4;
    this.line(title, 11, true, BRAND.deepGreen);
    this.y -= 2;
  }

  keyValue(label: string, value: string | undefined | null): void {
    if (!value?.trim()) return;
    this.line(`${label}: ${value}`, 9);
  }

  metaGrid(rows: Array<[string, string]>): void {
    const colWidth = CONTENT_WIDTH / 2 - 6;
    const rowHeight = 22;
    const visible = rows.filter(([, value]) => value?.trim());
    if (!visible.length) return;
    const rowsCount = Math.ceil(visible.length / 2);
    this.ensure(rowsCount * rowHeight + 8);

    for (let i = 0; i < visible.length; i += 2) {
      const rowY = this.y - rowHeight + 6;
      for (let col = 0; col < 2; col += 1) {
        const entry = visible[i + col];
        if (!entry) continue;
        const x = MARGIN_X + col * (colWidth + 12);
        this.page.drawRectangle({
          x,
          y: rowY,
          width: colWidth,
          height: rowHeight,
          borderColor: BRAND.border,
          borderWidth: 0.75,
          color: BRAND.canvas,
        });
        this.page.drawText(entry[0], { x: x + 6, y: rowY + 12, size: 7, font: this.font, color: BRAND.slate });
        this.page.drawText(entry[1].slice(0, 42), {
          x: x + 6,
          y: rowY + 2,
          size: 9,
          font: this.bold,
          color: BRAND.ink,
        });
      }
      this.y -= rowHeight + 4;
    }
    this.y -= 4;
  }

  table(columns: Array<{ label: string; width: number; align?: 'left' | 'right' }>, rows: string[][]): void {
    const headerH = 18;
    const rowH = 16;
    this.ensure(headerH + rowH);

    let x = MARGIN_X;
    for (const col of columns) {
      this.page.drawRectangle({
        x,
        y: this.y - headerH + 4,
        width: col.width,
        height: headerH,
        color: BRAND.deepGreen,
      });
      this.page.drawText(col.label.slice(0, 14), {
        x: x + 4,
        y: this.y - headerH + 8,
        size: 7,
        font: this.bold,
        color: BRAND.white,
      });
      x += col.width;
    }
    this.y -= headerH + 2;

    for (const row of rows) {
      this.ensure(rowH + 4);
      let cellX = MARGIN_X;
      for (let i = 0; i < columns.length; i += 1) {
        const col = columns[i];
        const value = row[i] ?? '';
        this.page.drawRectangle({
          x: cellX,
          y: this.y - rowH + 4,
          width: col.width,
          height: rowH,
          borderColor: BRAND.border,
          borderWidth: 0.5,
        });
        const textX = col.align === 'right' ? cellX + col.width - 4 - this.font.widthOfTextAtSize(value.slice(0, 16), 7) : cellX + 4;
        this.page.drawText(value.slice(0, 16), {
          x: Math.max(cellX + 2, textX),
          y: this.y - rowH + 8,
          size: 7,
          font: this.font,
          color: BRAND.ink,
        });
        cellX += col.width;
      }
      this.y -= rowH;
    }
    this.y -= 6;
  }

  signatureBlock(leftTitle: string, rightTitle: string): void {
    this.ensure(70);
    this.y -= 8;
    const leftX = MARGIN_X;
    const rightX = PAGE_WIDTH / 2 + 8;
    this.page.drawText(leftTitle, { x: leftX, y: this.y, size: 10, font: this.bold, color: BRAND.ink });
    this.page.drawText(rightTitle, { x: rightX, y: this.y, size: 10, font: this.bold, color: BRAND.ink });
    this.y -= 28;
    this.page.drawLine({ start: { x: leftX, y: this.y }, end: { x: leftX + 200, y: this.y }, thickness: 0.75, color: BRAND.slate });
    this.page.drawLine({ start: { x: rightX, y: this.y }, end: { x: rightX + 200, y: this.y }, thickness: 0.75, color: BRAND.slate });
    this.y -= 14;
    this.page.drawText('Name: ___________________________', { x: leftX, y: this.y, size: 8, font: this.font, color: BRAND.slate });
    this.page.drawText('Name: ___________________________', { x: rightX, y: this.y, size: 8, font: this.font, color: BRAND.slate });
    this.y -= 14;
    this.page.drawText('Date: ____________________________', { x: leftX, y: this.y, size: 8, font: this.font, color: BRAND.slate });
    this.page.drawText('Date: ____________________________', { x: rightX, y: this.y, size: 8, font: this.font, color: BRAND.slate });
    this.y -= 10;
  }

  async toBuffer(): Promise<Buffer> {
    this.drawFooter();
    return Buffer.from(await this.doc.save());
  }
}
