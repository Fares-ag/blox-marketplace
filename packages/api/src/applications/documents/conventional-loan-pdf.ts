import { roundMoney } from '@drivemarket/shared/pricing';
import { readCustomerSnapshot } from '../customer-snapshot';
import { CONVENTIONAL_INTEREST_DISCLOSURES } from '../contract-disclosures';
import { normalizeContractContext } from './contract-terms';
import type { ContractFieldContext } from './field-maps';
import { BrandedPdfWriter, BRAND, formatQar } from './pdf-brand';

export async function buildConventionalLoanAgreementPdf(ctx: ContractFieldContext): Promise<Buffer> {
  const normalized = normalizeContractContext(ctx);
  const snap = readCustomerSnapshot(normalized.customerSnapshot);
  const amountFinanced = roundMoney(Math.max(normalized.listPrice - normalized.downPayment, 0));
  const totalPayable = roundMoney(normalized.downPayment + normalized.financedTotal);
  const totalInterest = roundMoney(Math.max(normalized.financedTotal - amountFinanced, 0));
  const approvedDate = normalized.approvedAt.toISOString().slice(0, 10);

  const writer = await BrandedPdfWriter.create({
    title: 'Sale Credit Agreement',
    subtitle: `Agreement ${normalized.referenceNo ?? normalized.applicationId} · ${snap.full_name}`,
    footerTag: 'BLX-TPL-030 · Conventional in-house finance · blox-it.com',
  });

  writer.paragraph('Sale Credit Agreement (conventional in-house finance)', {
    size: 14,
    bold: true,
    color: BRAND.deepGreen,
    gap: 4,
  });
  writer.paragraph(
    'This is an interest-bearing credit sale. It is not a Musharakah or Ijarah arrangement and does not create co-ownership of the vehicle.',
    { size: 9, gap: 10 },
  );

  writer.factSheet([
    ['Template', 'BLX-TPL-030'],
    ['Agreement reference', normalized.referenceNo ?? normalized.applicationId],
    ['Execution date', approvedDate],
    ['Lender', normalized.lenderName],
    ['Customer', snap.full_name || 'Customer'],
    ['QID', snap.qid || '—'],
    ['Email / phone', [normalized.customerEmail || snap.email, snap.phone].filter(Boolean).join(' / ') || '—'],
    ['Dealer', normalized.dealerName],
    [
      'Vehicle',
      `${normalized.vehicle.make} ${normalized.vehicle.model}${normalized.vehicle.vin ? ` · VIN ${normalized.vehicle.vin}` : ''}`,
    ],
    ['Cash price', `QAR ${formatQar(normalized.listPrice)}`],
    ['Down payment', `QAR ${formatQar(normalized.downPayment)} (${normalized.downPaymentPct.toFixed(2)}%)`],
    ['Amount financed', `QAR ${formatQar(amountFinanced)}`],
    ['Annual interest rate', `${normalized.annualRate.toFixed(2)}%`],
    ['Tenure', `${normalized.tenor} months`],
    ['Monthly installment', `QAR ${formatQar(normalized.monthly)}`],
    ['Total installments', `QAR ${formatQar(normalized.financedTotal)}`],
    ['Total interest payable', `QAR ${formatQar(totalInterest)}`],
    ['Total amount payable', `QAR ${formatQar(totalPayable)}`],
  ]);

  writer.section('Disclosures');
  for (const paragraph of CONVENTIONAL_INTEREST_DISCLOSURES) {
    writer.paragraph(paragraph, { size: 9, gap: 8 });
  }

  writer.section('Signatures');
  writer.signatureBlock('The Customer', `For ${normalized.lenderName}`);

  return writer.toBuffer();
}
