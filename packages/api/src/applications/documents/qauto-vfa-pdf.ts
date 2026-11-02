import fs from 'node:fs';
import { PDFDocument, type PDFPage } from 'pdf-lib';
import { roundMoney } from '@drivemarket/shared/pricing';
import type { ContractScheduleRow } from '../contract-pdf';
import type { ContractFieldContext } from './field-maps';
import { resolveQautoFormPath } from './qauto-ca-pdf';
import {
  asRecord,
  embedFormFonts,
  employmentOf,
  employmentTenure,
  formatQautoContractNo,
  identityDocumentsOf,
  isoToDisplay,
  money,
  nationalAddressOf,
  nationalityOf,
  PageWriter,
  phoneLocal,
  qatarDate,
  qatarDateParts,
  snapshotOf,
  str,
  vehicleDescription,
  type Align,
  type FormFonts,
} from './qauto-pdf-kit';

/**
 * Q-Auto Vehicles Finance Agreement.
 *
 * The master (assets/qauto-forms/QAuto_Vehicles_Finance_Agreement.pdf) is a
 * blank 200-dpi scan: page 1 customer, employer, vehicle and finance details;
 * page 2 guarantors and signatures; pages 3–8 terms; page 9 the post-dated
 * cheque schedule. Every position below was measured on that scan in pixels
 * and is converted to points here, so fields sit on the printed rules exactly
 * where Q-Auto's own typed contracts put them. Signature lines stay empty.
 */

/** 200-dpi scan pixel → PDF point (595.08 pt / 1653 px). */
const PX = 595.08 / 1653;
const CHEQUE_ROWS_PER_PAGE = 36;

type Slot = {
  x0: number;
  x1: number;
  y: number;
  align?: Align;
  size?: number;
  bold?: boolean;
  /** Free space a long value (names) may spill into before it shrinks. */
  wide?: readonly [number, number];
};

function put(w: PageWriter, value: unknown, slot: Slot) {
  w.text(value, {
    x0: slot.x0 * PX,
    x1: slot.x1 * PX,
    baseline: slot.y * PX,
    align: slot.align ?? 'center',
    size: slot.size ?? 8.5,
    bold: slot.bold,
    minSize: slot.wide ? 6 : undefined,
    overflow: slot.wide ? { x0: slot.wide[0] * PX, x1: slot.wide[1] * PX } : undefined,
  });
}

// ── Header (pages 1 and 2) ──────────────────────────────────────────────────
const HEADER = {
  account: { x0: 406, x1: 647, y: 189, bold: true, size: 9 },
  contract: { x0: 406, x1: 647, y: 224, bold: true, size: 9 },
  /** Centres of the eight typed digits D D | M M | Y Y Y Y on each "Date :" row. */
  dateDigitX: [1122, 1172, 1222, 1271, 1320, 1374, 1424, 1474],
  dateRowsY: [188, 223],
} as const;

// ── Page 1 ──────────────────────────────────────────────────────────────────
const P1 = {
  name: { x0: 305, x1: 860, y: 311, bold: true, size: 9.5, wide: [305, 1295] },
  nationality: { x0: 305, x1: 745, y: 349 },
  mobile: { x0: 1098, x1: 1385, y: 348 },
  qid: { x0: 305, x1: 745, y: 386 },
  qidExpiry: { x0: 1098, x1: 1385, y: 386 },
  passport: { x0: 305, x1: 745, y: 424 },
  passportExpiry: { x0: 1098, x1: 1385, y: 426 },
  email: { x0: 358, x1: 1385, y: 461 },
  buildingCell: { x0: 604, x1: 695, y: 496 },
  streetCell: { x0: 901, x1: 992, y: 496 },
  zoneCell: { x0: 1189, x1: 1279, y: 496 },
  streetName: { x0: 308, x1: 792, y: 533 },
  poBox: { x0: 1098, x1: 1385, y: 533 },
  buildingNo: { x0: 308, x1: 500, y: 567 },
  phone: { x0: 800, x1: 945, y: 568 },
  fax: { x0: 1138, x1: 1385, y: 568 },
  employer: { x0: 407, x1: 1385, y: 655 },
  occupation: { x0: 308, x1: 843, y: 692 },
  tenure: { x0: 1138, x1: 1385, y: 693 },
  companyAddress: { x0: 358, x1: 1385, y: 728 },
  companyStreet: { x0: 308, x1: 792, y: 764 },
  companyPoBox: { x0: 1098, x1: 1385, y: 765 },
  companyBuilding: { x0: 308, x1: 500, y: 801 },
  companyPhone: { x0: 800, x1: 993, y: 802 },
  companyFax: { x0: 1188, x1: 1385, y: 802 },
  companyEmail: { x0: 308, x1: 1385, y: 837 },
  vehicleNo: { x0: 404, x1: 498, y: 1220 },
  vehicleType: { x0: 506, x1: 1088, y: 1220, bold: true },
  vehicleQty: { x0: 1095, x1: 1330, y: 1220 },
  vehicleTotalQty: { x0: 1095, x1: 1330, y: 1259 },
  invoiceNo: { x0: 456, x1: 744, y: 1296 },
  contractDate: { x0: 1240, x1: 1424, y: 1299 },
  engineNo: { x0: 305, x1: 755, y: 1333 },
  chassisNo: { x0: 1112, x1: 1395, y: 1336 },
  customerNameLine: { x0: 354, x1: 741, y: 1881, wide: [354, 1000] },
} as const;

