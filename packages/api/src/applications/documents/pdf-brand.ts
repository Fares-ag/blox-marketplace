import fs from 'node:fs';
import path from 'node:path';
import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import { roundMoney } from '@drivemarket/shared/pricing';
import { resolveBrandAssetsDir } from './apply-docx-branding';
import { reshapeArabic, shapeArabicLine, toVisualOrder } from './arabic-shaping';
import { wrapText } from './pdf-text';

export const PAGE_WIDTH = 595;
export const PAGE_HEIGHT = 842;
export const MARGIN_X = 40;
export const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_X * 2;
export const HEADER_HEIGHT = 76;
export const CONTENT_TOP_Y = PAGE_HEIGHT - HEADER_HEIGHT - 24;
export const FOOTER_RESERVE = 60;

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
  /** Load Noto Sans Arabic for bilingual contract clauses. */
  arabic?: boolean;
};

async function embedArabicFont(doc: PDFDocument): Promise<PDFFont | null> {
  try {
    const fontPath = path.join(resolveBrandAssetsDir(), 'NotoSansArabic-Regular.ttf');
    if (!fs.existsSync(fontPath)) return null;
    return doc.embedFont(fs.readFileSync(fontPath), { subset: true });
  } catch {
    return null;
  }
}

export class BrandedPdfWriter {
  readonly doc: PDFDocument;
  readonly font: PDFFont;
  readonly bold: PDFFont;
  readonly arabicFont: PDFFont | null;
  readonly logo: EmbeddedLogo | null;
  page: PDFPage;
  y: number;
  pageNo = 1;
  private onNewPage: (() => void) | null = null;

  private constructor(
    doc: PDFDocument,
    font: PDFFont,
    bold: PDFFont,
    arabicFont: PDFFont | null,
    logo: EmbeddedLogo | null,
    page: PDFPage,
    y: number,
    private readonly opts: BrandedPdfWriterOptions,
  ) {
    this.doc = doc;
    this.font = font;
    this.bold = bold;
    this.arabicFont = arabicFont;
    this.logo = logo;
    this.page = page;
    this.y = y;
  }

  static async create(opts: BrandedPdfWriterOptions): Promise<BrandedPdfWriter> {
    const doc = await PDFDocument.create();
    doc.registerFontkit(fontkit);
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    const arabicFont = opts.arabic ? await embedArabicFont(doc) : null;
    const logo = await embedBrandLogo(doc);
    const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    const writer = new BrandedPdfWriter(doc, font, bold, arabicFont, logo, page, CONTENT_TOP_Y, opts);
    writer.drawHeader();
    return writer;
  }

