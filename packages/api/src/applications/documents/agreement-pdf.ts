import { roundMoney } from '@drivemarket/shared/pricing';
import { readCustomerSnapshot } from '../customer-snapshot';
import { commonDealFields } from './field-maps';
import type { ContractFieldContext } from './field-maps';
import { normalizeContractContext } from './contract-terms';
import { buildIjarahClauses, type IjarahBind } from './ijarah-agreement-clauses';
import {
  buildMusharakahClauses,
  MUSHARAKAH_TOC,
  type MusharakahBind,
} from './musharakah-agreement-clauses';
import { BrandedPdfWriter, formatQar } from './pdf-brand';

function unitsFor(listPrice: number, downPayment: number, tenor: number) {
  const totalUnits = 100;
  const customerOpening = listPrice > 0 ? roundMoney((downPayment / listPrice) * totalUnits) : 0;
  const bloxOpening = roundMoney(Math.max(totalUnits - customerOpening, 0));
  const unitPrice = totalUnits > 0 ? roundMoney(listPrice / totalUnits) : 0;
  return { bloxOpening, unitPrice };
}

function musharakahBind(ctx: ContractFieldContext, fields: Record<string, string>): MusharakahBind {
  const snap = readCustomerSnapshot(ctx.customerSnapshot);
  const units = unitsFor(ctx.listPrice, ctx.downPayment, ctx.tenor);
  const amountFinanced = roundMoney(Math.max(ctx.listPrice - ctx.downPayment, 0));
  const approvedDate = ctx.approvedAt.toISOString().slice(0, 10);

  return {
    contractNo: ctx.referenceNo ?? ctx.applicationId,
    executionDate: approvedDate,
    customerName: snap.full_name || 'Customer',
    customerQid: snap.qid || '—',
    customerAddress: fields['Customer.NationalAddress'] || '—',
    customerPhoneEmail: fields['Customer.PhoneEmail'] || ctx.customerEmail || '—',
    bloxAddress: ctx.lenderAddress,
    signatoryName: ctx.signatoryName,
    signatoryTitle: ctx.signatoryTitle,
    vehicleType: fields['Vehicle.Type'] || 'Motor vehicle',
    vehicleMakeModel: `${ctx.vehicle.make} ${ctx.vehicle.model}`.trim(),
    vehicleYear: ctx.vehicle.year != null ? String(ctx.vehicle.year) : '—',
    chassisNo: ctx.vehicle.chassisNumber ?? ctx.vehicle.vin ?? '—',
    engineNo: ctx.vehicle.engineNumber ?? '—',
    plateNo: fields['Vehicle.Plate'] || '—',
    totalPrice: formatQar(ctx.listPrice),
    bloxContribution: formatQar(amountFinanced),
    bloxPct: fields['Ownership.BloXOpeningPct'],
    customerContribution: formatQar(ctx.downPayment),
    customerPct: fields['Ownership.CustomerOpeningPct'],
    numberOfUnits: String(units.bloxOpening),
    unitValue: formatQar(units.unitPrice),
    annualRate: `${ctx.annualRate.toFixed(2)}% per annum`,
    tenor: String(ctx.tenor),
    rentDefaultDays: '30',
    defaultNoticeDays: '30',
    saleProcureDays: '30',
    disputeDays: '30',
    forceMajeureNoticeDays: '7',
    forceMajeureMaxDays: '90',
    latePaymentDaily: '50',
  };
}