/** Left finance column: values right-aligned on the rules, as Q-Auto types them. */
const FIN_LEFT = { x0: 357, x1: 636 };
const FIN_LEFT_Y = {
  salesPrice: 1405,
  downPayment: 1442,
  fees: 1479,
  additional: 1516,
  requested: 1553,
  insurance: 1590,
  insurancePeriod: 1628,
  totalFinance: 1665,
  vfaPeriod: 1702,
  grandTotal: 1739,
  cheques: 1792,
} as const;
const FIN_RIGHT = { x0: 1138, x1: 1376 };
const FIN_RIGHT_Y = { installments: 1408, installmentAmount: 1445, total: 1482, extra1: 1595, extra2: 1633 } as const;
/** Unlabelled rows of the right column take a label in the label column. */
const FIN_RIGHT_LABEL = { x0: 900, x1: 1128 };
/** Matches the printed label size of the column ("No of Installments"). */
const FIN_RIGHT_LABEL_SIZE = 10;
const CHEQUE_DATES = {
  first: { x0: 355, x1: 643, y: 1832 },
  bank: { x0: 1136, x1: 1481, y: 1796 },
  last: { x0: 1135, x1: 1381, y: 1837 },
} as const;

// ── Page 2 ──────────────────────────────────────────────────────────────────
const P2_CUSTOMER_NAME = { x0: 357, x1: 744, y: 435, wide: [357, 1000] as const };
/** Guarantor block rows; guarantor 2 sits 279.5 px lower on the same (slightly skewed) grid. */
const P2_GUARANTOR = {
  name: { x0: 257, x1: 1384, y: 648 },
  nationality: { x0: 258, x1: 449, y: 683 },
  idNo: { x0: 652, x1: 843, y: 683 },
  idExpiry: { x0: 1138, x1: 1384, y: 685 },
  employer: { x0: 258, x1: 744, y: 718 },
  occupation: { x0: 1138, x1: 1384, y: 720 },
  companyAddress: { x0: 357, x1: 1383, y: 753 },
  streetName: { x0: 307, x1: 1383, y: 788 },
  buildingNo: { x0: 307, x1: 400, y: 823 },
  phone: { x0: 701, x1: 893, y: 824 },
  fax: { x0: 1097, x1: 1384, y: 825 },
  email: { x0: 307, x1: 1383, y: 859 },
} as const;
const P2_GUARANTOR_STEP = 279.5;
const P2_GUARANTOR_SIGN_NAME = [
  { x0: 256, x1: 742, y: 1516, wide: [256, 780] },
  { x0: 1045, x1: 1481, y: 1519, wide: [1045, 1488] },
] as const;

