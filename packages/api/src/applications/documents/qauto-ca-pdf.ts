import fs from 'node:fs';
import path from 'node:path';
import { PDFDocument } from 'pdf-lib';
import { roundMoney } from '@drivemarket/shared/pricing';
import type { ContractFieldContext } from './field-maps';
import {
  asRecord,
  centredBaseline,
  embedFormFonts,
  employmentOf,
  hasCategory,
  identityDocumentsOf,
  money,
  nationalAddressOf,
  nationalityOf,
  PageWriter,
  qatarDate,
  snapshotOf,
  str,
  vehicleDescription,
  wrapWords,
  type TextBox,
} from './qauto-pdf-kit';

/**
 * Q-Auto credit application forms (individual and fleet / corporate).
 *
 * Both masters are vector PDFs (US Letter). Every position below comes from
 * the form's own drawn cells and rules, so values sit vertically centred in
 * their boxes and on the same baseline as the printed labels.
 */

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

type Column = { x0: number; x1: number };
type Row = { top: number; bottom: number; baseline?: number };

/** Horizontal padding between a value and the cell rule beside it, in points. */
const CELL_PAD = 4;

/**
 * Value inside a ruled cell, padded from the walls. It sits on the row's printed
 * label baseline when the row has one, otherwise it is optically centred.
 */
function inCell(col: Column, row: Row, opts: Partial<TextBox> = {}): TextBox {
  const size = opts.size ?? 8;
  return {
    x0: col.x0 + CELL_PAD,
    x1: col.x1 - CELL_PAD,
    baseline: row.baseline ?? centredBaseline(row.top, row.bottom, size),
    size,
    ...opts,
  };
}

/** Value written on an underline with no label beside it (comment lines). */
function onLine(x0: number, x1: number, rule: number, opts: Partial<TextBox> = {}): TextBox {
  return { x0, x1, baseline: rule - 2.2, size: 8, ...opts };
}

/** Value on the same baseline as the printed label it answers. */
function atBaseline(x0: number, x1: number, baseline: number, opts: Partial<TextBox> = {}): TextBox {
  return { x0, x1, baseline, size: 8, ...opts };
}

/** Word-wrap `text` over consecutive underlines. */
function writeLines(w: PageWriter, text: string, x0: number, x1: number, rules: number[], size = 7.5) {
  const lines = wrapWords(w.fonts.regular, text, size, x1 - x0);
  const fitted = lines.slice(0, rules.length);
  if (lines.length > rules.length) fitted[rules.length - 1] = lines.slice(rules.length - 1).join(' ');
  fitted.forEach((line, index) => w.text(line, onLine(x0, x1, rules[index], { size })));
}

function financeFigures(ctx: ContractFieldContext) {
  const pricing = asRecord(ctx.pricing);
  const balloon = roundMoney(Number(pricing.balloon ?? 0) || 0);
  return {
    amountFinanced: roundMoney(Math.max(ctx.listPrice - ctx.downPayment, 0)),
    balloon,
    installments: ctx.tenor > 0 ? String(ctx.tenor) : '',
  };
}

