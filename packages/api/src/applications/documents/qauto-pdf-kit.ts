import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import { roundMoney } from '@drivemarket/shared/pricing';
import { parseQid } from '@drivemarket/shared/domain-rules';
import { readCustomerSnapshot, type CustomerSnapshot } from '../customer-snapshot';
import type { ContractFieldContext } from './field-maps';

/**
 * Shared toolkit for the Q-Auto form overlays (credit applications and the
 * Vehicles Finance Agreement): text fitting, alignment, Qatar date formatting
 * and the customer facts the forms ask for.
 */

const INK = rgb(0.07, 0.07, 0.09);

export type Align = 'left' | 'center' | 'right';

export type TextBox = {
  /** Left and right edge of the box the value must stay inside, in points from the left. */
  x0: number;
  x1: number;
  /** Baseline, in points from the top of the page. */
  baseline: number;
  align?: Align;
  size?: number;
  bold?: boolean;
  /** Smallest size the value may shrink to before it is truncated. Defaults to 72% of `size`. */
  minSize?: number;
  /**
   * Wider box used when the value does not fit `x0`–`x1` at full size (e.g. a long
   * legal name spilling into the unused Arabic half of the line). Never truncate a name.
   */
  overflow?: { x0: number; x1: number };
};

export type FormFonts = { regular: PDFFont; bold: PDFFont; italic: PDFFont };

export async function embedFormFonts(doc: PDFDocument): Promise<FormFonts> {
  return {
    regular: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
    italic: await doc.embedFont(StandardFonts.HelveticaOblique),
  };
}

/** Drop characters the WinAnsi standard fonts cannot encode (they would throw at draw time). */
export function encodable(font: PDFFont, text: string): string {
  const supported = new Set(font.getCharacterSet());
  let out = '';
  for (const ch of text.normalize('NFC')) {
    const code = ch.codePointAt(0) ?? 0;
    if (supported.has(code)) out += ch;
    else if (/\s/.test(ch)) out += ' ';
  }
  return out.replace(/\s+/g, ' ').trim();
}

/** Writes values onto one page using top-left coordinates in points. */
export class PageWriter {
  constructor(
    readonly page: PDFPage,
    readonly fonts: FormFonts,
  ) {}

  private get height(): number {
    return this.page.getHeight();
  }

  text(value: unknown, box: TextBox): void {
    const font = box.bold ? this.fonts.bold : this.fonts.regular;
    this.draw(font, value, box);
  }

  italic(value: unknown, box: TextBox): void {
    this.draw(this.fonts.italic, value, box);
  }

  private draw(font: PDFFont, value: unknown, box: TextBox): void {
    const raw = value == null ? '' : String(value);
    const text = encodable(font, raw);
    if (!text) return;
    const size = box.size ?? 8;
    if (box.overflow && font.widthOfTextAtSize(text, size) > box.x1 - box.x0) {
      box = { ...box, x0: box.overflow.x0, x1: box.overflow.x1, overflow: undefined };
    }
    const maxWidth = Math.max(box.x1 - box.x0, 1);
    const minSize = box.minSize ?? size * 0.72;
    let fitted = size;
    while (fitted > minSize && font.widthOfTextAtSize(text, fitted) > maxWidth) fitted -= 0.25;
    let rendered = text;
    if (font.widthOfTextAtSize(rendered, fitted) > maxWidth) {
      while (rendered.length > 1 && font.widthOfTextAtSize(`${rendered}…`, fitted) > maxWidth) {
        rendered = rendered.slice(0, -1).trimEnd();
      }
      rendered = `${rendered}…`;
    }
    const width = font.widthOfTextAtSize(rendered, fitted);
    const align = box.align ?? 'left';
    const x =
      align === 'center' ? box.x0 + (maxWidth - width) / 2 : align === 'right' ? box.x1 - width : box.x0;
    this.page.drawText(rendered, { x, y: this.height - box.baseline, size: fitted, font, color: INK });
  }