// ── Page 9 (cheque schedule) ────────────────────────────────────────────────
const P9 = {
  date: { x0: 545, x1: 790, y: 256, size: 10 },
  account: { x0: 545, x1: 790, y: 312, size: 10 },
  invoiceNo: { x0: 545, x1: 790, y: 367, size: 10 },
  customerName: { x0: 1004, x1: 1560, y: 308, size: 10, wide: [1004, 1590] as const },
  invoiceDate: { x0: 1004, x1: 1560, y: 364, size: 10 },
  /** "By Customer (Buyer) — Name:" acknowledgement line. */
  buyerName: { x0: 1132, x1: 1560, y: 1949, size: 10, align: 'left' as const, wide: [1132, 1600] as const },
  total: { x0: 795, x1: 1016, y: 1854, size: 10.5, bold: true },
} as const;
/** Horizontal rules of the cheque table as [top, bottom] px; row i sits between rule i and rule i+1. */
const P9_RULES: ReadonlyArray<readonly [number, number]> = [
  [438, 487], // header band
  [516, 523], [553, 559], [590, 596], [627, 633], [664, 669], [700, 706], [738, 743], [775, 779], [811, 816],
  [848, 853], [885, 890], [923, 927], [960, 963], [996, 999], [1033, 1036], [1069, 1072], [1107, 1109],
  [1144, 1146], [1181, 1183], [1218, 1219], [1255, 1257], [1292, 1294], [1329, 1332], [1366, 1368], [1402, 1405],
  [1439, 1442], [1475, 1479], [1512, 1516], [1549, 1553], [1585, 1590], [1622, 1627], [1659, 1664], [1696, 1701],
  [1734, 1738], [1770, 1775], [1807, 1812],
];
const P9_ROW_SIZE = 9.5;

/** Baseline (px) that centres digits of the row's size between the rules above and below it. */
function chequeRowBaseline(row: number): number {
  const top = P9_RULES[row][1];
  const bottom = P9_RULES[row + 1][0];
  return (top + bottom) / 2 + (P9_ROW_SIZE * 0.718) / PX / 2;
}
const P9_COLS = {
  sr: { x0: 238, x1: 287 },
  chequeNo: { x0: 293, x1: 530 },
  date: { x0: 536, x1: 788 },
  amount: { x0: 795, x1: 1016 },
  bank: { x0: 1023, x1: 1228 },
  branch: { x0: 1235, x1: 1508 },
} as const;
const P9_PAGE_FOOTER = { x0: 70, x1: 230, top: 2132, bottom: 2172, y: 2160 };

type Facts = ReturnType<typeof factsOf>;

function factsOf(ctx: ContractFieldContext) {
  const snap = snapshotOf(ctx);
  const pricing = asRecord(ctx.pricing);
  const schedule = scheduleRows(ctx);
  const fees = roundMoney(Number(pricing.admin_fee ?? pricing.processing_fee ?? pricing.fees ?? 0) || 0);
  const additional = roundMoney(Number(pricing.additional_charges ?? 0) || 0);
  const insurance = roundMoney(Number(pricing.insurance_amount ?? 0) || 0);
  const insuranceYears = Number(pricing.insurance_years ?? 0) || 0;
  const requested = roundMoney(Math.max(ctx.listPrice - ctx.downPayment, 0) + fees + additional);
  const scheduleTotal = roundMoney(schedule.reduce((sum, row) => sum + row.payment, 0));
  const balloon = roundMoney(Number(pricing.balloon ?? 0) || 0);
  const hasBalloon = balloon > 0 && schedule.length > 1 && schedule[schedule.length - 1].payment > ctx.monthly + 0.01;
  const regular = (hasBalloon ? schedule.slice(0, -1) : schedule).map((row) => row.payment);
  const minInstallment = regular.length ? Math.min(...regular) : ctx.monthly;
  const maxInstallment = regular.length ? Math.max(...regular) : ctx.monthly;
  // Declining-balance plans have a different amount every month; a flat plan only
  // differs by the final rounding cent.
  const installmentAmount =
    maxInstallment - minInstallment > 1
      ? `${money(minInstallment)} – ${money(maxInstallment)}`
      : ctx.monthly > 0
        ? money(ctx.monthly)
        : '';
  return {
    installmentAmount,
    snap,
    contractNo: formatQautoContractNo(ctx.contractSeries, ctx.contractNumber),
    account: str(ctx.sapNumber),
    date: qatarDateParts(ctx.approvedAt),
    dateText: qatarDate(ctx.approvedAt),
    customerName: str(snap.full_name).toUpperCase(),
    fees,
    additional,
    insurance,
    insuranceYears,
    requested,
    grandTotal: roundMoney(requested + insurance),
    totalFinance: scheduleTotal || roundMoney(ctx.financedTotal),
    schedule,
    hasBalloon,
    balloon,
    regularInstallments: hasBalloon ? schedule.length - 1 : schedule.length,
    chequeBank: str(pricing.cheque_bank),
  };
}

