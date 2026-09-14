import { roundMoney } from '@drivemarket/shared/pricing';
import { readCustomerSnapshot } from '../customer-snapshot';
import { normalizeContractContext } from './contract-terms';
import type { ContractFieldContext } from './field-maps';
import { BrandedPdfWriter, BRAND, formatPct, formatQar } from './pdf-brand';

function unitsFor(listPrice: number, downPayment: number, tenor: number) {
  const totalUnits = 100;
  const customerOpening = listPrice > 0 ? roundMoney((downPayment / listPrice) * totalUnits) : 0;
  const bloxOpening = roundMoney(Math.max(totalUnits - customerOpening, 0));
  const unitsPerPeriod = tenor > 0 ? roundMoney(bloxOpening / tenor) : 0;
  const unitPrice = totalUnits > 0 ? roundMoney(listPrice / totalUnits) : 0;
  return { totalUnits, customerOpening, bloxOpening, unitsPerPeriod, unitPrice };
}

export async function buildOwnershipSchedulePdf(ctx: ContractFieldContext): Promise<Buffer> {
  const normalized = normalizeContractContext(ctx);
  const snap = readCustomerSnapshot(normalized.customerSnapshot);
  const units = unitsFor(normalized.listPrice, normalized.downPayment, normalized.tenor);
  const customerOpeningPct = normalized.listPrice > 0 ? (normalized.downPayment / normalized.listPrice) * 100 : 0;

  const writer = await BrandedPdfWriter.create({
    title: 'Schedule 2 — Ownership & Rental',
    subtitle: `Agreement ${normalized.referenceNo ?? normalized.applicationId} · ${snap.full_name}`,
    footerTag: 'BLX-TPL-020 · BloX LLC · blox-it.com · Own it, don\'t owe it.',
  });

  writer.paragraph('Schedule of Ownership and Rental', { size: 14, bold: true, color: BRAND.deepGreen, gap: 4 });
  writer.paragraph(
    'Annex to the Diminishing Musharakah Agreement. Each period you purchase ownership units and pay rent on the share still held by BloX.',
    { size: 9, gap: 10 },
  );

  writer.factSheet([
    ['Template', 'BLX-TPL-020'],
    ['Agreement reference', normalized.applicationId],
    ['Customer', snap.full_name],
    ['Asset', `${normalized.vehicle.make} ${normalized.vehicle.model}${normalized.vehicle.vin ? ` · VIN ${normalized.vehicle.vin}` : ''}`],
    ['Total ownership units', String(units.totalUnits)],
    ['Unit price', `QAR ${formatQar(units.unitPrice)}`],
    ['Customer opening units', `${units.customerOpening} (${formatPct(customerOpeningPct)})`],
    ['BloX opening units', `${units.bloxOpening} (${formatPct(100 - customerOpeningPct)})`],
    ['Units per period', String(units.unitsPerPeriod)],
    ['Rental rate', `${normalized.annualRate.toFixed(2)}% p.a.`],
    ['Payment frequency', 'Monthly'],
    ['Number of periods', String(normalized.tenor)],
  ]);

  writer.section('Payment schedule');

  const columns = [
    { label: '#', width: 28 },
    { label: 'Due date', width: 72 },
    { label: 'Units', width: 44 },
    { label: 'Unit cost', width: 68, align: 'right' as const },
    { label: 'Rental', width: 68, align: 'right' as const },
    { label: 'Total', width: 68, align: 'right' as const },
    { label: 'You own', width: 60, align: 'right' as const },
    { label: 'BloX share', width: 107, align: 'right' as const },
  ];

  let cumulativePrincipal = normalized.downPayment;
  const tableRows = normalized.schedule.map((row) => {
    cumulativePrincipal = roundMoney(cumulativePrincipal + row.principal);
    const ownedPct =
      normalized.listPrice > 0 ? formatPct((cumulativePrincipal / normalized.listPrice) * 100) : '';
    return [
      String(row.sequence),
      row.dueDate,
      String(units.unitsPerPeriod),
      formatQar(row.principal),
      formatQar(row.interest),
      formatQar(row.payment),
      ownedPct,
      formatQar(row.balance),
    ];
  });

  const totalUnitsBought = roundMoney(units.unitsPerPeriod * normalized.schedule.length);
  const totalUnitCost = normalized.schedule.reduce((sum, row) => sum + row.principal, 0);
  const totalRent = normalized.schedule.reduce((sum, row) => sum + row.interest, 0);
  const totalPayments = normalized.schedule.reduce((sum, row) => sum + row.payment, 0);
  tableRows.push([
    'Total',
    '',
    String(totalUnitsBought),
    formatQar(totalUnitCost),
    formatQar(totalRent),
    formatQar(totalPayments),
    '100.00%',
    formatQar(0),
  ]);

  writer.table(columns, tableRows, { repeatHeader: true, fontSize: 7.5 });

  writer.section('Notes for the customer');
  writer.line('Each unit purchase is a separate ownership transaction under the Musharakah Agreement.', 9);
  writer.line('Late payments are handled under the Shariah policy — BloX does not earn from delay.', 9);
  writer.line('Request an updated schedule statement from BloX at any time.', 9);

  writer.section('Signatures');
  writer.signatureBlock('The Customer', 'For BloX LLC');

  return writer.toBuffer();
}
