import { createHash } from 'node:crypto';
import { PDFDocument, PDFFont, PDFPage, StandardFonts } from 'pdf-lib';
import {
  buildInstallmentAmounts,
  buildPrincipalAmounts,
  paymentInputFromPricingSnapshot,
  roundMoney,
  sumInstallmentAmounts,
} from '@drivemarket/shared/pricing';
import { buildScheduleDrafts } from './payment-schedules';
import { QATAR_FINANCING_DISCLOSURES } from './contract-disclosures';

/**
 * One installment of the contract schedule. `interest` is the historical key
 * for the rent (profit) component — kept so stored `contractData` and the
 * content fingerprint stay stable; the rendered text says "rent (profit)".
 */
export type ContractScheduleRow = {
  sequence: number;
  dueDate: string;
  payment: number;
  principal: number;
  interest: number;
  balance: number;
};

export type ContractPdfInput = {
  applicationId: string;
  approvedAt: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerQid: string;
  vehicleLabel: string;
  dealerName: string;
  listPrice: number;
  downPayment: number;
  downPaymentPct: number;
  monthly: number;
  tenor: number;
  annualRate: number;
  financedTotal: number;
  lenderName: string;
  schedule: ContractScheduleRow[];
};

export type ContractPdfResult = {
  buffer: Buffer;
  contentSha256: string;
};

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN_X = 48;
const FOOTER_Y = 36;