/** Payment rows the cheques are written against (normalised schedule, else flat monthly rows). */
function scheduleRows(ctx: ContractFieldContext): ContractScheduleRow[] {
  const rows = ctx.schedule.filter((row) => row.payment > 0);
  if (rows.length) return rows;
  if (!(ctx.tenor > 0) || !(ctx.monthly > 0)) return [];
  const { d, m, y } = qatarDateParts(ctx.approvedAt);
  const day = Number(d);
  return Array.from({ length: ctx.tenor }, (_, index) => {
    const due = new Date(Date.UTC(Number(y), Number(m) + index, Math.min(day, 28)));
    return {
      sequence: index + 1,
      dueDate: due.toISOString().slice(0, 10),
      payment: ctx.monthly,
      principal: 0,
      interest: 0,
      balance: 0,
    };
  });
}

/** Page 2's header band sits 2 px higher on the scan than page 1's. */
function drawHeader(w: PageWriter, facts: Facts, dy = 0) {
  put(w, facts.account, { ...HEADER.account, y: HEADER.account.y + dy });
  put(w, facts.contractNo, { ...HEADER.contract, y: HEADER.contract.y + dy });
  const digits = `${facts.date.d}${facts.date.m}${facts.date.y}`.split('');
  for (const y of HEADER.dateRowsY) {
    digits.forEach((digit, index) => {
      const cx = HEADER.dateDigitX[index];
      put(w, digit, { x0: cx - 18, x1: cx + 18, y: y + dy, bold: true, size: 9 });
    });
  }
}

