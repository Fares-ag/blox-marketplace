import { roundMoney } from '@drivemarket/shared/pricing';
import { NO_LATE_CHARGES_LINE } from '../contract-disclosures';
import { readCustomerSnapshot } from '../customer-snapshot';
import { commonDealFields } from './field-maps';
import type { ContractFieldContext } from './field-maps';
import { normalizeContractContext } from './contract-terms';
import { BrandedPdfWriter, formatPct, formatQar } from './pdf-brand';

function unitsFor(listPrice: number, downPayment: number, tenor: number) {
  const totalUnits = 100;
  const customerOpening = listPrice > 0 ? roundMoney((downPayment / listPrice) * totalUnits) : 0;
  const bloxOpening = roundMoney(Math.max(totalUnits - customerOpening, 0));
  const unitsPerPeriod = tenor > 0 ? roundMoney(bloxOpening / tenor) : 0;
  const unitPrice = totalUnits > 0 ? roundMoney(listPrice / totalUnits) : 0;
  return { totalUnits, customerOpening, bloxOpening, unitsPerPeriod, unitPrice };
}

async function buildAgreementPdf(
  ctx: ContractFieldContext,
  config: { title: string; templateCode: string; productLabel: string },
): Promise<Buffer> {
  const normalized = normalizeContractContext(ctx);
  const snap = readCustomerSnapshot(normalized.customerSnapshot);
  const fields = commonDealFields(normalized);
  const units = unitsFor(normalized.listPrice, normalized.downPayment, normalized.tenor);
  const amountFinanced = roundMoney(Math.max(normalized.listPrice - normalized.downPayment, 0));
  const totalRent = normalized.schedule.reduce((sum, row) => sum + row.interest, 0);
  const totalPayable = roundMoney(normalized.downPayment + normalized.financedTotal);
  const approvedDate = normalized.approvedAt.toISOString().slice(0, 10);

  const writer = await BrandedPdfWriter.create({
    title: config.title,
    subtitle: `Agreement ${normalized.applicationId} · ${config.productLabel}`,
    footerTag: `${config.templateCode} · BloX LLC · blox-it.com · Own it, don't owe it.`,
  });

  writer.metaGrid([
    ['Template', config.templateCode],
    ['Agreement reference', normalized.applicationId],
    ['Execution date', approvedDate],
    ['Lender of record', normalized.lenderName],
    ['Status', 'Final'],
  ]);

  writer.section('1. Parties');
  writer.keyValue('Customer', snap.full_name);
  writer.keyValue('QID', snap.qid);
  writer.keyValue('National address', fields['Customer.NationalAddress']);
  writer.keyValue('Phone / email', fields['Customer.PhoneEmail']);
  writer.keyValue('Dealer', normalized.dealerName);
  writer.keyValue('BloX registered address', normalized.lenderAddress);

  writer.section('2. Financed asset');
  writer.keyValue('Vehicle', `${normalized.vehicle.make} ${normalized.vehicle.model}${normalized.vehicle.year ? ` ${normalized.vehicle.year}` : ''}`);
  writer.keyValue('VIN', normalized.vehicle.vin ?? undefined);
  writer.keyValue('Chassis', normalized.vehicle.chassisNumber ?? undefined);
  writer.keyValue('Engine no.', normalized.vehicle.engineNumber ?? undefined);
  writer.keyValue('Condition', normalized.vehicle.condition ?? undefined);
  writer.keyValue('Cash price (list)', `QAR ${formatQar(normalized.listPrice)}`);

  writer.section('3. Co-ownership structure (100 units)');
  writer.keyValue('Total ownership units', String(units.totalUnits));
  writer.keyValue('Unit price', `QAR ${formatQar(units.unitPrice)}`);
  writer.keyValue('Customer opening units', `${units.customerOpening} (${fields['Ownership.CustomerOpeningPct']})`);
  writer.keyValue('BloX opening units', `${units.bloxOpening} (${fields['Ownership.BloXOpeningPct']})`);
  writer.keyValue('Units purchased per period', String(units.unitsPerPeriod));

  writer.section('4. Financing summary (locked at approval)');
  writer.keyValue('Customer contribution (down payment)', `QAR ${formatQar(normalized.downPayment)} (${formatPct(normalized.downPaymentPct)})`);
  writer.keyValue('Amount financed (co-owner share purchased over term)', `QAR ${formatQar(amountFinanced)}`);
  writer.keyValue('Annual rental rate', `${normalized.annualRate.toFixed(2)}% per annum on BloX remaining share`);
  writer.keyValue('Payment frequency', 'Monthly');
  writer.keyValue('Number of periods', String(normalized.tenor));
  writer.keyValue('Periodic payment (principal + rent)', `QAR ${formatQar(normalized.monthly)}`);
  writer.keyValue('Total installments payable', `QAR ${formatQar(normalized.financedTotal)}`);
  writer.keyValue('Total rent payable', `QAR ${formatQar(roundMoney(totalRent))}`);
  writer.keyValue('Total amount payable', `QAR ${formatQar(totalPayable)}`);

  writer.section('5. Product terms');
  writer.line(fields['Classification.RenderedRulesEN'] ?? '', 9);
  writer.keyValue('Takaful operator', fields['Takaful.Operator']);
  writer.keyValue('Takaful borne by', fields['Takaful.BorneBy']);
  writer.keyValue('Sharia asset classification', fields['Sharia.AssetPermissible']);
  if (config.productLabel.includes('Ijarah')) {
    writer.keyValue('Abatement days', fields['Ijarah.AbatementDays']);
    writer.keyValue('Incident notice days', fields['Ijarah.IncidentNoticeDays']);
    writer.keyValue('Inspections per year', fields['Ijarah.InspectionsPerYear']);
    writer.keyValue('Max days abroad', fields['Ijarah.MaxDaysAbroad']);
  }
  writer.line('The detailed ownership and rental schedule is set out in Schedule 2 (Ownership & Rental Schedule) attached to this agreement.', 9);

  writer.section('6. Customer disclosures');
  writer.line(
    'This agreement is a Diminishing Musharakah (declining co-ownership) arrangement. Each installment combines principal (ownership units transferred to you) and rent (profit on the share still held by BloX). As your share grows, the rent component falls.',
    9,
  );
  writer.line(NO_LATE_CHARGES_LINE, 9);
  writer.line(
    'Early settlement is available: you pay the principal outstanding plus rent accrued to the settlement date. Request a full payment schedule and account statement at any time.',
    9,
  );

  writer.section('7. Signatures');
  writer.signatureBlock('The Customer', `For ${normalized.lenderName}`);

  return writer.toBuffer();
}

export function buildMusharakahAgreementPdf(ctx: ContractFieldContext): Promise<Buffer> {
  return buildAgreementPdf(ctx, {
    title: 'Diminishing Musharakah Agreement',
    templateCode: 'BLX-TPL-MUSH-V2',
    productLabel: 'Diminishing Musharakah + Ijarah',
  });
}

export function buildIjarahAgreementPdf(ctx: ContractFieldContext): Promise<Buffer> {
  return buildAgreementPdf(ctx, {
    title: 'Ijarah Agreement',
    templateCode: 'BLX-TPL-011',
    productLabel: 'Ijarah',
  });
}