  private drawHeader(): void {
    const bandTop = PAGE_HEIGHT - HEADER_HEIGHT;
    this.page.drawRectangle({ x: 0, y: bandTop, width: PAGE_WIDTH, height: HEADER_HEIGHT, color: BRAND.deepGreen });
    this.page.drawRectangle({ x: 0, y: bandTop - 4, width: PAGE_WIDTH, height: 4, color: BRAND.emerald });

    // QFC identifier, top-right.
    const qfc = 'BloX LLC · QFC No. 03403';
    this.page.drawText(qfc, {
      x: PAGE_WIDTH - MARGIN_X - this.font.widthOfTextAtSize(qfc, 7),
      y: PAGE_HEIGHT - 20,
      size: 7,
      font: this.font,
      color: rgb(0.88, 0.95, 0.95),
    });

    // Reserved brand zone on the left so the title can never collide with the wordmark.
    const brandZoneW = 96;
    const logoW = 84;
    const logoH = Math.round((logoW / 1320800) * 392430);
    if (this.logo) {
      this.page.drawImage(this.logo, { x: MARGIN_X, y: PAGE_HEIGHT - 30 - logoH, width: logoW, height: logoH });
    } else {
      this.page.drawText('BloX', { x: MARGIN_X, y: PAGE_HEIGHT - 34, size: 15, font: this.bold, color: BRAND.white });
    }
    // Thin divider between brand zone and title.
    this.page.drawLine({
      start: { x: MARGIN_X + brandZoneW, y: PAGE_HEIGHT - 16 },
      end: { x: MARGIN_X + brandZoneW, y: bandTop + 16 },
      thickness: 0.5,
      color: rgb(0.4, 0.6, 0.6),
    });

    const titleX = MARGIN_X + brandZoneW + 14;
    const titleMaxWidth = PAGE_WIDTH - MARGIN_X - titleX;
    const titleLines = wrapText(this.opts.title, titleMaxWidth, this.bold, 11).slice(0, 2);
    // Vertically centre the title lines within the band.
    let titleY = PAGE_HEIGHT - 30 - (titleLines.length === 1 ? 0 : 7);
    for (const line of titleLines) {
      this.page.drawText(line, { x: titleX, y: titleY, size: 11, font: this.bold, color: BRAND.white });
      titleY -= 14;
    }

    const sub =
      this.opts.subtitle ??
      (this.opts.confidential ? 'INTERNAL — CONFIDENTIAL' : 'BloX LLC · Qatar Financial Centre · Doha, Qatar');
    const subLine = wrapText(sub, titleMaxWidth, this.font, 7.5)[0] ?? '';
    this.page.drawText(subLine, {
      x: titleX,
      y: bandTop + 12,
      size: 7.5,
      font: this.font,
      color: rgb(0.82, 0.92, 0.92),
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
    if (this.y - need >= FOOTER_RESERVE) return;
    this.drawFooter();
    this.pageNo += 1;
    this.page = this.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    this.drawHeader();
    this.y = CONTENT_TOP_Y;
    this.onNewPage?.();
  }

  line(text: string, size = 9, useBold = false, color = BRAND.ink): void {
    this.paragraph(text, { size, bold: useBold, color, gap: 3 });
  }

  paragraph(
    text: string,
    opts?: { size?: number; bold?: boolean; color?: typeof BRAND.ink; indent?: number; gap?: number; maxWidth?: number },
  ): void {
    const size = opts?.size ?? 9;
    const indent = opts?.indent ?? 0;
    const font = opts?.bold ? this.bold : this.font;
    const color = opts?.color ?? BRAND.ink;
    const maxWidth = opts?.maxWidth ?? CONTENT_WIDTH - indent;
    for (const wrapped of wrapText(text, maxWidth, font, size)) {
      this.ensure(size + 7);
      this.page.drawText(wrapped, { x: MARGIN_X + indent, y: this.y, size, font, color });
      this.y -= size + 4.5;
    }
    this.y -= opts?.gap ?? 5;
  }

  /** Shape a single Arabic label to visual order (reshape + bidi). */
  private ar(text: string): string {
    return this.arabicFont ? shapeArabicLine(text) : text;
  }

  private static isArabicChar(ch: string): boolean {
    const code = ch.codePointAt(0) ?? 0;
    return (
      (code >= 0x0600 && code <= 0x06ff) ||
      (code >= 0x0750 && code <= 0x077f) ||
      (code >= 0x08a0 && code <= 0x08ff) ||
      (code >= 0xfb50 && code <= 0xfdff) ||
      (code >= 0xfe70 && code <= 0xfeff)
    );
  }

  /** Split a string into runs that should be drawn with the Arabic vs the Latin font. */
  private runsByFont(text: string): Array<{ text: string; arabic: boolean }> {
    const runs: Array<{ text: string; arabic: boolean }> = [];
    let current = '';
    let arabic: boolean | null = null;
    for (const ch of text) {
      if (ch === ' ') {
        current += ch; // spaces stay with the current run
        continue;
      }
      const a = BrandedPdfWriter.isArabicChar(ch);
      if (arabic === null || a === arabic) {
        current += ch;
        arabic = a;
      } else {
        runs.push({ text: current, arabic });
        current = ch;
        arabic = a;
      }
    }
    if (current) runs.push({ text: current, arabic: arabic ?? false });
    return runs;
  }

  /** Width of a mixed Arabic/Latin string, measuring each run with its own font. */
  private measureMixed(text: string, size: number): number {
    let width = 0;
    for (const run of this.runsByFont(text)) {
      const font = run.arabic && this.arabicFont ? this.arabicFont : this.font;
      width += font.widthOfTextAtSize(run.text, size);
    }
    return width;
  }

  /** Wrap mixed text into lines that fit `maxWidth`, measuring per-font. */
  private wrapMixed(text: string, maxWidth: number, size: number): string[] {
    const words = text.replace(/\s+/g, ' ').trim().split(' ');
    const lines: string[] = [];
    let current = '';
    for (const word of words) {
      const test = current ? `${current} ${word}` : word;
      if (this.measureMixed(test, size) <= maxWidth || !current) {
        current = test;
      } else {
        lines.push(current);
        current = word;
      }
    }
    if (current) lines.push(current);
    return lines;
  }

  /** Wrap Arabic text into visually-ordered lines that fit `maxWidth`. */
  private arWrapVisual(text: string, maxWidth: number, size: number): string[] {
    if (!this.arabicFont) return [];
    // Reshape in logical order, wrap by width (per-font), then reorder each line to visual order.
    const reshaped = reshapeArabic(text);
    return this.wrapMixed(reshaped, maxWidth, size).map((line) => toVisualOrder(line));
  }

  /** Draw one visually-ordered mixed line right-aligned at a given right edge and baseline. */
  private drawArabicLineRight(
    visual: string,
    size: number,
    color: typeof BRAND.ink,
    rightX = PAGE_WIDTH - MARGIN_X,
    atY = this.y,
  ): void {
    const total = this.measureMixed(visual, size);
    let x = rightX - total;
    for (const run of this.runsByFont(visual)) {
      const font = run.arabic && this.arabicFont ? this.arabicFont : this.font;
      this.page.drawText(run.text, { x, y: atY, size, font, color });
      x += font.widthOfTextAtSize(run.text, size);
    }
  }

  paragraphAr(text: string, opts?: { size?: number; gap?: number }): void {
    if (!this.arabicFont) return;
    const size = opts?.size ?? 8.5;
    const maxWidth = CONTENT_WIDTH;
    for (const visual of this.arWrapVisual(text, maxWidth, size)) {
      this.ensure(size + 7);
      this.drawArabicLineRight(visual, size, BRAND.slate);
      this.y -= size + 4.5;
    }
    this.y -= opts?.gap ?? 7;
  }

  /** Draw a horizontally centred line of Latin text at the current cursor. */
  private centerText(text: string, size: number, font: PDFFont, color: typeof BRAND.ink, letterSpace = 0): void {
    let width = font.widthOfTextAtSize(text, size);
    if (letterSpace) width += letterSpace * Math.max(text.length - 1, 0);
    if (letterSpace) {
      let x = PAGE_WIDTH / 2 - width / 2;
      for (const ch of text) {
        this.page.drawText(ch, { x, y: this.y, size, font, color });
        x += font.widthOfTextAtSize(ch, size) + letterSpace;
      }
    } else {
      this.page.drawText(text, { x: PAGE_WIDTH / 2 - width / 2, y: this.y, size, font, color });
    }
  }

  private centerAr(text: string, size: number, color = BRAND.slate): void {
    if (!this.arabicFont) return;
    const shaped = this.ar(text);
    const width = this.arabicFont.widthOfTextAtSize(shaped, size);
    this.page.drawText(shaped, { x: PAGE_WIDTH / 2 - width / 2, y: this.y, size, font: this.arabicFont, color });
  }

  /** Full-width horizontal rule at the current cursor. */
  private hr(color = BRAND.emerald, thickness = 1, inset = 0): void {
    this.page.drawLine({
      start: { x: MARGIN_X + inset, y: this.y },
      end: { x: PAGE_WIDTH - MARGIN_X - inset, y: this.y },
      thickness,
      color,
    });
  }

  section(title: string, titleAr?: string): void {
    this.ensure(40);
    this.y -= 12;
    const barH = 13;
    // Green accent tab to the left of the heading.
    this.page.drawRectangle({ x: MARGIN_X, y: this.y - 1, width: 3, height: barH, color: BRAND.emerald });
    this.page.drawText(title, { x: MARGIN_X + 9, y: this.y, size: 11, font: this.bold, color: BRAND.deepGreen });
    if (titleAr && this.arabicFont) {
      const ar = this.ar(titleAr);
      const w = this.arabicFont.widthOfTextAtSize(ar, 9.5);
      this.page.drawText(ar, { x: PAGE_WIDTH - MARGIN_X - w, y: this.y, size: 9.5, font: this.arabicFont, color: BRAND.deepGreen });
    }
    this.y -= barH;
    this.hr(BRAND.border, 0.75);
    this.y -= 10;
  }

  /** English left, Arabic right on the same baseline. */
  bilingualLine(en: string, ar: string, opts?: { size?: number; bold?: boolean; color?: typeof BRAND.ink; gap?: number }): void {
    const size = opts?.size ?? 9;
    const font = opts?.bold ? this.bold : this.font;
    const color = opts?.color ?? BRAND.ink;
    this.ensure(size + 8);
    this.page.drawText(en, { x: MARGIN_X, y: this.y, size, font, color });
    if (this.arabicFont && ar.trim()) {
      const arSize = Math.max(size - 0.5, 7);
      const shaped = this.ar(ar);
      const width = this.arabicFont.widthOfTextAtSize(shaped, arSize);
      this.page.drawText(shaped, {
        x: PAGE_WIDTH - MARGIN_X - width,
        y: this.y,
        size: arSize,
        font: this.arabicFont,
        color: opts?.bold ? color : BRAND.slate,
      });
    }
    this.y -= size + (opts?.gap ?? 5);
  }

  /** Bordered callout for internal notices and policy rules. */
  noticeBox(titleEn: string, titleAr: string, bodyEn: string, bodyAr: string): void {
    const pad = 11;
    const titleSize = 8.5;
    const bodySize = 8;
    const bodyEnLines = wrapText(bodyEn, CONTENT_WIDTH - pad * 2, this.font, bodySize);
    const bodyArLines = this.arabicFont ? this.arWrapVisual(bodyAr, CONTENT_WIDTH - pad * 2, bodySize - 0.5) : [];
    const height = pad * 2 + titleSize + 6 + bodyEnLines.length * (bodySize + 2) + bodyArLines.length * (bodySize + 1) + 4;
    this.ensure(height + 8);
    const boxBottom = this.y - height;
    this.page.drawRectangle({
      x: MARGIN_X,
      y: boxBottom,
      width: CONTENT_WIDTH,
      height,
      borderColor: BRAND.emerald,
      borderWidth: 1,
      color: BRAND.canvas,
    });
    let cursor = this.y - pad - titleSize;
    this.page.drawText(titleEn, { x: MARGIN_X + pad, y: cursor, size: titleSize, font: this.bold, color: BRAND.deepGreen });
    if (this.arabicFont) {
      const arTitleText = this.ar(titleAr);
      const arTitle = this.arabicFont.widthOfTextAtSize(arTitleText, titleSize - 0.5);
      this.page.drawText(arTitleText, {
        x: PAGE_WIDTH - MARGIN_X - pad - arTitle,
        y: cursor,
        size: titleSize - 0.5,
        font: this.arabicFont,
        color: BRAND.deepGreen,
      });
    }
    cursor -= titleSize + 4;
    for (const line of bodyEnLines) {
      cursor -= bodySize + 2;
      this.page.drawText(line, { x: MARGIN_X + pad, y: cursor, size: bodySize, font: this.font, color: BRAND.ink });
    }
    for (const line of bodyArLines) {
      cursor -= bodySize + 1;
      this.drawArabicLineRight(line, bodySize - 0.5, BRAND.slate, PAGE_WIDTH - MARGIN_X - pad, cursor);
    }
    this.y = boxBottom - 10;
  }

  /** Template metadata strip — label/value pairs in four columns. */
  metaStrip(rows: Array<[string, string, string, string]>): void {
    const rowH = 15;
    for (const [a, b, c, d] of rows) {
      this.ensure(rowH + 2);
      const colW = CONTENT_WIDTH / 4;
      const cells: Array<[string, boolean]> = [
        [a, true],
        [b, false],
        [c, true],
        [d, false],
      ];
      for (let i = 0; i < cells.length; i += 1) {
        const [text, isLabel] = cells[i]!;
        this.page.drawText(text, {
          x: MARGIN_X + i * colW + 2,
          y: this.y - 10,
          size: isLabel ? 6.5 : 7.5,
          font: isLabel ? this.font : this.bold,
          color: isLabel ? BRAND.slate : BRAND.ink,
        });
      }
      this.y -= rowH;
    }
    this.y -= 4;
  }

  /** Bilingual label + value cells in a two-column grid (CAM facility summary). Values wrap up to 3 lines. */
  definitionGrid(rows: Array<Array<{ en: string; ar: string; value: string }>>): void {
    const colW = CONTENT_WIDTH / 2 - 3;
    const valueSize = 8;
    const lineH = valueSize + 3;
    for (const row of rows) {
      // Row height grows with the tallest wrapped value in the row.
      const wrapped = row.map((cell) =>
        cell ? wrapText(cell.value || '—', colW - 16, this.bold, valueSize).slice(0, 3) : [],
      );
      const maxLines = Math.max(1, ...wrapped.map((lines) => lines.length));
      const rowH = 22 + maxLines * lineH;
      this.ensure(rowH + 4);
      for (let col = 0; col < 2; col += 1) {
        const cell = row[col];
        if (!cell) continue;
        const x = MARGIN_X + col * (colW + 6);
        this.page.drawRectangle({
          x,
          y: this.y - rowH + 4,
          width: colW,
          height: rowH,
          borderColor: BRAND.border,
          borderWidth: 0.5,
          color: BRAND.white,
        });
        this.page.drawText(cell.en, { x: x + 8, y: this.y - 11, size: 7, font: this.font, color: BRAND.slate });
        if (this.arabicFont) {
          const arLabel = this.ar(cell.ar);
          const arW = this.arabicFont.widthOfTextAtSize(arLabel, 6.5);
          this.page.drawText(arLabel, {
            x: x + colW - 8 - arW,
            y: this.y - 11,
            size: 6.5,
            font: this.arabicFont,
            color: BRAND.slate,
          });
        }
        let vy = this.y - 24;
        for (const line of wrapped[col]!) {
          this.page.drawText(line, { x: x + 8, y: vy, size: valueSize, font: this.bold, color: BRAND.ink });
          vy -= lineH;
        }
      }
      this.y -= rowH + 5;
    }
    this.y -= 4;
  }

  /** Multi-line text block for underwriter narrative fields. */
  textBlock(labelEn: string, labelAr: string, value: string): void {
    this.bilingualLine(labelEn, labelAr, { size: 8, bold: true, color: BRAND.slate, gap: 2 });
    this.paragraph(value.trim() || '—', { size: 9, gap: 8 });
  }

  keyValue(label: string, value: string | undefined | null): void {
    if (!value?.trim()) return;
    this.paragraph(`${label}: ${value}`, { size: 9 });
  }

  /** Formal contract cover — replaces the metadata grid on agreement documents. */
  contractCover(fields: {
    titleEn: string;
    titleAr: string;
    subtitleEn: string;
    subtitleAr: string;
    contractNo: string;
    executionDate: string;
    draft?: boolean;
  }): void {
    // Logo sits on a deep-green banner because the wordmark is white.
    const logoW = 150;
    const logoH = Math.round((logoW / 1320800) * 392430);
    this.y = PAGE_HEIGHT - HEADER_HEIGHT - 66;
    if (this.logo) {
      const chipW = logoW + 44;
      const chipH = logoH + 30;
      const chipX = PAGE_WIDTH / 2 - chipW / 2;
      const chipY = this.y - chipH + 18;
      this.page.drawRectangle({ x: chipX, y: chipY, width: chipW, height: chipH, color: BRAND.deepGreen });
      this.page.drawRectangle({ x: chipX, y: chipY - 3, width: chipW, height: 3, color: BRAND.emerald });
      this.page.drawImage(this.logo, {
        x: PAGE_WIDTH / 2 - logoW / 2,
        y: chipY + (chipH - logoH) / 2,
        width: logoW,
        height: logoH,
      });
      this.y = chipY - 22;
    } else {
      this.centerText('BloX', 30, this.bold, BRAND.deepGreen);
      this.y -= 34;
    }
    this.centerText('FINANCE UNBOXED', 8, this.font, BRAND.emerald, 3);
    this.y -= 44;

    // Title block framed by rules.
    this.hr(BRAND.emerald, 1.5, 60);
    this.y -= 26;
    for (const line of wrapText(fields.titleEn, CONTENT_WIDTH - 40, this.bold, 22)) {
      this.centerText(line, 22, this.bold, BRAND.deepGreen);
      this.y -= 27;
    }
    this.y -= 2;
    if (this.arabicFont) {
      this.centerAr(fields.titleAr, 15, BRAND.deepGreen);
      this.y -= 24;
    }
    this.y -= 4;
    this.hr(BRAND.emerald, 1.5, 60);
    this.y -= 30;

    for (const line of wrapText(fields.subtitleEn, CONTENT_WIDTH - 60, this.font, 11)) {
      this.centerText(line, 11, this.font, BRAND.slate);
      this.y -= 15;
    }
    this.y -= 2;
    if (this.arabicFont) {
      this.centerAr(fields.subtitleAr, 10);
      this.y -= 18;
    }
    this.y -= 30;

    // Contract particulars box.
    const boxW = 340;
    const boxX = PAGE_WIDTH / 2 - boxW / 2;
    const boxH = 56;
    const boxTop = this.y;
    this.page.drawRectangle({
      x: boxX,
      y: boxTop - boxH,
      width: boxW,
      height: boxH,
      borderColor: BRAND.border,
      borderWidth: 0.75,
      color: BRAND.canvas,
    });
    const midX = boxX + boxW / 2;
    this.page.drawLine({ start: { x: midX, y: boxTop - boxH + 8 }, end: { x: midX, y: boxTop - 8 }, thickness: 0.5, color: BRAND.border });
    const cellLabel = (x: number, label: string) =>
      this.page.drawText(label, { x, y: boxTop - 18, size: 7, font: this.font, color: BRAND.slate });
    const cellValue = (x: number, value: string) =>
      this.page.drawText(value, { x, y: boxTop - 34, size: 11, font: this.bold, color: BRAND.deepGreen });
    cellLabel(boxX + 16, 'CONTRACT No.');
    cellValue(boxX + 16, fields.contractNo);
    cellLabel(midX + 16, 'DATE OF EXECUTION');
    cellValue(midX + 16, fields.executionDate);
    this.page.drawText('Place: Doha, State of Qatar', {
      x: boxX + 16,
      y: boxTop - boxH + 8,
      size: 7,
      font: this.font,
      color: BRAND.slate,
    });
    this.y = boxTop - boxH - 22;

    if (fields.draft) {
      this.centerText('DRAFT — FOR LEGAL AND SHARIAH REVIEW BEFORE USE', 9, this.bold, BRAND.deepGreen);
      this.y -= 14;
      if (this.arabicFont) {
        this.centerAr('مسودة — للمراجعة القانونية والشرعية قبل الاستخدام', 8.5);
        this.y -= 16;
      }
    }
  }

  tableOfContents(entries: Array<{ number: string; titleEn: string; titleAr: string }>): void {
    this.section('Contents', 'المحتويات');
    const rowH = 15;
    for (const entry of entries) {
      this.ensure(rowH + 2);
      const numLabel = `${entry.number}.`;
      this.page.drawText(numLabel, { x: MARGIN_X, y: this.y, size: 9, font: this.bold, color: BRAND.emerald });
      this.page.drawText(entry.titleEn, { x: MARGIN_X + 22, y: this.y, size: 9, font: this.font, color: BRAND.ink });
      const arTitle = this.arabicFont ? this.ar(entry.titleAr) : '';
      if (this.arabicFont) {
        const w = this.arabicFont.widthOfTextAtSize(arTitle, 8.5);
        this.page.drawText(arTitle, { x: PAGE_WIDTH - MARGIN_X - w, y: this.y, size: 8.5, font: this.arabicFont, color: BRAND.slate });
      }
      // Dotted leader between EN title and AR title.
      const enWidth = this.font.widthOfTextAtSize(entry.titleEn, 9);
      const leaderStart = MARGIN_X + 22 + enWidth + 6;
      const leaderEnd = PAGE_WIDTH - MARGIN_X - (this.arabicFont ? this.arabicFont.widthOfTextAtSize(arTitle, 8.5) + 6 : 0);
      if (leaderEnd - leaderStart > 20) {
        this.page.drawLine({
          start: { x: leaderStart, y: this.y + 2 },
          end: { x: leaderEnd, y: this.y + 2 },
          thickness: 0.4,
          color: BRAND.border,
          dashArray: [1, 2],
        });
      }
      this.y -= rowH;
    }
    this.y -= 8;
  }

  clause(number: string, titleEn: string, titleAr: string, bodyEn: string[], bodyAr: string[]): void {
    // Keep the heading with at least its first line of body on the same page.
    this.ensure(54);
    this.y -= 12;
    const barH = 13;
    this.page.drawRectangle({ x: MARGIN_X, y: this.y - 1, width: 3, height: barH, color: BRAND.emerald });
    this.page.drawText(`${number}.`, { x: MARGIN_X + 9, y: this.y, size: 11, font: this.bold, color: BRAND.emerald });
    const numW = this.bold.widthOfTextAtSize(`${number}.`, 11);
    this.page.drawText(titleEn, { x: MARGIN_X + 9 + numW + 5, y: this.y, size: 11, font: this.bold, color: BRAND.deepGreen });
    if (titleAr && this.arabicFont) {
      const ar = this.ar(titleAr);
      const w = this.arabicFont.widthOfTextAtSize(ar, 9.5);
      this.page.drawText(ar, { x: PAGE_WIDTH - MARGIN_X - w, y: this.y, size: 9.5, font: this.arabicFont, color: BRAND.deepGreen });
    }
    this.y -= barH;
    this.hr(BRAND.border, 0.75);
    this.y -= 10;
    for (const paragraph of bodyEn) this.paragraph(paragraph, { size: 9, gap: 5 });
    if (bodyAr.length) this.y -= 4;
    for (const paragraph of bodyAr) this.paragraphAr(paragraph, { size: 8.5, gap: 5 });
    this.y -= 10;
  }

  bilingualSignatureBlock(customerName: string, signatoryName: string, signatoryTitle: string): void {
    this.ensure(120);
    this.y -= 8;
    const leftX = MARGIN_X;
    const rightX = PAGE_WIDTH / 2 + 8;
    const blockW = PAGE_WIDTH / 2 - MARGIN_X - 12;

    this.page.drawText('First Party', { x: leftX, y: this.y, size: 10, font: this.bold, color: BRAND.ink });
    this.page.drawText('Second Party', { x: rightX, y: this.y, size: 10, font: this.bold, color: BRAND.ink });
    if (this.arabicFont) {
      this.page.drawText(this.ar('الطرف الأول'), { x: leftX + 72, y: this.y, size: 9, font: this.arabicFont, color: BRAND.slate });
      this.page.drawText(this.ar('الطرف الثاني'), { x: rightX + 78, y: this.y, size: 9, font: this.arabicFont, color: BRAND.slate });
    }
    this.y -= 14;
    this.page.drawText('BloX', { x: leftX, y: this.y, size: 9, font: this.bold, color: BRAND.ink });
    this.page.drawText(customerName, { x: rightX, y: this.y, size: 9, font: this.bold, color: BRAND.ink });
    this.y -= 24;

    this.page.drawLine({ start: { x: leftX, y: this.y }, end: { x: leftX + blockW, y: this.y }, thickness: 0.75, color: BRAND.slate });
    this.page.drawLine({ start: { x: rightX, y: this.y }, end: { x: rightX + blockW, y: this.y }, thickness: 0.75, color: BRAND.slate });
    this.y -= 12;
    this.page.drawText(`Name: ${signatoryName}`, { x: leftX, y: this.y, size: 8, font: this.font, color: BRAND.slate });
    this.page.drawText(`Name: ${customerName}`, { x: rightX, y: this.y, size: 8, font: this.font, color: BRAND.slate });
    this.y -= 12;
    this.page.drawText(`Title: ${signatoryTitle}`, { x: leftX, y: this.y, size: 8, font: this.font, color: BRAND.slate });
    this.page.drawText(`QID: ______________________`, { x: rightX, y: this.y, size: 8, font: this.font, color: BRAND.slate });
    this.y -= 12;
    this.page.drawText('Signature: ______________________', { x: leftX, y: this.y, size: 8, font: this.font, color: BRAND.slate });
    this.page.drawText('Signature: ______________________', { x: rightX, y: this.y, size: 8, font: this.font, color: BRAND.slate });
    this.y -= 12;
    this.page.drawText('Date: ____________________________', { x: leftX, y: this.y, size: 8, font: this.font, color: BRAND.slate });
    this.page.drawText('Date: ____________________________', { x: rightX, y: this.y, size: 8, font: this.font, color: BRAND.slate });
    this.y -= 10;
  }

  /** Compact two-column fact sheet — cleaner than boxed meta grid for schedules. */
  factSheet(rows: Array<[string, string]>): void {
    const visible = rows.filter(([, value]) => value?.trim());
    if (!visible.length) return;
    const labelW = 148;
    const valueW = CONTENT_WIDTH / 2 - labelW - 8;
    const rowH = 17;
    this.ensure(Math.ceil(visible.length / 2) * rowH + 12);

    this.page.drawRectangle({
      x: MARGIN_X,
      y: this.y - Math.ceil(visible.length / 2) * rowH - 6,
      width: CONTENT_WIDTH,
      height: Math.ceil(visible.length / 2) * rowH + 6,
      borderColor: BRAND.border,
      borderWidth: 0.75,
      color: BRAND.canvas,
    });

    for (let i = 0; i < visible.length; i += 2) {
      for (let col = 0; col < 2; col += 1) {
        const entry = visible[i + col];
        if (!entry) continue;
        const x = MARGIN_X + col * (CONTENT_WIDTH / 2);
        const baseY = this.y - 11;
        this.page.drawText(entry[0], { x: x + 8, y: baseY, size: 7, font: this.font, color: BRAND.slate });
        const valueLines = wrapText(entry[1], valueW, this.bold, 8).slice(0, 1);
        this.page.drawText(valueLines[0] ?? entry[1], {
          x: x + labelW,
          y: baseY,
          size: 8,
          font: this.bold,
          color: BRAND.ink,
        });
      }
      this.y -= rowH;
    }
    this.y -= 8;
  }

  metaGrid(rows: Array<[string, string]>): void {
    this.factSheet(rows);
  }

  private fitCellText(value: string, maxWidth: number, size: number): string {
    const trimmed = value.trim();
    if (!trimmed) return '';
    if (this.font.widthOfTextAtSize(trimmed, size) <= maxWidth) return trimmed;
    let out = trimmed;
    while (out.length > 1 && this.font.widthOfTextAtSize(`${out}…`, size) > maxWidth) {
      out = out.slice(0, -1);
    }
    return `${out}…`;
  }

  table(
    columns: Array<{ label: string; width?: number; align?: 'left' | 'right' }>,
    rows: string[][],
    opts?: { repeatHeader?: boolean; rowHeight?: number; fontSize?: number },
  ): void {
    const headerH = 22;
    const rowH = opts?.rowHeight ?? 19;
    const fontSize = opts?.fontSize ?? 7;
    const pad = 5;

    const explicit = columns.every((c) => c.width != null);
    const totalExplicit = columns.reduce((sum, c) => sum + (c.width ?? 0), 0);
    const scaled = columns.map((col, index, all) => {
      if (explicit && totalExplicit > 0) {
        const width = Math.floor(((col.width ?? 0) / totalExplicit) * CONTENT_WIDTH);
        return { ...col, width: index === all.length - 1 ? CONTENT_WIDTH - all.slice(0, -1).reduce((s, c, i) => s + Math.floor(((c.width ?? 0) / totalExplicit) * CONTENT_WIDTH), 0) : width };
      }
      const width = Math.floor(CONTENT_WIDTH / all.length);
      return { ...col, width: index === all.length - 1 ? CONTENT_WIDTH - width * (all.length - 1) : width };
    });

    const drawHeader = () => {
      this.ensure(headerH + rowH + 4);
      let x = MARGIN_X;
      for (const col of scaled) {
        this.page.drawRectangle({
          x,
          y: this.y - headerH + 4,
          width: col.width,
          height: headerH,
          color: BRAND.deepGreen,
        });
        const label = this.fitCellText(col.label, col.width - pad * 2, fontSize);
        const labelX =
          col.align === 'right'
            ? x + col.width - pad - this.bold.widthOfTextAtSize(label, fontSize)
            : x + pad;
        this.page.drawText(label, {
          x: labelX,
          y: this.y - headerH + 9,
          size: fontSize,
          font: this.bold,
          color: BRAND.white,
        });
        x += col.width;
      }
      this.y -= headerH + 2;
    };

    const repeatHeader = opts?.repeatHeader !== false;
    const prevHook = this.onNewPage;
    if (repeatHeader) {
      this.onNewPage = () => drawHeader();
    }

    drawHeader();

    for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
      const row = rows[rowIndex]!;
      const isTotal = row[0]?.toLowerCase() === 'total';
      this.ensure(rowH + 4);
      let cellX = MARGIN_X;
      for (let i = 0; i < scaled.length; i += 1) {
        const col = scaled[i]!;
        const value = row[i] ?? '';
        this.page.drawRectangle({
          x: cellX,
          y: this.y - rowH + 4,
          width: col.width,
          height: rowH,
          borderColor: BRAND.border,
          borderWidth: 0.5,
          color: isTotal ? BRAND.canvas : BRAND.white,
        });
        const display = this.fitCellText(value, col.width - pad * 2, fontSize);
        const textWidth = this.font.widthOfTextAtSize(display, fontSize);
        const textX =
          col.align === 'right'
            ? cellX + col.width - pad - textWidth
            : cellX + pad;
        this.page.drawText(display, {
          x: Math.max(cellX + 2, textX),
          y: this.y - rowH + 9,
          size: fontSize,
          font: isTotal ? this.bold : this.font,
          color: BRAND.ink,
        });
        cellX += col.width;
      }
      this.y -= rowH;
    }

    this.onNewPage = prevHook;
    this.y -= 8;
  }

  /** Ijarah-style dual signature block with bilingual headings. */
  contractSignatureBlock(opts: {
    leftHeadingEn: string;
    leftHeadingAr: string;
    leftName: string;
    rightHeadingEn: string;
    rightHeadingAr: string;
    rightName: string;
  }): void {
    this.ensure(110);
    this.y -= 8;
    const leftX = MARGIN_X;
    const rightX = PAGE_WIDTH / 2 + 8;
    const blockW = PAGE_WIDTH / 2 - MARGIN_X - 12;

    this.page.drawText(opts.leftHeadingEn, { x: leftX, y: this.y, size: 10, font: this.bold, color: BRAND.ink });
    this.page.drawText(opts.rightHeadingEn, { x: rightX, y: this.y, size: 10, font: this.bold, color: BRAND.ink });
    if (this.arabicFont) {
      this.page.drawText(this.ar(opts.leftHeadingAr), { x: leftX + 88, y: this.y, size: 9, font: this.arabicFont, color: BRAND.slate });
      this.page.drawText(this.ar(opts.rightHeadingAr), { x: rightX + 72, y: this.y, size: 9, font: this.arabicFont, color: BRAND.slate });
    }
    this.y -= 24;
    this.page.drawLine({ start: { x: leftX, y: this.y }, end: { x: leftX + blockW, y: this.y }, thickness: 0.75, color: BRAND.slate });
    this.page.drawLine({ start: { x: rightX, y: this.y }, end: { x: rightX + blockW, y: this.y }, thickness: 0.75, color: BRAND.slate });
    this.y -= 14;
    this.page.drawText(`Name: ${opts.leftName}`, { x: leftX, y: this.y, size: 8, font: this.font, color: BRAND.slate });
    this.page.drawText(`Name: ${opts.rightName}`, { x: rightX, y: this.y, size: 8, font: this.font, color: BRAND.slate });
    if (this.arabicFont) {
      const name = this.ar('الاسم:');
      this.page.drawText(name, { x: leftX + 120, y: this.y, size: 8, font: this.arabicFont, color: BRAND.slate });
      this.page.drawText(name, { x: rightX + 120, y: this.y, size: 8, font: this.arabicFont, color: BRAND.slate });
    }
    this.y -= 14;
    this.page.drawText('Date: ______________', { x: leftX, y: this.y, size: 8, font: this.font, color: BRAND.slate });
    this.page.drawText('Date: ______________', { x: rightX, y: this.y, size: 8, font: this.font, color: BRAND.slate });
    if (this.arabicFont) {
      const date = this.ar('التاريخ:');
      this.page.drawText(date, { x: leftX + 88, y: this.y, size: 8, font: this.arabicFont, color: BRAND.slate });
      this.page.drawText(date, { x: rightX + 88, y: this.y, size: 8, font: this.arabicFont, color: BRAND.slate });
    }
    this.y -= 10;
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
