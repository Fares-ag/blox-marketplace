import { PDFDocument, StandardFonts } from 'pdf-lib';

export type ContractPdfInput = {
  applicationId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerQid: string;
  vehicleLabel: string;
  dealerName: string;
  listPrice: number;
  downPayment: number;
  monthly: number;
  tenor: number;
  annualRate: number;
  lenderName?: string;
};

export async function buildContractPdf(input: ContractPdfInput): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const lender = input.lenderName ?? 'DriveMarket Financing (placeholder)';

  const lines: Array<{ text: string; size?: number; bold?: boolean }> = [
    { text: 'Vehicle Financing Agreement', size: 16, bold: true },
    { text: '' },
    { text: `Application ID: ${input.applicationId}` },
    { text: `Date: ${new Date().toISOString().slice(0, 10)}` },
    { text: '' },
    { text: 'Customer', bold: true },
    { text: `Name: ${input.customerName}` },
    { text: `Email: ${input.customerEmail}` },
    { text: `Phone: ${input.customerPhone}` },
    { text: `QID: ${input.customerQid}` },
    { text: '' },
    { text: 'Vehicle & dealer', bold: true },
    { text: `Vehicle: ${input.vehicleLabel}` },
    { text: `Dealer: ${input.dealerName}` },
    { text: '' },
    { text: 'Financing terms (snapshot at approval)', bold: true },
    { text: `Financed amount (list): QAR ${input.listPrice.toLocaleString('en-QA')}` },
    { text: `Down payment: QAR ${input.downPayment.toLocaleString('en-QA')}` },
    { text: `Tenure: ${input.tenor} months` },
    { text: `Annual rate: ${input.annualRate}%` },
    { text: `Estimated monthly installment: QAR ${input.monthly.toLocaleString('en-QA')}` },
    { text: '' },
    { text: `Lender of record: ${lender}` },
    { text: '' },
    { text: 'Customer signature: _________________________   Date: __________' },
    { text: '' },
    { text: 'Upload the signed copy of this contract in your Blox application portal.' },
  ];

  let y = 800;
  for (const line of lines) {
    if (line.text === '') {
      y -= 10;
      continue;
    }
    page.drawText(line.text, {
      x: 48,
      y,
      size: line.size ?? 11,
      font: line.bold ? bold : font,
    });
    y -= line.size && line.size > 12 ? 22 : 16;
  }

  return Buffer.from(await doc.save());
}
