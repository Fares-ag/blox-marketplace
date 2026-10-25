import { roundMoney } from '@drivemarket/shared/pricing';
import { readCustomerSnapshot } from '../customer-snapshot';
import { normalizeContractContext } from './contract-terms';
import type { ContractFieldContext } from './field-maps';
import { BrandedPdfWriter, BRAND, formatQar } from './pdf-brand';

export async function buildAmortizationSchedulePdf(ctx: ContractFieldContext): Promise<Buffer> {
  const normalized = normalizeContractContext(ctx);
  const snap = readCustomerSnapshot(normalized.customerSnapshot);
  const amountFinanced = roundMoney(Math.max(normalized.listPrice - normalized.downPayment, 0));
  const totalInterest = normalized.schedule.reduce((sum, row) => sum + row.interest, 0);
  const totalPayments = normalized.schedule.reduce((sum, row) => sum + row.payment, 0);
  const totalPrincipal = normalized.schedule.reduce((sum, row) => sum + row.principal, 0);
  const balloonAmount = roundMoney(Number(normalized.pricing.balloon ?? 0));
  const hasBalloon = balloonAmount > 0;

  const writer = await BrandedPdfWriter.create({
    title: 'Amortization Schedule',
    subtitle: `Agreement ${normalized.referenceNo ?? normalized.applicationId} · ${snap.full_name}`,
    footerTag: 'BLX-TPL-031 · Conventional in-house finance · blox-it.com',
  });

  writer.paragraph('Amortization schedule', { size: 14, bold: true, color: BRAND.deepGreen, gap: 4 });
  writer.paragraph(
    'Annex to the Sale Credit Agreement. Each installment is principal plus interest on the outstanding balance. Title remains with the lender until the loan is repaid.',
    { size: 9, gap: 10 },
  );

  writer.factSheet([
    ['Template', 'BLX-TPL-031'],
    ['Agreement reference', normalized.referenceNo ?? normalized.applicationId],
    ['Customer', snap.full_name],
    [
      'Asset',
      `${normalized.vehicle.make} ${normalized.vehicle.model}${normalized.vehicle.vin ? ` · VIN ${normalized.vehicle.vin}` : ''}`,
    ],
    ['Amount financed', `QAR ${formatQar(amountFinanced)}`],
    ['Annual interest rate', `${normalized.annualRate.toFixed(2)}%`],
    ['Payment frequency', 'Monthly'],
    [
      'Number of periods',
      hasBalloon
        ? `${normalized.tenor} monthly + 1 balloon (${normalized.schedule.length} lines)`
        : String(normalized.tenor),
    ],
    ...(hasBalloon
      ? [['Final balloon (principal)', `QAR ${formatQar(balloonAmount)}`] as [string, string]]
      : []),
  ]);

  writer.section('Payment schedule');

  const columns = [
    { label: '#', width: 28 },
    { label: 'Due date', width: 80 },
    { label: 'Payment', width: 78, align: 'right' as const },
    { label: 'Principal', width: 78, align: 'right' as const },
    { label: 'Interest', width: 78, align: 'right' as const },
    { label: 'Balance', width: 173, align: 'right' as const },
  ];

  const tableRows = normalized.schedule.map((row) => [
    String(row.sequence),
    row.dueDate,
    formatQar(row.payment),
    formatQar(row.principal),
    formatQar(row.interest),
    formatQar(row.balance),
  ]);
  tableRows.push([
    'Total',
    '',
    formatQar(totalPayments),
    formatQar(totalPrincipal),
    formatQar(totalInterest),
    formatQar(0),
  ]);

  writer.table(columns, tableRows, { repeatHeader: true, fontSize: 8 });

  writer.section('Notes');
  writer.line('Interest is calculated on the outstanding principal. Nothing compounds beyond the stated annual rate.', 9);
  writer.line('Early settlement is the outstanding principal plus interest accrued to the settlement date.', 9);
  writer.line('Request an updated statement from the lender at any time.', 9);

  writer.section('Signatures');
  writer.signatureBlock('The Customer', `For ${normalized.lenderName}`);

  return writer.toBuffer();
}