// ── Individual (retail) form ────────────────────────────────────────────────
const RETAIL = {
  /** 4 pt after the printed colon, on the label baseline. */
  date: { x0: 57.6, x1: 200, baseline: 110.06, size: 8.5 },
  customerId: { x0: 89.3, x1: 290, baseline: 124.94, size: 8.5 },
  source: {
    walkIn: [451.3, 101.2, 480.0, 111.2],
    webLead: [451.3, 115.9, 480.0, 125.9],
    referral: [451.3, 131.4, 480.0, 141.3],
    other: [451.3, 145.7, 480.0, 155.7],
  },
  /** Inner edges of the customer value boxes (after the 1.5 pt walls). */
  left: { x0: 106.0, x1: 238.0 },
  right: { x0: 398.0, x1: 582.8 },
  /** Box rows with the baseline of the label printed beside each. */
  rows: [
    { top: 171.7, bottom: 189.0, baseline: 183.62 },
    { top: 190.5, bottom: 206.7, baseline: 201.74 },
    { top: 208.1, bottom: 230.4, baseline: 222.74 },
    { top: 231.9, bottom: 248.1, baseline: 243.17 },
    { top: 249.5, bottom: 271.2, baseline: 263.57 },
    { top: 272.7, bottom: 283.4, baseline: 281.21 },
    { top: 284.8, bottom: 295.5, baseline: 293.33 },
  ],
  /** Guarantor rows (name, mobile, PO box, email, national address) — label baselines. */
  personBaselines: [336.17, 348.29, 360.41, 372.55, 384.43],
  /** Same left edge as the customer boxes above. */
  guarantorCol: { x0: 109.0, x1: 236.5 },
  table: {
    cols: {
      vehicle: { x0: 105.6, x1: 171.6 },
      price: { x0: 172.3, x1: 238.4 },
      down: { x0: 239.1, x1: 300.2 },
      financed: { x0: 300.9, x1: 396.9 },
      installments: { x0: 397.7, x1: 481.5 },
      balloon: { x0: 482.3, x1: 582.8 },
    },
    row1: { top: 428.4, bottom: 439.8, baseline: 437.11 },
    total: { top: 452.6, bottom: 471.8, baseline: 465.55 },
    size: 7.5,
    /** Printed "-" placeholders in the grand-total row (Excel zero format). */
    totalDashes: [
      [280.5, 455.5, 288.0, 469.0],
      [377.3, 455.5, 384.8, 469.0],
    ],
  },
  commentRules: [503.5, 515.6, 527.7],
  checklist: {
    customer: { x0: 28.2, x1: 104.9 },
    guarantor: { x0: 300.9, x1: 396.9 },
    rows: [
      { top: 564.8, bottom: 576.2 },
      { top: 576.9, bottom: 588.3 },
      { top: 589.1, bottom: 600.5 },
      { top: 601.2, bottom: 612.6 },
      { top: 613.3, bottom: 624.7 },
      { top: 625.4, bottom: 636.8 },
      { top: 637.5, bottom: 649.0 },
      { top: 649.7, bottom: 662.2 },
    ],
  },
  salesman: { x0: 76.3, x1: 296, baseline: 683.88, size: 8.5 },
} as const;