function drawPageOne(w: PageWriter, ctx: ContractFieldContext, facts: Facts) {
  const snap = facts.snap;
  const address = nationalAddressOf(snap);
  const employment = employmentOf(snap);
  const ids = identityDocumentsOf(ctx, snap);

  drawHeader(w, facts);

  put(w, facts.customerName, P1.name);
  put(w, nationalityOf(snap).toUpperCase(), P1.nationality);
  put(w, phoneLocal(snap.phone), P1.mobile);
  put(w, str(snap.qid), P1.qid);
  put(w, ids.qidExpiry, P1.qidExpiry);
  put(w, ids.passportNo, P1.passport);
  put(w, ids.passportExpiry, P1.passportExpiry);
  put(w, ctx.customerEmail || str(snap.email), P1.email);
  put(w, address.buildingNo, P1.buildingCell);
  put(w, address.streetNo, P1.streetCell);
  put(w, address.zone, P1.zoneCell);
  put(w, address.streetName, P1.streetName);
  put(w, address.poBox, P1.poBox);
  put(w, address.buildingNo, P1.buildingNo);
  put(w, phoneLocal(asRecord(snap.address).phone ?? snap.homePhone), P1.phone);

  put(w, str(employment.company), P1.employer);
  put(w, str(employment.jobTitle) || str(employment.position), P1.occupation);
  put(w, employmentTenure(employment), P1.tenure);
  put(w, str(employment.companyAddress), P1.companyAddress);
  put(w, str(employment.companyStreet), P1.companyStreet);
  put(w, str(employment.poBox) || str(employment.companyPoBox), P1.companyPoBox);
  put(w, str(employment.companyBuilding), P1.companyBuilding);
  put(w, phoneLocal(employment.phone ?? employment.companyPhone), P1.companyPhone);
  put(w, phoneLocal(employment.fax), P1.companyFax);
  put(w, str(employment.email) || str(employment.companyEmail), P1.companyEmail);

  put(w, '1', P1.vehicleNo);
  put(w, vehicleDescription(ctx.vehicle), P1.vehicleType);
  put(w, '1', P1.vehicleQty);
  put(w, '1', P1.vehicleTotalQty);
  put(w, facts.contractNo, P1.invoiceNo);
  put(w, facts.dateText, P1.contractDate);
  put(w, str(ctx.vehicle.engineNumber), P1.engineNo);
  put(w, str(ctx.vehicle.chassisNumber) || str(ctx.vehicle.vin), P1.chassisNo);

  const left = (value: string, y: number) => put(w, value, { ...FIN_LEFT, y, align: 'right' });
  const dash = (amount: number) => (amount > 0 ? money(amount) : '-');
  left(money(ctx.listPrice), FIN_LEFT_Y.salesPrice);
  left(`(${money(ctx.downPayment)})`, FIN_LEFT_Y.downPayment);
  left(dash(facts.fees), FIN_LEFT_Y.fees);
  left(dash(facts.additional), FIN_LEFT_Y.additional);
  left(money(facts.requested), FIN_LEFT_Y.requested);
  left(dash(facts.insurance), FIN_LEFT_Y.insurance);
  if (facts.insurance > 0 && facts.insuranceYears > 0) {
    left(`${facts.insuranceYears} ${facts.insuranceYears === 1 ? 'Year' : 'Years'}`, FIN_LEFT_Y.insurancePeriod);
  }
  left(money(facts.totalFinance), FIN_LEFT_Y.totalFinance);
  left(ctx.tenor > 0 ? `${ctx.tenor} Months` : '', FIN_LEFT_Y.vfaPeriod);
  left(money(facts.grandTotal), FIN_LEFT_Y.grandTotal);

  const right = (value: string, y: number) => put(w, value, { ...FIN_RIGHT, y, align: 'right' });
  right(facts.regularInstallments ? String(facts.regularInstallments) : '', FIN_RIGHT_Y.installments);
  right(facts.installmentAmount, FIN_RIGHT_Y.installmentAmount);
  right(money(facts.totalFinance), FIN_RIGHT_Y.total);
  if (facts.hasBalloon) {
    const last = facts.schedule[facts.schedule.length - 1];
    put(w, 'Balloon payment', { ...FIN_RIGHT_LABEL, y: FIN_RIGHT_Y.extra1, align: 'left', size: FIN_RIGHT_LABEL_SIZE });
    right(money(last.payment), FIN_RIGHT_Y.extra1);
    put(w, 'Balloon due date', { ...FIN_RIGHT_LABEL, y: FIN_RIGHT_Y.extra2, align: 'left', size: FIN_RIGHT_LABEL_SIZE });
    right(isoToDisplay(last.dueDate), FIN_RIGHT_Y.extra2);
  }

  left(facts.schedule.length ? String(facts.schedule.length) : '', FIN_LEFT_Y.cheques);
  const first = facts.schedule[0];
  const last = facts.schedule[facts.schedule.length - 1];
  put(w, first ? isoToDisplay(first.dueDate).replace(/\//g, ' / ') : '', CHEQUE_DATES.first);
  put(w, facts.chequeBank, CHEQUE_DATES.bank);
  put(w, last ? isoToDisplay(last.dueDate).replace(/\//g, ' / ') : '', CHEQUE_DATES.last);

  put(w, facts.customerName, P1.customerNameLine);
}

function drawGuarantor(w: PageWriter, guarantor: Record<string, unknown>, offsetY: number) {
  const at = (slot: Slot) => ({ ...slot, y: slot.y + offsetY });
  const g = P2_GUARANTOR;
  put(w, str(guarantor.fullName).toUpperCase(), { ...at(g.name), bold: true });
  put(w, nationalityOf(guarantor).toUpperCase(), at(g.nationality));
  put(w, str(guarantor.qid), at(g.idNo));
  put(w, isoToDisplay(guarantor.qidExpiry), at(g.idExpiry));
  put(w, str(guarantor.employer) || str(guarantor.company), at(g.employer));
  put(w, str(guarantor.occupation) || str(guarantor.jobTitle), at(g.occupation));
  put(w, str(guarantor.companyAddress), at(g.companyAddress));
  put(w, str(guarantor.address) || str(guarantor.streetName), at(g.streetName));
  put(w, str(guarantor.buildingNo), at(g.buildingNo));
  put(w, phoneLocal(guarantor.phone), at(g.phone));
  put(w, phoneLocal(guarantor.fax), at(g.fax));
  put(w, str(guarantor.email), at(g.email));
}

function drawPageTwo(w: PageWriter, facts: Facts) {
  drawHeader(w, facts, -2);
  put(w, facts.customerName, P2_CUSTOMER_NAME);
  const snap = facts.snap as Record<string, unknown>;
  const guarantors = [asRecord(snap.guarantor), asRecord(snap.guarantor2)].filter((g) => str(g.fullName));
  guarantors.forEach((guarantor, index) => {
    drawGuarantor(w, guarantor, index * P2_GUARANTOR_STEP);
    put(w, str(guarantor.fullName).toUpperCase(), P2_GUARANTOR_SIGN_NAME[index]);
  });
}

function drawChequePage(
  w: PageWriter,
  facts: Facts,
  rows: ContractScheduleRow[],
  firstIndex: number,
  pageIndex: number,
  pageCount: number,
) {
  put(w, facts.dateText, P9.date);
  put(w, facts.account, P9.account);
  put(w, facts.contractNo, P9.invoiceNo);
  put(w, facts.customerName, P9.customerName);
  put(w, facts.dateText, P9.invoiceDate);
  put(w, facts.customerName, P9.buyerName);

  rows.forEach((row, index) => {
    const y = chequeRowBaseline(index);
    const cell = (value: string, col: { x0: number; x1: number }) => put(w, value, { ...col, y, size: P9_ROW_SIZE });
    cell(String(firstIndex + index + 1), P9_COLS.sr);
    cell(isoToDisplay(row.dueDate), P9_COLS.date);
    cell(money(row.payment), P9_COLS.amount);
    if (facts.chequeBank) cell(facts.chequeBank, P9_COLS.bank);
  });

  const lastPage = pageIndex === pageCount - 1;
  if (lastPage) {
    put(w, money(facts.schedule.reduce((sum, row) => sum + row.payment, 0)), P9.total);
  } else {
    w.italic('Continued overleaf', {
      x0: P9.total.x0 * PX,
      x1: P9.total.x1 * PX,
      baseline: (P9.total.y - 4) * PX,
      align: 'center',
      size: 7.5,
    });
  }
  if (pageCount > 1) {
    const f = P9_PAGE_FOOTER;
    w.mask(f.x0 * PX, f.top * PX, f.x1 * PX, f.bottom * PX);
    w.italic(`Page ${pageIndex + 1} of ${pageCount}`, {
      x0: f.x0 * PX,
      x1: f.x1 * PX,
      baseline: f.y * PX,
      align: 'left',
      size: 6.5,
    });
  }
}

async function chequePages(doc: PDFDocument, template: PDFPage, count: number): Promise<PDFPage[]> {
  const pages = [template];
  if (count <= 1) return pages;
  const templateIndex = doc.getPages().indexOf(template);
  const copies = await doc.copyPages(doc, Array.from({ length: count - 1 }, () => templateIndex));
  for (const copy of copies) pages.push(doc.addPage(copy));
  return pages;
}

export async function buildQautoVehiclesFinanceAgreementPdf(ctx: ContractFieldContext): Promise<Buffer> {
  const bytes = fs.readFileSync(resolveQautoFormPath('QAuto_Vehicles_Finance_Agreement.pdf'));
  const doc = await PDFDocument.load(bytes);
  const pages = doc.getPages();
  if (pages.length < 9) throw new Error(`qauto_vfa_template_pages:${pages.length}`);

  const fonts: FormFonts = await embedFormFonts(doc);
  const facts = factsOf(ctx);

  // Clone the blank cheque page before anything is drawn on it.
  const chunks: ContractScheduleRow[][] = [];
  for (let i = 0; i < facts.schedule.length; i += CHEQUE_ROWS_PER_PAGE) {
    chunks.push(facts.schedule.slice(i, i + CHEQUE_ROWS_PER_PAGE));
  }
  if (!chunks.length) chunks.push([]);
  const cheques = await chequePages(doc, pages[8], chunks.length);

  drawPageOne(new PageWriter(pages[0], fonts), ctx, facts);
  drawPageTwo(new PageWriter(pages[1], fonts), facts);
  chunks.forEach((rows, index) => {
    drawChequePage(
      new PageWriter(cheques[index], fonts),
      facts,
      rows,
      index * CHEQUE_ROWS_PER_PAGE,
      index,
      chunks.length,
    );
  });

  doc.setTitle(`Q-Auto Vehicles Finance Agreement${facts.contractNo ? ` ${facts.contractNo}` : ''}`);
  return Buffer.from(await doc.save());
}