  /**
   * Value inside a ruled cell that may wrap onto a second line rather than be
   * truncated (names and addresses in narrow boxes). Lines are centred vertically.
   */
  textInCell(
    value: unknown,
    box: Omit<TextBox, 'baseline'> & {
      top: number;
      bottom: number;
      /** Single-line baseline (e.g. the printed label's); defaults to the cell's optical centre. */
      baseline?: number;
    },
  ): void {
    const font = box.bold ? this.fonts.bold : this.fonts.regular;
    const text = encodable(font, value == null ? '' : String(value));
    if (!text) return;
    const size = box.size ?? 8;
    const width = box.x1 - box.x0;
    const single = (s: number) => font.widthOfTextAtSize(text, s) <= width;
    const oneLineMin = box.minSize ?? size * 0.85;
    for (let s = size; s >= oneLineMin; s -= 0.25) {
      if (single(s)) {
        const baseline = box.baseline ?? centredBaseline(box.top, box.bottom, s);
        this.draw(font, text, { ...box, size: s, minSize: s, baseline });
        return;
      }
    }
    const height = box.bottom - box.top;
    for (let s = Math.min(size, (height - 2) / 2.3); s >= 5; s -= 0.25) {
      const lines = wrapWords(font, text, s, width);
      if (lines.length <= 2 && lines.every((line) => font.widthOfTextAtSize(line, s) <= width)) {
        const leading = s * 1.15;
        const first = centredBaseline(box.top, box.bottom, s) - (leading * (lines.length - 1)) / 2;
        lines.forEach((line, index) =>
          this.draw(font, line, { ...box, size: s, minSize: s, baseline: first + index * leading }),
        );
        return;
      }
    }
    this.draw(font, text, { ...box, baseline: box.baseline ?? centredBaseline(box.top, box.bottom, size) });
  }

  /** A centred mark inside a checkbox given by its top-left corner and size. */
  check(on: boolean, x0: number, top: number, x1: number, bottom: number, size = 8): void {
    if (!on) return;
    const font = this.fonts.bold;
    const width = font.widthOfTextAtSize('X', size);
    const capHeight = size * 0.718;
    this.page.drawText('X', {
      x: (x0 + x1) / 2 - width / 2,
      y: this.height - ((top + bottom) / 2 + capHeight / 2),
      size,
      font,
      color: INK,
    });
  }

  /** Paint over printed placeholder marks (e.g. Excel "-" zero cells) before writing a value. */
  mask(x0: number, top: number, x1: number, bottom: number): void {
    this.page.drawRectangle({
      x: x0,
      y: this.height - bottom,
      width: x1 - x0,
      height: bottom - top,
      color: rgb(1, 1, 1),
      borderWidth: 0,
    });
  }
}

