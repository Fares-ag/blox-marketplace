"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hashContractContent = hashContractContent;
exports.verifySignedContractReferencesOriginal = verifySignedContractReferencesOriginal;
exports.buildContractAmortizationSchedule = buildContractAmortizationSchedule;
exports.contractTrailerLines = contractTrailerLines;
exports.buildContractLines = buildContractLines;
exports.contractTextFor = contractTextFor;
exports.buildContractPdf = buildContractPdf;
exports.resolveFinancedTotal = resolveFinancedTotal;
const node_crypto_1 = require("node:crypto");
const pdf_lib_1 = require("pdf-lib");
const pricing_1 = require("@drivemarket/shared/pricing");
const payment_schedules_1 = require("./payment-schedules");
const contract_disclosures_1 = require("./contract-disclosures");
const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN_X = 48;
const FOOTER_Y = 36;
function qar(amount) {
    return `QAR ${amount.toLocaleString('en-QA', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;
}
function stableStringify(value) {
    if (value === null || typeof value !== 'object') {
        return JSON.stringify(value);
    }
    if (Array.isArray(value)) {
        return `[${value.map((entry) => stableStringify(entry)).join(',')}]`;
    }
    const record = value;
    const keys = Object.keys(record).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(',')}}`;
}
function hashContractContent(input) {
    const canonical = {
        applicationId: input.applicationId,
        approvedAt: input.approvedAt,
        customerEmail: input.customerEmail,
        customerQid: input.customerQid,
        vehicleLabel: input.vehicleLabel,
        dealerName: input.dealerName,
        listPrice: (0, pricing_1.roundMoney)(input.listPrice),
        downPayment: (0, pricing_1.roundMoney)(input.downPayment),
        downPaymentPct: (0, pricing_1.roundMoney)(input.downPaymentPct),
        tenor: input.tenor,
        annualRate: (0, pricing_1.roundMoney)(input.annualRate),
        financedTotal: (0, pricing_1.roundMoney)(input.financedTotal),
        lenderName: input.lenderName,
        schedule: input.schedule.map((row) => ({
            sequence: row.sequence,
            dueDate: row.dueDate,
            payment: (0, pricing_1.roundMoney)(row.payment),
            principal: (0, pricing_1.roundMoney)(row.principal),
            interest: (0, pricing_1.roundMoney)(row.interest),
            balance: (0, pricing_1.roundMoney)(row.balance),
        })),
    };
    return (0, node_crypto_1.createHash)('sha256').update(stableStringify(canonical)).digest('hex');
}
async function verifySignedContractReferencesOriginal(signedPdf, expectedContentSha256, applicationId) {
    if (!/^[a-f0-9]{64}$/.test(expectedContentSha256)) {
        return false;
    }
    try {
        const doc = await pdf_lib_1.PDFDocument.load(signedPdf, { ignoreEncryption: true });
        const subject = doc.getSubject();
        if (subject === expectedContentSha256) {
            return true;
        }
        const keywords = doc.getKeywords()?.split(/[\s,]+/) ?? [];
        return keywords.includes(expectedContentSha256) && keywords.includes(applicationId);
    }
    catch {
        return false;
    }
}
function buildContractAmortizationSchedule(pricingSnapshot, approvedAt) {
    const input = (0, pricing_1.paymentInputFromPricingSnapshot)(pricingSnapshot);
    const payments = (0, pricing_1.buildInstallmentAmounts)(input);
    const principals = (0, pricing_1.buildPrincipalAmounts)(input);
    const drafts = (0, payment_schedules_1.buildScheduleDrafts)(pricingSnapshot, approvedAt);
    let balance = (0, pricing_1.roundMoney)(Math.max(input.price - input.downPayment, 0));
    return drafts.map((draft, index) => {
        const payment = payments[index] ?? 0;
        const principal = principals[index] ?? 0;
        const interest = (0, pricing_1.roundMoney)(Math.max(payment - principal, 0));
        balance = (0, pricing_1.roundMoney)(Math.max(balance - principal, 0));
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
    doc;
    font;
    bold;
    contentSha256;
    applicationId;
    page;
    y = 800;
    pageIndex = 1;
    constructor(doc, font, bold, contentSha256, applicationId) {
        this.doc = doc;
        this.font = font;
        this.bold = bold;
        this.contentSha256 = contentSha256;
        this.applicationId = applicationId;
        this.page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    }
    drawFooter() {
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
    ensureSpace(lines, lineHeight = 16) {
        if (this.y - lines * lineHeight < 72) {
            this.newPage();
        }
    }
    line(text, opts) {
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
    embedDocumentMetadata(contentSha256, applicationId) {
        this.doc.setSubject(contentSha256);
        this.doc.setKeywords([applicationId, contentSha256]);
    }
}
function contractTrailerLines(contentSha256) {
    return [
        `Document fingerprint (SHA-256): ${contentSha256}`,
        'Sign this contract without altering the terms above. Upload the signed PDF in your Blox portal.',
    ];
}
function buildContractLines(input) {
    const amountFinanced = (0, pricing_1.roundMoney)(Math.max(input.listPrice - input.downPayment, 0));
    const totalPayable = (0, pricing_1.roundMoney)(input.downPayment + input.financedTotal);
    const totalRentPayable = (0, pricing_1.roundMoney)(Math.max(input.financedTotal - amountFinanced, 0));
    const approvedDate = input.approvedAt.slice(0, 10);
    const lines = [];
    const line = (text, opts) => lines.push({ text, ...(opts ?? {}) });
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
    line(`Amount financed (co-owner share purchased over the term): ${qar(amountFinanced)}`);
    line(`Annual profit rate: ${input.annualRate.toFixed(2)}%`);
    line(`Tenure: ${input.tenor} months`);
    line(`Monthly installment (principal + rent): ${qar(input.monthly)}`);
    line(`Total installments payable: ${qar(input.financedTotal)}`);
    line(`Total amount payable (down payment + installments): ${qar(totalPayable)}`);
    line(`Total rent payable (profit over the term): ${qar(totalRentPayable)}`);
    line('');
    line('4. Disclosures', { bold: true });
    for (const paragraph of contract_disclosures_1.QATAR_FINANCING_DISCLOSURES) {
        line(paragraph);
    }
    line('');
    line('5. Payment schedule', { bold: true });
    line('#   Due date     Payment       Principal     Monthly rent (profit)  Balance', { size: 9, bold: true });
    for (const row of input.schedule) {
        line(`${String(row.sequence).padStart(2, ' ')}  ${row.dueDate}  ${qar(row.payment).padStart(12, ' ')}  ${qar(row.principal).padStart(12, ' ')}  ${qar(row.interest).padStart(21, ' ')}  ${qar(row.balance).padStart(12, ' ')}`, { size: 9, gap: 12 });
    }
    line('');
    line('6. Signatures', { bold: true });
    line('Customer signature: _________________________________   Date: ______________');
    line('Lender representative: _____________________________   Date: ______________');
    return lines;
}
function contractTextFor(input) {
    const contentSha256 = hashContractContent(input);
    return [...buildContractLines(input).map((entry) => entry.text), ...contractTrailerLines(contentSha256)].join('\n');
}
async function buildContractPdf(input) {
    const contentSha256 = hashContractContent(input);
    const doc = await pdf_lib_1.PDFDocument.create();
    const font = await doc.embedFont(pdf_lib_1.StandardFonts.Helvetica);
    const bold = await doc.embedFont(pdf_lib_1.StandardFonts.HelveticaBold);
    const writer = new PdfWriter(doc, font, bold, contentSha256, input.applicationId);
    for (const entry of buildContractLines(input)) {
        writer.line(entry.text, { bold: entry.bold, size: entry.size, gap: entry.gap });
    }
    writer.finish();
    writer.embedDocumentMetadata(contentSha256, input.applicationId);
    const buffer = Buffer.from(await doc.save());
    return { buffer, contentSha256 };
}
function resolveFinancedTotal(pricingSnapshot) {
    const fromSnapshot = Number(pricingSnapshot.financed_total);
    if (Number.isFinite(fromSnapshot) && fromSnapshot > 0) {
        return (0, pricing_1.roundMoney)(fromSnapshot);
    }
    const input = (0, pricing_1.paymentInputFromPricingSnapshot)(pricingSnapshot);
    return (0, pricing_1.sumInstallmentAmounts)((0, pricing_1.buildInstallmentAmounts)(input));
}
//# sourceMappingURL=contract-pdf.js.map