export async function buildMusharakahAgreementPdf(ctx: ContractFieldContext): Promise<Buffer> {
  const normalized = normalizeContractContext(ctx);
  const fields = commonDealFields(normalized);
  const bind = musharakahBind(normalized, fields);
  const clauses = buildMusharakahClauses(bind);
  const snap = readCustomerSnapshot(normalized.customerSnapshot);

  const writer = await BrandedPdfWriter.create({
    title: 'Diminishing Musharakah Agreement',
    subtitle: `Contract ${bind.contractNo}`,
    footerTag: 'BLX-TPL-MUSH-V2 · BloX LLC · QFC No. 03403 · blox-it.com',
    arabic: true,
  });

  writer.contractCover({
    titleEn: 'Diminishing Musharakah Agreement',
    titleAr: 'عقد المشاركة المتناقصة',
    subtitleEn: 'Joint Ownership & Diminishing Musharakah (Shirkat Al-Milk) Structure',
    subtitleAr: 'هيكل الملكية المشتركة والمشاركة المتناقصة (شركة الملك)',
    contractNo: bind.contractNo,
    executionDate: bind.executionDate,
    draft: false,
  });

  writer.tableOfContents(MUSHARAKAH_TOC);

  for (const clause of clauses) {
    if (clause.number === '22') continue;
    writer.clause(clause.number, clause.titleEn, clause.titleAr, clause.bodyEn, clause.bodyAr);
  }

  const signatures = clauses.find((c) => c.number === '22');
  if (signatures) {
    writer.clause(signatures.number, signatures.titleEn, signatures.titleAr, signatures.bodyEn, signatures.bodyAr);
    writer.bilingualSignatureBlock(snap.full_name || bind.customerName, bind.signatoryName, bind.signatoryTitle);
  }

  writer.paragraph(
    'Schedule 2 (Ownership & Rental Schedule) is attached and forms an integral part of this Agreement.',
    { size: 8 },
  );
  writer.paragraphAr('يُرفق الجدول 2 (جدول الملكية والإيجار) ويُعدّ جزءاً لا يتجزأ من هذا العقد.', { size: 8 });

  return writer.toBuffer();
}

function ijarahBind(ctx: ContractFieldContext, fields: Record<string, string>): IjarahBind {
  const snap = readCustomerSnapshot(ctx.customerSnapshot);
  const guarantor = snap.guarantor && typeof snap.guarantor === 'object' ? snap.guarantor : null;
  const approvedDate = ctx.approvedAt.toISOString().slice(0, 10);
  const coName = guarantor && typeof guarantor.fullName === 'string' ? guarantor.fullName.trim() : '';
  const coQid = guarantor && typeof guarantor.qid === 'string' ? guarantor.qid.trim() : '';

  return {
    dealRef: fields['Deal.Ref'] || ctx.applicationId,
    executionDate: fields['Deal.ExecutionDate'] || approvedDate,
    commencementDate: fields['Deal.CommencementDate'] || approvedDate,
    rentalRate: fields['Deal.RentalRate'] || `${ctx.annualRate.toFixed(2)}% per annum`,
    paymentFrequency: fields['Deal.PaymentFrequency'] || 'Monthly',
    dueDayDescription:
      fields['Deal.DueDayDescription'] || 'the same calendar day of each month as the commencement date',
    customerNameEn: fields['Customer.FullNameEN'] || snap.full_name || 'Customer',
    customerNameAr: fields['Customer.FullNameAR'] || snap.full_name || 'Customer',
    customerQid: fields['Customer.QID'] || snap.qid || '—',
    customerAddress: fields['Customer.NationalAddress'] || '—',
    coApplicantName: coName || fields['CoApplicant.FullNameEN'] || 'Not applicable',
    coApplicantQid: coQid || fields['CoApplicant.QID'] || '—',
    bloxAddress: fields['BloX.RegisteredAddress'] || ctx.lenderAddress,
    signatoryName: fields['BloX.SignatoryName'] || ctx.signatoryName,
    maxDaysAbroad: fields['Ijarah.MaxDaysAbroad'] || '90',
    incidentNoticeDays: fields['Ijarah.IncidentNoticeDays'] || '5',
    inspectionsPerYear: fields['Ijarah.InspectionsPerYear'] || '2',
    abatementDays: fields['Ijarah.AbatementDays'] || '15',
  };
}