function qar(amount: number): string {
  return `QAR ${amount.toLocaleString('en-QA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(',')}]`;
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(',')}}`;
}

/** Deterministic SHA-256 over canonical contract terms (pre-signature). */
export function hashContractContent(input: ContractPdfInput): string {
  const canonical = {
    applicationId: input.applicationId,
    approvedAt: input.approvedAt,
    customerEmail: input.customerEmail,
    customerQid: input.customerQid,
    vehicleLabel: input.vehicleLabel,
    dealerName: input.dealerName,
    listPrice: roundMoney(input.listPrice),
    downPayment: roundMoney(input.downPayment),
    downPaymentPct: roundMoney(input.downPaymentPct),
    tenor: input.tenor,
    annualRate: roundMoney(input.annualRate),
    financedTotal: roundMoney(input.financedTotal),
    lenderName: input.lenderName,
    schedule: input.schedule.map((row) => ({
      sequence: row.sequence,
      dueDate: row.dueDate,
      payment: roundMoney(row.payment),
      principal: roundMoney(row.principal),
      interest: roundMoney(row.interest),
      balance: roundMoney(row.balance),
    })),
  };
  return createHash('sha256').update(stableStringify(canonical)).digest('hex');
}

/** Signed uploads must still carry the generated document fingerprint metadata. */
export async function verifySignedContractReferencesOriginal(
  signedPdf: Buffer,
  expectedContentSha256: string,
  applicationId: string,
): Promise<boolean> {
  if (!/^[a-f0-9]{64}$/.test(expectedContentSha256)) {
    return false;
  }
  try {
    const doc = await PDFDocument.load(signedPdf, { ignoreEncryption: true });
    const subject = doc.getSubject();
    if (subject === expectedContentSha256) {
      return true;
    }
    const keywords = doc.getKeywords()?.split(/[\s,]+/) ?? [];
    return keywords.includes(expectedContentSha256) && keywords.includes(applicationId);
  } catch {
    return false;
  }
}

export function buildContractAmortizationSchedule(
  pricingSnapshot: Record<string, unknown>,
  approvedAt: Date,
): ContractScheduleRow[] {
  const input = paymentInputFromPricingSnapshot(pricingSnapshot);
  const payments = buildInstallmentAmounts(input);
  const principals = buildPrincipalAmounts(input);
  const drafts = buildScheduleDrafts(pricingSnapshot, approvedAt);
  let balance = roundMoney(Math.max(input.price - input.downPayment, 0));

  return drafts.map((draft, index) => {
    const payment = payments[index] ?? 0;
    const principal = principals[index] ?? 0;
    const interest = roundMoney(Math.max(payment - principal, 0));
    balance = roundMoney(Math.max(balance - principal, 0));
    return {
      sequence: draft.sequence,
      dueDate: draft.dueDate.toISOString().slice(0, 10),
      payment,
      principal,
      interest,
      balance,
    };
  });
}

class PdfWriter {
  private page: PDFPage;
  private y = 800;
  private pageIndex = 1;

  constructor(
    private readonly doc: PDFDocument,
    private readonly font: PDFFont,
    private readonly bold: PDFFont,
    private readonly contentSha256: string,
    private readonly applicationId: string,
  ) {
    this.page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  }

  private drawFooter() {
    this.page.drawText(`Application ${this.applicationId} · Page ${this.pageIndex}`, {
      x: MARGIN_X,
      y: FOOTER_Y,
      size: 8,
      font: this.font,
    });
  }

  newPage() {
    this.drawFooter();
    this.page = this.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    this.y = 800;
    this.pageIndex += 1;
  }

  ensureSpace(lines: number, lineHeight = 16) {
    if (this.y - lines * lineHeight < 72) {
      this.newPage();
    }
  }

  line(text: string, opts?: { bold?: boolean; size?: number; gap?: number }) {
    const size = opts?.size ?? 11;
    const gap = opts?.gap ?? (size > 12 ? 22 : 16);
    this.ensureSpace(1, gap);
    if (!text) {
      this.y -= 10;
      return;
    }
    this.page.drawText(text, {
      x: MARGIN_X,
      y: this.y,
      size,
      font: opts?.bold ? this.bold : this.font,
    });
    this.y -= gap;
  }

  finish() {
    this.drawFooter();
    this.line('');
    for (const trailer of contractTrailerLines(this.contentSha256)) {
      this.line(trailer, { size: 9 });
    }
  }

  embedDocumentMetadata(contentSha256: string, applicationId: string) {
    this.doc.setSubject(contentSha256);
    this.doc.setKeywords([applicationId, contentSha256]);
  }
}

export type ContractLine = { text: string; bold?: boolean; size?: number; gap?: number };

/** Lines printed after the signatures block (fingerprint + signing instruction). */
export function contractTrailerLines(contentSha256: string): string[] {
  return [
    `Document fingerprint (SHA-256): ${contentSha256}`,
    'Sign this contract without altering the terms above. Upload the signed PDF in your Blox portal.',
  ];
}

/**
 * Every line of the contract body, in print order. Exported so the
 * terminology spec can scan the rendered text: the product is Diminishing
 * Musharakah, so the vocabulary is rent / profit, never interest, APR, cost
 * of credit or late charges.
 */
export function buildContractLines(input: ContractPdfInput): ContractLine[] {
  const amountFinanced = roundMoney(Math.max(input.listPrice - input.downPayment, 0));
  const totalPayable = roundMoney(input.downPayment + input.financedTotal);
  const totalRentPayable = roundMoney(Math.max(input.financedTotal - amountFinanced, 0));
  const approvedDate = input.approvedAt.slice(0, 10);
  const lines: ContractLine[] = [];
  const line = (text: string, opts?: Omit<ContractLine, 'text'>) => lines.push({ text, ...(opts ?? {}) });

  line('Vehicle Co-Ownership Financing Agreement (Diminishing Musharakah)', { size: 16, bold: true });
  line('');
  line(`Application ID: ${input.applicationId}`);
  line(`Approval date: ${approvedDate}`);
  line(`Lender of record: ${input.lenderName}`, { bold: true });
  line('');
  line('1. Parties', { bold: true });
  line(`Customer: ${input.customerName}`);
  line(`Email: ${input.customerEmail}`);
  line(`Phone: ${input.customerPhone}`);
  line(`QID: ${input.customerQid}`);
  line(`Dealer: ${input.dealerName}`);
  line('');
  line('2. Financed asset', { bold: true });
  line(`Vehicle: ${input.vehicleLabel}`);
  line(`Cash price (list): ${qar(input.listPrice)}`);
  line('');
  line('3. Financing summary (locked at approval)', { bold: true });
  line(`Down payment (${input.downPaymentPct.toFixed(2)}%): ${qar(input.downPayment)}`);
  line(`Initial co-ownership: 100 nominal units. The customer's initial contribution buys units at the cash price; Blox holds the remainder.`);
  line(`Amount financed (co-owner share purchased over the term): ${qar(amountFinanced)}`);
  line(`Annual profit rate: ${input.annualRate.toFixed(2)}%`);
  line(`Tenure: ${input.tenor} months`);
  line(`Monthly installment (principal + rent): ${qar(input.monthly)}`);
  line(`Total installments payable: ${qar(input.financedTotal)}`);
  line(`Total amount payable (down payment + installments): ${qar(totalPayable)}`);
  line(`Total rent payable (profit over the term): ${qar(totalRentPayable)}`);
  line('');
  line('4. Disclosures', { bold: true });
  for (const paragraph of QATAR_FINANCING_DISCLOSURES) {
    line(paragraph);
  }
  line('');
  line('5. Payment schedule', { bold: true });
  line('#   Due date     Payment       Principal     Monthly rent (profit)  Balance', { size: 9, bold: true });

  for (const row of input.schedule) {
    line(
      `${String(row.sequence).padStart(2, ' ')}  ${row.dueDate}  ${qar(row.payment).padStart(12, ' ')}  ${qar(row.principal).padStart(12, ' ')}  ${qar(row.interest).padStart(21, ' ')}  ${qar(row.balance).padStart(12, ' ')}`,
      { size: 9, gap: 12 },
    );
  }

  line('');
  line('6. Signatures', { bold: true });
  line('Customer signature: _________________________________   Date: ______________');
  line('Lender representative: _____________________________   Date: ______________');
  return lines;
}

/** The complete printable text of the contract (body + trailer), for terminology checks. */
export function contractTextFor(input: ContractPdfInput): string {
  const contentSha256 = hashContractContent(input);
  return [...buildContractLines(input).map((entry) => entry.text), ...contractTrailerLines(contentSha256)].join('\n');
}

export async function buildContractPdf(input: ContractPdfInput): Promise<ContractPdfResult> {
  const contentSha256 = hashContractContent(input);
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const writer = new PdfWriter(doc, font, bold, contentSha256, input.applicationId);

  for (const entry of buildContractLines(input)) {
    writer.line(entry.text, { bold: entry.bold, size: entry.size, gap: entry.gap });
  }
  writer.finish();
  writer.embedDocumentMetadata(contentSha256, input.applicationId);

  const buffer = Buffer.from(await doc.save());
  return { buffer, contentSha256 };
}

export function resolveFinancedTotal(pricingSnapshot: Record<string, unknown>): number {
  const fromSnapshot = Number(pricingSnapshot.financed_total);
  if (Number.isFinite(fromSnapshot) && fromSnapshot > 0) {
    return roundMoney(fromSnapshot);
  }
  const input = paymentInputFromPricingSnapshot(pricingSnapshot);
  return sumInstallmentAmounts(buildInstallmentAmounts(input));
}
