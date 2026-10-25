import fs from 'node:fs';
import path from 'node:path';
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import { roundMoney } from '@drivemarket/shared/pricing';
import { readCustomerSnapshot } from '../customer-snapshot';
import type { ContractFieldContext } from './field-maps';

/** US Letter page used by both QAuto forms. pdf-lib y=0 is the bottom. */
const PAGE_H = 792;

type Overlay = { x: number; y: number; text: string; size?: number; maxWidth?: number };

function money(amount: number): string {
  if (!Number.isFinite(amount)) return '';
  return roundMoney(amount).toLocaleString('en-QA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function str(value: unknown): string {
  if (value == null) return '';
  return String(value).trim();
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function addressParts(snapshot: ReturnType<typeof readCustomerSnapshot>) {
  const address = asRecord(snapshot.address);
  const line1 = str(address.line1) || str(address.street);
  const zone = str(address.zone);
  const street = str(address.street) || str(address.line1);
  const building = str(address.building) || str(address.area);
  const poBox = str(address.poBox) || str(address.po_box) || str(address.postalCode);
  const full = [line1, str(address.area), str(address.city) || str(snapshot.city), zone ? `Zone ${zone}` : '', 'Qatar']
    .filter(Boolean)
    .join(', ');
  return { full, zone, street, building, poBox };
}

function employmentOf(snapshot: ReturnType<typeof readCustomerSnapshot>) {
  const employment = snapshot.employment;
  return employment && typeof employment === 'object' && !Array.isArray(employment)
    ? (employment as Record<string, unknown>)
    : {};
}

export function resolveQautoFormPath(fileName: string): string {
  const candidates = [
    path.join(process.cwd(), 'assets', 'qauto-forms', fileName),
    path.join(process.cwd(), 'packages', 'api', 'assets', 'qauto-forms', fileName),
    path.join(__dirname, '..', '..', '..', 'assets', 'qauto-forms', fileName),
  ];
  const found = candidates.find((candidate) => fs.existsSync(candidate));
  if (!found) throw new Error(`qauto_form_template_missing:${fileName}`);
  return found;
}

/** Convert a row's bottom edge (from the top of the page) to a pdf-lib baseline. */
function baseline(rowBottomFromTop: number, lift = 2.4): number {
  return PAGE_H - rowBottomFromTop + lift;
}

function fit(font: PDFFont, text: string, size: number, maxWidth: number): string {
  const value = text.trim();
  if (!value) return '';
  if (font.widthOfTextAtSize(value, size) <= maxWidth) return value;
  let out = value;
  while (out.length > 1 && font.widthOfTextAtSize(`${out}…`, size) > maxWidth) {
    out = out.slice(0, -1);
  }
  return `${out}…`;
}

function drawOverlays(page: PDFPage, font: PDFFont, overlays: Overlay[]) {
  for (const overlay of overlays) {
    const text = overlay.text.trim();
    if (!text) continue;
    const size = overlay.size ?? 7.5;
    const rendered = overlay.maxWidth ? fit(font, text, size, overlay.maxWidth) : text;
    page.drawText(rendered, { x: overlay.x, y: overlay.y, size, font, color: rgb(0.08, 0.08, 0.08) });
  }
}

function mark(page: PDFPage, font: PDFFont, x: number, y: number, on: boolean) {
  if (!on) return;
  page.drawText('X', { x, y, size: 8, font, color: rgb(0.08, 0.08, 0.08) });
}

function hasDoc(categories: string[] | undefined, ...needles: string[]): boolean {
  const set = new Set((categories ?? []).map((item) => item.toLowerCase()));
  return needles.some((needle) => set.has(needle));
}

function cell(x: number, rowBottomFromTop: number, text: string, maxWidth: number, size = 7.5): Overlay {
  return { x, y: baseline(rowBottomFromTop), text, maxWidth, size };
}

function retailOverlays(ctx: ContractFieldContext): Overlay[] {
  const snap = readCustomerSnapshot(ctx.customerSnapshot);
  const address = addressParts(snap);
  const employment = employmentOf(snap);
  const guarantor = asRecord(snap.guarantor);
  const amountFinanced = roundMoney(Math.max(ctx.listPrice - ctx.downPayment, 0));
  const vehicle = `${ctx.vehicle.make} ${ctx.vehicle.model}${ctx.vehicle.year ? ` ${ctx.vehicle.year}` : ''}`.trim();
  const date = ctx.approvedAt.toISOString().slice(0, 10).split('-').reverse().join('/');
  const balloon = Number((ctx.pricing as Record<string, unknown>).balloon ?? 0);

  const L = 108;
  const Lw = 126;
  const R = 401;
  const Rw = 176;

  return [
    cell(58, 111.5, date, 90, 8),
    cell(90, 126.2, ctx.referenceNo ?? ctx.applicationId, 200, 8),
    cell(L, 189.0, snap.full_name, Lw),
    cell(R, 189.0, address.full, Rw),
    cell(L, 206.7, str(snap.nationality), Lw),
    cell(R, 206.7, address.zone, Rw),
    cell(L, 230.4, snap.qid, Lw),
    cell(R, 230.4, address.street, Rw),
    cell(L, 248.1, snap.phone, Lw),
    cell(R, 248.1, address.building, Rw),
    cell(L, 271.2, str(snap.passport) || str((snap as Record<string, unknown>).passportNo), Lw),
    cell(R, 271.2, str(employment.company), Rw),
    cell(L, 283.4, ctx.customerEmail || str(snap.email), Lw),
    cell(R, 283.4, str(employment.phone) || str(employment.companyPhone), Rw),
    cell(L, 295.5, address.poBox, Lw),
    cell(R, 295.5, str(employment.poBox), Rw),
    cell(L, 338.8, str(guarantor.fullName), Lw),
    cell(L, 350.9, str(guarantor.phone), Lw),
    cell(L, 363.0, str(guarantor.poBox), Lw),
    cell(L, 375.2, str(guarantor.email), Lw),
    cell(L, 385.5, str(guarantor.address), Lw),
    cell(107, 427.4, vehicle, 60, 6.5),
    cell(174, 427.4, money(ctx.listPrice), 60, 6.5),
    cell(242, 427.4, money(ctx.downPayment), 54, 6.5),
    cell(305, 427.4, money(amountFinanced), 86, 6.5),
    cell(402, 427.4, ctx.tenor ? String(ctx.tenor) : '', 72, 6.5),
    cell(486, 427.4, balloon ? money(balloon) : '—', 88, 6.5),
    cell(174, 470.8, money(ctx.listPrice), 60, 6.5),
    cell(242, 470.8, money(ctx.downPayment), 54, 6.5),
    cell(305, 470.8, money(amountFinanced), 86, 6.5),
    cell(82, 489.5, ctx.overrideReason ? `Override: ${ctx.overrideReason}` : '', 200),
    cell(80, 684.8, ctx.salesmanName ?? '', 210, 8),
    cell(372, 684.8, ctx.approverName ?? '', 200, 8),
  ];
}

function fleetOverlays(ctx: ContractFieldContext): Overlay[] {
  const snap = readCustomerSnapshot(ctx.customerSnapshot);
  const corporate = asRecord(snap.corporate);
  const registered = asRecord(corporate.registeredAddress);
  const signatory = asRecord(corporate.authorizedSignatory);
  const guarantor = asRecord(snap.guarantor);
  const address = addressParts(snap);
  const companyName = str(corporate.legalName) || str(corporate.tradeName) || snap.full_name;
  const companyAddress =
    [str(registered.line1), str(registered.area), str(registered.city), str(registered.zone), 'Qatar']
      .filter(Boolean)
      .join(', ') || address.full;
  const amountFinanced = roundMoney(Math.max(ctx.listPrice - ctx.downPayment, 0));
  const vehicle = `${ctx.vehicle.make} ${ctx.vehicle.model}${ctx.vehicle.year ? ` ${ctx.vehicle.year}` : ''}`.trim();
  const date = ctx.approvedAt.toISOString().slice(0, 10).split('-').reverse().join('/');
  const contactName = [str(signatory.firstName), str(signatory.lastName)].filter(Boolean).join(' ') || snap.full_name;

  const L = 148;
  const Lw = 192;
  const R = 426;
  const Rw = 124;

  return [
    cell(148, 99.0, ctx.referenceNo ?? ctx.applicationId, 74, 8),
    cell(494, 99.0, date, 56, 8),
    cell(L, 126.9, companyName, 400),
    cell(L, 140.3, companyAddress, Lw),
    cell(R, 140.3, str(registered.poBox) || address.poBox, Rw),
    cell(L, 153.7, snap.phone, Lw),
    cell(L, 167.2, ctx.customerEmail || str(snap.email), Lw),
    cell(L, 180.6, contactName, Lw),
    cell(R, 180.6, str(signatory.phone) || snap.phone, Rw),
    cell(L, 194.1, str(signatory.email) || ctx.customerEmail || str(snap.email), Lw),
    cell(L, 225.1, str(guarantor.fullName), Lw),
    cell(L, 235.7, str(guarantor.address), Lw),
    cell(R, 235.7, str(guarantor.poBox), Rw),
    cell(L, 246.3, str(guarantor.phone), Lw),
    cell(L, 256.9, str(guarantor.email), Lw),
    cell(148, 360.0, vehicle, 74, 6.5),
    cell(230, 360.0, '1', 48, 6.5),
    cell(286, 360.0, money(ctx.listPrice), 56, 6.5),
    cell(349, 360.0, money(ctx.downPayment), 70, 6.5),
    cell(428, 360.0, money(amountFinanced), 60, 6.5),
    cell(496, 360.0, ctx.tenor ? String(ctx.tenor) : '', 54, 6.5),
    cell(286, 381.5, money(ctx.listPrice), 56, 6.5),
    cell(349, 381.5, money(ctx.downPayment), 70, 6.5),
    cell(428, 381.5, money(amountFinanced), 60, 6.5),
    cell(496, 381.5, ctx.tenor ? String(ctx.tenor) : '', 54, 6.5),
    cell(148, 633.5, ctx.overrideReason ? `Override: ${ctx.overrideReason}` : '', 130),
    cell(148, 680.5, ctx.salesmanName ?? '', 130, 8),
    cell(426, 680.5, ctx.approverName ?? '', 124, 8),
  ];
}

async function fillTemplate(
  fileName: string,
  overlays: Overlay[],
  marks: Array<{ x: number; y: number; on: boolean }>,
): Promise<Buffer> {
  const bytes = fs.readFileSync(resolveQautoFormPath(fileName));
  const doc = await PDFDocument.load(bytes);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const page = doc.getPages()[0];
  drawOverlays(page, font, overlays);
  for (const item of marks) mark(page, font, item.x, item.y, item.on);
  return Buffer.from(await doc.save());
}

export async function buildQautoRetailCreditApplicationPdf(ctx: ContractFieldContext): Promise<Buffer> {
  const source = ctx.intakeSource === 'walk_in' ? 'walk_in' : 'web_lead';
  const cats = ctx.uploadedCategories;
  return fillTemplate('QAuto_Retail_Credit_Application.pdf', retailOverlays(ctx), [
    { x: 458, y: baseline(110.5, 1), on: source === 'walk_in' },
    { x: 458, y: baseline(125.2, 1), on: source === 'web_lead' },
    { x: 58, y: baseline(575.5, 1), on: hasDoc(cats, 'qid', 'id') },
    { x: 58, y: baseline(587.6, 1), on: hasDoc(cats, 'passport') },
    { x: 58, y: baseline(599.7, 1), on: hasDoc(cats, 'salary', 'employment_contract', 'cr', 'computer_card') },
    { x: 58, y: baseline(611.8, 1), on: hasDoc(cats, 'bank') },
    { x: 58, y: baseline(623.9, 1), on: hasDoc(cats, 'credit_bureau', 'bank_liability') },
    { x: 58, y: baseline(636.0, 1), on: hasDoc(cats, 'rental_agreement') },
    { x: 58, y: baseline(648.2, 1), on: hasDoc(cats, 'residence_proof', 'national_address') },
    { x: 340, y: baseline(575.5, 1), on: hasDoc(cats, 'guarantor_qid') },
    { x: 340, y: baseline(611.8, 1), on: hasDoc(cats, 'guarantor_bank') },
    { x: 340, y: baseline(623.9, 1), on: hasDoc(cats, 'credit_bureau') },
  ]);
}

export async function buildQautoFleetCreditApplicationPdf(ctx: ContractFieldContext): Promise<Buffer> {
  const cats = ctx.uploadedCategories;
  return fillTemplate('QAuto_Fleet_Credit_Application.pdf', fleetOverlays(ctx), [
    { x: 248, y: baseline(459.8, 1), on: hasDoc(cats, 'qid', 'id', 'signatory_id') },
    { x: 248, y: baseline(473.8, 1), on: hasDoc(cats, 'passport') },
    { x: 248, y: baseline(487.9, 1), on: hasDoc(cats, 'cr', 'trade_license') },
    { x: 248, y: baseline(501.9, 1), on: hasDoc(cats, 'computer_card') },
    { x: 248, y: baseline(516.0, 1), on: hasDoc(cats, 'bank', 'business_bank') },
    { x: 248, y: baseline(530.0, 1), on: hasDoc(cats, 'audited_financials') },
    { x: 248, y: baseline(544.0, 1), on: hasDoc(cats, 'credit_bureau') },
    { x: 248, y: baseline(558.1, 1), on: hasDoc(cats, 'residence_proof') },
    { x: 516, y: baseline(459.8, 1), on: hasDoc(cats, 'guarantor_qid') },
    { x: 516, y: baseline(473.8, 1), on: hasDoc(cats, 'guarantor_bank') },
    { x: 516, y: baseline(487.9, 1), on: hasDoc(cats, 'credit_bureau') },
  ]);
}