function drawRetail(w: PageWriter, ctx: ContractFieldContext) {
  const snap = snapshotOf(ctx);
  const address = nationalAddressOf(snap);
  const employment = employmentOf(snap);
  const guarantor = asRecord(snap.guarantor);
  const ids = identityDocumentsOf(ctx, snap);
  const fin = financeFigures(ctx);
  const R = RETAIL;

  w.text(qatarDate(ctx.approvedAt), R.date);
  w.text(ctx.referenceNo ?? ctx.applicationId, R.customerId);
  const source = ctx.intakeSource === 'walk_in' ? 'walkIn' : 'webLead';
  for (const [key, box] of Object.entries(R.source)) {
    w.check(key === source, box[0], box[1], box[2], box[3]);
  }

  const left = [
    snap.full_name,
    nationalityOf(snap),
    snap.qid,
    snap.phone,
    ids.passportNo,
    ctx.customerEmail || str(snap.email),
    address.poBox,
  ];
  const right = [
    address.full,
    address.zone,
    address.streetNo,
    address.buildingNo,
    str(employment.company),
    str(employment.phone) || str(employment.companyPhone),
    str(employment.poBox) || str(employment.companyPoBox),
  ];
  const cell = (col: Column) => ({ x0: col.x0 + 3, x1: col.x1 - 3 });
  R.rows.forEach((row, index) => {
    w.textInCell(left[index], { ...cell(R.left), ...row, size: 8 });
    w.textInCell(right[index], { ...cell(R.right), ...row, size: 8 });
  });

  const g = R.guarantorCol;
  const [nameY, mobileY, poY, emailY, addressY] = R.personBaselines;
  w.text(guarantor.fullName, atBaseline(g.x0, g.x1, nameY));
  w.text(guarantor.phone, atBaseline(g.x0, g.x1, mobileY));
  w.text(guarantor.poBox, atBaseline(g.x0, g.x1, poY));
  w.text(guarantor.email, atBaseline(g.x0, g.x1, emailY));
  w.text(guarantor.address, atBaseline(g.x0, g.x1, addressY));

  const t = R.table;
  const v = { size: t.size };
  w.text(vehicleDescription(ctx.vehicle, false), inCell(t.cols.vehicle, t.row1, { ...v, align: 'center' }));
  w.text(money(ctx.listPrice), inCell(t.cols.price, t.row1, { ...v, align: 'right' }));
  w.text(money(ctx.downPayment), inCell(t.cols.down, t.row1, { ...v, align: 'right' }));
  w.text(money(fin.amountFinanced), inCell(t.cols.financed, t.row1, { ...v, align: 'right' }));
  w.text(fin.installments, inCell(t.cols.installments, t.row1, { ...v, align: 'center' }));
  if (fin.balloon > 0) w.text(money(fin.balloon), inCell(t.cols.balloon, t.row1, { ...v, align: 'right' }));

  for (const dash of t.totalDashes) w.mask(dash[0], dash[1], dash[2], dash[3]);
  const total = { ...v, align: 'right' as const, bold: true };
  w.text(money(ctx.listPrice), inCell(t.cols.price, t.total, total));
  w.text(money(ctx.downPayment), inCell(t.cols.down, t.total, total));
  w.text(money(fin.amountFinanced), inCell(t.cols.financed, t.total, total));
  if (fin.balloon > 0) w.text(money(fin.balloon), inCell(t.cols.balloon, t.total, total));

  if (ctx.overrideReason?.trim()) {
    writeLines(w, `Credit override: ${ctx.overrideReason.trim()}`, 31, 235, [...R.commentRules]);
  }

  const cats = ctx.uploadedCategories;
  const c = R.checklist;
  const customerDocs = [
    hasCategory(cats, 'qid', 'qid_front', 'qid_back', 'id'),
    hasCategory(cats, 'passport'),
    hasCategory(cats, 'salary', 'cr', 'computer_card', 'employment_contract'),
    hasCategory(cats, 'bank'),
    hasCategory(cats, 'credit_bureau'),
    hasCategory(cats, 'rental_agreement'),
    hasCategory(cats, 'national_address', 'residence_proof'),
    hasCategory(cats, 'bank_liability'),
  ];
  const guarantorDocs = [
    hasCategory(cats, 'guarantor_qid'),
    hasCategory(cats, 'guarantor_passport'),
    hasCategory(cats, 'guarantor_salary'),
    hasCategory(cats, 'guarantor_bank'),
    hasCategory(cats, 'guarantor_credit_bureau'),
    hasCategory(cats, 'guarantor_rental_agreement'),
    hasCategory(cats, 'guarantor_national_address'),
    hasCategory(cats, 'guarantor_bank_liability'),
  ];
  c.rows.forEach((row, index) => {
    w.check(customerDocs[index], c.customer.x0, row.top, c.customer.x1, row.bottom);
    w.check(guarantorDocs[index], c.guarantor.x0, row.top, c.guarantor.x1, row.bottom);
  });

  // The Sales Manager box is signed by the dealer's manager — not the credit approver.
  w.text(ctx.salesmanName ?? '', R.salesman);
}