export function wrapWords(font: PDFFont, text: string, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  let current = '';
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = current ? `${current} ${word}` : word;
    if (!current || font.widthOfTextAtSize(next, size) <= maxWidth) current = next;
    else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/** Baseline that vertically centres capital letters / digits of `size` inside a row. */
export function centredBaseline(top: number, bottom: number, size: number): number {
  return (top + bottom) / 2 + (size * 0.718) / 2;
}

export function str(value: unknown): string {
  if (value == null) return '';
  return String(value).trim();
}

export function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

export function money(amount: number): string {
  if (!Number.isFinite(amount)) return '';
  return roundMoney(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Contracts are executed in Doha — format instants in Qatar time, not the server's zone. */
export function qatarDateParts(date: Date): { d: string; m: string; y: string } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Qatar',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  return { d: get('day'), m: get('month'), y: get('year') };
}

export function qatarDate(date: Date): string {
  const { d, m, y } = qatarDateParts(date);
  return `${d}/${m}/${y}`;
}

/** `YYYY-MM-DD` (schedule rows, KYC fields) → `DD/MM/YYYY`; other formats pass through. */
export function isoToDisplay(value: unknown): string {
  const text = str(value);
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : text;
}

export function formatQautoContractNo(series?: string | null, number?: string | null): string {
  return `${series?.trim() ?? ''}${number?.trim() ?? ''}`;
}

/** Qatar mobiles are written as the 8 local digits on Q-Auto paperwork. */
export function phoneLocal(phone: unknown): string {
  const raw = str(phone).replace(/[\s()-]/g, '');
  if (raw.startsWith('+974')) return raw.slice(4);
  if (raw.startsWith('00974')) return raw.slice(5);
  if (raw.startsWith('974') && raw.length === 11) return raw.slice(3);
  return raw;
}

export function vehicleDescription(vehicle: ContractFieldContext['vehicle'], withTrim = true): string {
  return [vehicle.make, vehicle.model, withTrim ? vehicle.trim : null, vehicle.year]
    .map((part) => str(part))
    .filter(Boolean)
    .join(' ');
}

export function snapshotOf(ctx: ContractFieldContext): CustomerSnapshot {
  return readCustomerSnapshot(ctx.customerSnapshot);
}

export function employmentOf(snapshot: CustomerSnapshot): Record<string, unknown> {
  const employment = asRecord(snapshot.employment);
  const legacy = asRecord(snapshot.employmentDetails);
  return { ...legacy, ...employment };
}

const EMPLOYMENT_DURATION_LABELS: Record<string, string> = {
  'less-than-6-months': 'Less than 6 months',
  'between-6-12-months': '6 to 12 months',
  'more-than-12-months': 'More than 12 months',
};

/** Human wording for the stored duration code; a start date wins when one was captured. */
export function employmentTenure(employment: Record<string, unknown>): string {
  const start = str(employment.startDate) || str(employment.joiningDate);
  if (start) return isoToDisplay(start);
  const duration = str(employment.employmentDuration);
  return EMPLOYMENT_DURATION_LABELS[duration] ?? duration;
}

export function nationalityOf(snapshot: { nationality?: unknown; qid?: unknown }): string {
  const typed = str(snapshot.nationality);
  if (typed) return typed;
  return parseQid(str(snapshot.qid)).nationality?.en ?? '';
}

export type NationalAddress = {
  buildingNo: string;
  streetNo: string;
  zone: string;
  poBox: string;
  /** Street / area wording for "Street Name" lines. */
  streetName: string;
  /** One-line address for "National Address" boxes. */
  full: string;
};

function firstNumber(text: string, labels: RegExp): string {
  const match = labels.exec(text);
  return match?.[1] ?? '';
}

/**
 * Qatar national address (building / street / zone numbers) from the snapshot.
 * New snapshots keep a free-text `line1` ("Street / building"), so numbers are
 * read from explicit keys first and then from labelled parts of that line.
 */
export function nationalAddressOf(snapshot: CustomerSnapshot): NationalAddress {
  const address = asRecord(snapshot.address);
  const line1 = str(address.line1);
  const legacyStreet = str(address.street);
  const area = str(address.area);
  const city = str(address.city) || str(snapshot.city);
  const zone = str(address.zone) || firstNumber(line1, /\bzone\s*(?:no\.?|number)?\s*[:#-]?\s*(\d+)/i);
  const buildingNo =
    str(address.building) ||
    str(address.buildingNo) ||
    str(address.buildingNumber) ||
    firstNumber(`${line1} ${legacyStreet}`, /\b(?:bldg|bldng|building|bld)\.?\s*(?:no\.?|number)?\s*[:#-]?\s*(\d+)/i);
  const streetNo =
    str(address.streetNo) ||
    str(address.streetNumber) ||
    (/^\d+$/.test(legacyStreet) ? legacyStreet : '') ||
    firstNumber(`${line1} ${legacyStreet}`, /\b(?:street|st)\.?\s*(?:no\.?|number)?\s*[:#-]?\s*(\d+)/i);
  const poBox = str(address.poBox) || str(address.po_box) || str(address.postalCode);
  const streetText = line1 || (/^\d+$/.test(legacyStreet) ? '' : legacyStreet);
  const mentions = (part: string) => !!part && streetText.toLowerCase().includes(part.toLowerCase());
  const areaPart = mentions(area) ? '' : area;
  const cityPart = mentions(city) ? '' : city;
  const zonePart = zone && !/\bzone\b/i.test(streetText) ? `Zone ${zone}` : '';
  const streetName = [streetText, areaPart].filter(Boolean).join(', ');
  const full = [streetText, areaPart, cityPart, zonePart, 'Qatar'].filter(Boolean).join(', ');
  return { buildingNo, streetNo, zone, poBox, streetName, full };
}

type IdentityField = { name: string; label: string; value: string; document_type: string };

function kycField(ctx: ContractFieldContext, documentType: RegExp, field: RegExp): string {
  const fields = (ctx.kyc?.extracted_identity ?? []) as IdentityField[];
  const hit = fields.find(
    (item) =>
      documentType.test(str(item.document_type)) &&
      (field.test(str(item.name)) || field.test(str(item.label))) &&
      str(item.value),
  );
  return str(hit?.value);
}

const PASSPORT_DOC = /passport/i;
const QID_DOC = /qid|qatar|national|identity|id[_\s-]?card|residen/i;
const EXPIRY = /expir|valid|date[_\s-]?of[_\s-]?exp/i;
const DOC_NUMBER = /document[_\s-]?(no|num)|passport[_\s-]?(no|num)|^number$/i;

/** QID expiry and passport details: typed on the snapshot, else read from the eKYC extraction. */
export function identityDocumentsOf(ctx: ContractFieldContext, snapshot: CustomerSnapshot) {
  const s = snapshot as Record<string, unknown>;
  const passportNo =
    str(s.passportNumber) || str(s.passportNo) || str(s.passport) || kycField(ctx, PASSPORT_DOC, DOC_NUMBER);
  const passportExpiry =
    str(s.passportExpiry) || str(s.passport_expiry) || kycField(ctx, PASSPORT_DOC, EXPIRY);
  const qidExpiry =
    str(s.qidExpiry) || str(s.qid_expiry) || str(s.qidValidity) || kycField(ctx, QID_DOC, EXPIRY);
  return {
    passportNo,
    passportExpiry: isoToDisplay(passportExpiry),
    qidExpiry: isoToDisplay(qidExpiry),
  };
}

export function hasCategory(categories: string[] | undefined, ...needles: string[]): boolean {
  const set = new Set((categories ?? []).map((item) => item.toLowerCase()));
  return needles.some((needle) => set.has(needle));
}