/** Full bilingual Ijarah Agreement (BLX-TPL-011) — separate from the Musharakah Agreement. */
export async function buildIjarahAgreementPdf(ctx: ContractFieldContext): Promise<Buffer> {
  const normalized = normalizeContractContext(ctx);
  const fields = commonDealFields(normalized);
  const bind = ijarahBind(normalized, fields);
  const clauses = buildIjarahClauses(bind);

  const writer = await BrandedPdfWriter.create({
    title: 'Ijarah Agreement',
    subtitle: `Agreement ${bind.dealRef}`,
    footerTag: 'BLX-TPL-011 v1.1 · BloX LLC · QFC No. 03403 · blox-it.com',
    arabic: true,
  });

  writer.contractCover({
    titleEn: 'Ijarah Agreement',
    titleAr: 'اتفاقية الإجارة',
    subtitleEn: "Rental of BloX's ownership share in the Asset",
    subtitleAr: 'إجارة حصة بلوكس في ملكية الأصل',
    contractNo: bind.dealRef,
    executionDate: bind.executionDate,
    draft: false,
  });

  writer.metaStrip([
    ['TEMPLATE ID', 'BLX-TPL-011', 'VERSION', '1.1'],
    ['OWNER', 'BloX Legal', 'STATUS', 'Draft for M2P implementation'],
  ]);
  writer.paragraph(
    'SIGN-OFF GATE: Qatari counsel · Sharia Supervisory Board (Amanah Advisors) · AAOIFI standard citations to be confirmed',
    { size: 7.5, gap: 10 },
  );

  writer.noticeBox(
    'Language and Sharia',
    'اللغة والأحكام الشرعية',
    'This agreement is executed in Arabic and English. In the event of any conflict the Arabic text prevails. This agreement is subject to the rulings of the BloX Sharia Supervisory Board; where any provision is found to conflict with those rulings, that provision is to be read and applied in the manner the Board directs.',
    'حررت هذه الاتفاقية باللغتين العربية والإنجليزية، وعند التعارض يعتد بالنص العربي. وتخضع هذه الاتفاقية لقرارات هيئة الرقابة الشرعية لدى بلوكس، وإذا تبين تعارض أي حكم مع تلك القرارات فيفسر ذلك الحكم ويطبق على النحو الذي تقرره الهيئة.',
  );

  writer.definitionGrid([
    [
      { en: 'Agreement reference', ar: 'رقم الاتفاقية', value: bind.dealRef },
      { en: 'Date', ar: 'التاريخ', value: bind.executionDate },
    ],
    [
      {
        en: 'First Party',
        ar: 'الطرف الأول',
        value: `BloX LLC, QFC No. 03403, ${bind.bloxAddress} ("BloX")`,
      },
      {
        en: 'Second Party',
        ar: 'الطرف الثاني',
        value: `${bind.customerNameEn} · ${bind.customerNameAr} · QID ${bind.customerQid} · ${bind.customerAddress} ("the Customer")`,
      },
    ],
    [
      {
        en: 'Co-owner party',
        ar: 'الطرف المشارك',
        value: `${bind.coApplicantName} · QID ${bind.coApplicantQid}`,
      },
    ],
  ]);

  writer.section('Operative Provisions', 'الأحكام');
  for (const clause of clauses) {
    writer.clause(clause.number, clause.titleEn, clause.titleAr, clause.bodyEn, clause.bodyAr);
  }

  writer.contractSignatureBlock({
    leftHeadingEn: 'For BloX LLC',
    leftHeadingAr: 'عن بلوكس ذ.م.م',
    leftName: bind.signatoryName,
    rightHeadingEn: 'The Customer',
    rightHeadingAr: 'العميل',
    rightName: bind.customerNameEn,
  });

  writer.paragraph(
    'Schedule 2 (Schedule of Ownership and Rental) is attached and forms an integral part of this Agreement.',
    { size: 8 },
  );
  writer.paragraphAr('يُرفق الجدول 2 (جدول الملكية والأجرة) ويُعدّ جزءاً لا يتجزأ من هذه الاتفاقية.', { size: 8 });

  return writer.toBuffer();
}