// ── Fleet / corporate form ──────────────────────────────────────────────────
const FLEET = {
  /** Every value starts 3.5 pt inside its underline and sits on its label's baseline. */
  quotationNo: atBaseline(150.0, 225.0, 96.98),
  date: atBaseline(495.4, 553.0, 96.98),
  left: { x0: 150.0, x1: 344.0 },
  right: { x0: 427.6, x1: 553.0 },
  companyNameY: 124.94,
  customerY: { address: 138.38, phone: 151.82, email: 165.26, contact: 178.7, contactEmail: 192.14 },
  guarantorY: [
    { name: 223.22, address: 233.81, phone: 244.37, email: 254.93 },
    { name: 276.05, address: 286.61, phone: 297.17, email: 307.73 },
  ],
  table: {
    cols: {
      vehicle: { x0: 146.9, x1: 226.2 },
      qty: { x0: 227.0, x1: 282.4 },
      price: { x0: 283.1, x1: 345.3 },
      down: { x0: 346.0, x1: 423.7 },
      financed: { x0: 424.4, x1: 491.5 },
      installments: { x0: 492.2, x1: 554.6 },
    },
    row1: { top: 350.9, bottom: 360.2, baseline: 358.01 },
    total: { top: 372.3, bottom: 382.0, baseline: 379.51 },
    size: 7,
  },
  checkLeft: { x0: 238.8, x1: 268.9 },
  checkRight: { x0: 506.9, x1: 536.9 },
  /** Customer checklist rows (top/bottom of the rounded boxes). */
  customerBoxes: [449.7, 463.7, 477.8, 491.8, 505.9, 519.9, 533.9, 548.0],
  /** Guarantor 1: QID, bank, credit bureau, national address; guarantor 2 the same from 533.9. */
  guarantorBoxes: [
    [449.7, 463.7, 477.8, 491.8],
    [533.9, 548.0, 562.0, 576.0],
  ],
  boxHeight: 11.0,
  salesExecCommentRules: [619.8, 630.3, 640.9, 651.5, 662.0],
  salesExecName: atBaseline(150.0, 281.0, 678.72, { size: 8.5 }),
} as const;

function drawFleet(w: PageWriter, ctx: ContractFieldContext) {
  const snap = snapshotOf(ctx);
  const corporate = asRecord(snap.corporate);
  const registered = asRecord(corporate.registeredAddress);
  const signatory = asRecord(corporate.authorizedSignatory);
  const address = nationalAddressOf(snap);
  const fin = financeFigures(ctx);
  const F = FLEET;
  const L = F.left;
  const RT = F.right;

  const companyName = str(corporate.legalName) || str(corporate.tradeName) || snap.full_name;
  const companyAddress =
    [str(registered.line1) || str(registered.street), str(registered.area), str(registered.city), str(registered.zone) ? `Zone ${str(registered.zone)}` : '', 'Qatar']
      .filter(Boolean)
      .join(', ');
  const contactName = [str(signatory.firstName), str(signatory.lastName)].filter(Boolean).join(' ') || snap.full_name;

  w.text(ctx.referenceNo ?? ctx.applicationId, F.quotationNo);
  w.text(qatarDate(ctx.approvedAt), F.date);
  const Y = F.customerY;
  w.text(companyName, atBaseline(L.x0, RT.x1, F.companyNameY));
  w.text(companyAddress === 'Qatar' ? address.full : companyAddress, atBaseline(L.x0, L.x1, Y.address));
  w.text(str(registered.poBox) || str(registered.po_box) || address.poBox, atBaseline(RT.x0, RT.x1, Y.address));
  w.text(str(corporate.phone) || snap.phone, atBaseline(L.x0, L.x1, Y.phone));
  w.text(str(corporate.fax), atBaseline(RT.x0, RT.x1, Y.phone));
  w.text(str(corporate.email) || ctx.customerEmail || str(snap.email), atBaseline(L.x0, L.x1, Y.email));
  w.text(contactName, atBaseline(L.x0, L.x1, Y.contact));
  w.text(str(signatory.phone) || snap.phone, atBaseline(RT.x0, RT.x1, Y.contact));
  w.text(str(signatory.email) || ctx.customerEmail || str(snap.email), atBaseline(L.x0, L.x1, Y.contactEmail));

  const guarantors = [asRecord(snap.guarantor), asRecord(snap.guarantor2)];
  guarantors.forEach((guarantor, index) => {
    if (!str(guarantor.fullName)) return;
    const gy = F.guarantorY[index];
    w.text(guarantor.fullName, atBaseline(L.x0, L.x1, gy.name));
    w.text(guarantor.address, atBaseline(L.x0, L.x1, gy.address));
    w.text(guarantor.poBox, atBaseline(RT.x0, RT.x1, gy.address));
    w.text(guarantor.phone, atBaseline(L.x0, L.x1, gy.phone));
    w.text(guarantor.email, atBaseline(L.x0, L.x1, gy.email));
  });

  const t = F.table;
  const row = (r: Row, bold: boolean) => {
    const o = { size: t.size, bold };
    w.text(money(ctx.listPrice), inCell(t.cols.price, r, { ...o, align: 'right' }));
    w.text(money(ctx.downPayment), inCell(t.cols.down, r, { ...o, align: 'right' }));
    w.text(money(fin.amountFinanced), inCell(t.cols.financed, r, { ...o, align: 'right' }));
    w.text(fin.installments, inCell(t.cols.installments, r, { ...o, align: 'center' }));
    w.text('1', inCell(t.cols.qty, r, { ...o, align: 'center' }));
  };
  w.text(vehicleDescription(ctx.vehicle, false), inCell(t.cols.vehicle, t.row1, { size: t.size, align: 'center' }));
  row(t.row1, false);
  row(t.total, true);

  const cats = ctx.uploadedCategories;
  const customerDocs = [
    hasCategory(cats, 'qid', 'qid_front', 'qid_back', 'id', 'signatory_id'),
    hasCategory(cats, 'passport'),
    hasCategory(cats, 'cr', 'trade_license'),
    hasCategory(cats, 'computer_card'),
    hasCategory(cats, 'bank', 'business_bank'),
    hasCategory(cats, 'audited_financials'),
    hasCategory(cats, 'credit_bureau'),
    hasCategory(cats, 'national_address', 'residence_proof'),
  ];
  F.customerBoxes.forEach((top, index) => {
    w.check(customerDocs[index], F.checkLeft.x0, top, F.checkLeft.x1, top + F.boxHeight);
  });
  const guarantorDocs = [
    [
      hasCategory(cats, 'guarantor_qid'),
      hasCategory(cats, 'guarantor_bank'),
      hasCategory(cats, 'guarantor_credit_bureau'),
      hasCategory(cats, 'guarantor_national_address'),
    ],
    [
      hasCategory(cats, 'guarantor2_qid'),
      hasCategory(cats, 'guarantor2_bank'),
      hasCategory(cats, 'guarantor2_credit_bureau'),
      hasCategory(cats, 'guarantor2_national_address'),
    ],
  ];
  F.guarantorBoxes.forEach((tops, g) => {
    tops.forEach((top, index) => {
      w.check(guarantorDocs[g][index], F.checkRight.x0, top, F.checkRight.x1, top + F.boxHeight);
    });
  });

  if (ctx.overrideReason?.trim()) {
    writeLines(w, `Credit override: ${ctx.overrideReason.trim()}`, L.x0, 281.0, [...F.salesExecCommentRules]);
  }
  w.text(ctx.salesmanName ?? '', F.salesExecName);
}

async function fillForm(fileName: string, draw: (w: PageWriter) => void): Promise<Buffer> {
  const doc = await PDFDocument.load(fs.readFileSync(resolveQautoFormPath(fileName)));
  const fonts = await embedFormFonts(doc);
  draw(new PageWriter(doc.getPages()[0], fonts));
  return Buffer.from(await doc.save());
}

export async function buildQautoRetailCreditApplicationPdf(ctx: ContractFieldContext): Promise<Buffer> {
  return fillForm('QAuto_Retail_Credit_Application.pdf', (w) => drawRetail(w, ctx));
}

export async function buildQautoFleetCreditApplicationPdf(ctx: ContractFieldContext): Promise<Buffer> {
  return fillForm('QAuto_Fleet_Credit_Application.pdf', (w) => drawFleet(w, ctx));
}
