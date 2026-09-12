import { parseQid } from '@drivemarket/shared/domain-rules';
import { roundMoney } from '@drivemarket/shared/pricing';
import type { KycCaseDetail } from '../../kyc/kyc-platform.client';
import { buildKycVerificationSummary } from '../../kyc/kyc-verification-summary';
import type { ContractScheduleRow } from '../contract-pdf';
import { birthYearOf, readCustomerSnapshot } from '../customer-snapshot';
import { monthlyIncomeOf, monthlyLiabilitiesOf, type AssessedApplicationCredit } from '../credit-assessment';

export type ContractFieldContext = {
  applicationId: string;
  approvedAt: Date;
  lenderName: string;
  lenderAddress: string;
  signatoryName: string;
  signatoryTitle: string;
  customerEmail: string;
  customerSnapshot: unknown;
  pricing: Record<string, unknown>;
  vehicle: {
    make: string;
    model: string;
    year: number | null;
    trim?: string | null;
    color?: string | null;
    vin?: string | null;
    chassisNumber?: string | null;
    engineNumber?: string | null;
    condition?: string | null;
    bodyType?: string | null;
  };
  dealerName: string;
  listPrice: number;
  downPayment: number;
  downPaymentPct: number;
  monthly: number;
  tenor: number;
  annualRate: number;
  financedTotal: number;
  schedule: ContractScheduleRow[];
  credit?: AssessedApplicationCredit;
  approverName?: string;
  approverRole?: string;
  overrideReason?: string | null;
  kyc?: KycCaseDetail | null;
  kycStatus?: string | null;
};

function money(amount: number): string {
  return roundMoney(amount).toLocaleString('en-QA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function pct(value: number): string {
  return `${roundMoney(value).toFixed(2)}%`;
}

function iso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function str(value: unknown): string {
  if (value == null) return '';
  const text = String(value).trim();
  return text;
}

function addressOf(snapshot: ReturnType<typeof readCustomerSnapshot>): string {
  const address = snapshot.address;
  if (address && typeof address === 'object' && !Array.isArray(address)) {
    const parts = ['line1', 'line2', 'street', 'city', 'zone', 'country']
      .map((key) => str((address as Record<string, unknown>)[key]))
      .filter(Boolean);
    if (parts.length) return parts.join(', ');
  }
  return [str(snapshot.city), 'Qatar'].filter(Boolean).join(', ');
}

function employmentOf(snapshot: ReturnType<typeof readCustomerSnapshot>) {
  const employment = snapshot.employment;
  if (employment && typeof employment === 'object' && !Array.isArray(employment)) {
    return employment;
  }
  return {};
}

function unitsFor(listPrice: number, downPayment: number, tenor: number) {
  const totalUnits = 100;
  const customerOpening = listPrice > 0 ? roundMoney((downPayment / listPrice) * totalUnits) : 0;
  const bloxOpening = roundMoney(Math.max(totalUnits - customerOpening, 0));
  const unitsPerPeriod = tenor > 0 ? roundMoney(bloxOpening / tenor) : 0;
  const unitPrice = totalUnits > 0 ? roundMoney(listPrice / totalUnits) : 0;
  return { totalUnits, customerOpening, bloxOpening, unitsPerPeriod, unitPrice };
}

function ageOf(snapshot: ReturnType<typeof readCustomerSnapshot>, approvedAt: Date): string {
  const year = birthYearOf(snapshot);
  if (!year) return '';
  return String(approvedAt.getUTCFullYear() - year);
}

export function commonDealFields(ctx: ContractFieldContext): Record<string, string> {
  const snap = readCustomerSnapshot(ctx.customerSnapshot);
  const amountFinanced = roundMoney(Math.max(ctx.listPrice - ctx.downPayment, 0));
  const totalPayable = roundMoney(ctx.downPayment + ctx.financedTotal);
  const totalRent = roundMoney(Math.max(ctx.financedTotal - amountFinanced, 0));
  const units = unitsFor(ctx.listPrice, ctx.downPayment, ctx.tenor);
  const customerOpeningPct = ctx.listPrice > 0 ? (ctx.downPayment / ctx.listPrice) * 100 : 0;
  const bloxOpeningPct = Math.max(100 - customerOpeningPct, 0);
  const guarantor = snap.guarantor && typeof snap.guarantor === 'object' ? snap.guarantor : {};
  const employment = employmentOf(snap);
  const qid = parseQid(snap.qid);

  return {
    'Application.Number': ctx.applicationId,
    'Deal.Ref': ctx.applicationId,
    'Deal.ExecutionDate': iso(ctx.approvedAt),
    'Deal.CommencementDate': iso(ctx.approvedAt),
    'Deal.PaymentFrequency': 'Monthly',
    'Deal.DueDayDescription': 'the same calendar day of each month as the commencement date',
    'Deal.RentalRate': `${ctx.annualRate.toFixed(2)}% per annum`,
    'Deal.RentalBasis': 'annual rental rate on BloX remaining share',
    'Deal.PeriodicPayment': money(ctx.monthly),
    'Deal.NumberOfPayments': String(ctx.tenor),
    'Deal.TotalUnits': String(units.totalUnits),
    'Deal.UnitPrice': money(units.unitPrice),
    'Deal.UnitPriceBasis': 'cash price of the asset divided by 100 units',
    'Deal.CustomerOpeningUnits': String(units.customerOpening),
    'Deal.BloXOpeningUnits': String(units.bloxOpening),
    'Deal.UnitsPerPeriod': String(units.unitsPerPeriod),
    'Deal.TotalPayable': money(totalPayable),
    'Deal.TotalRent': money(totalRent),
    'Deal.TotalUnitPrice': money(amountFinanced),
    'Offer.TermMonths': String(ctx.tenor),
    'Ownership.CustomerOpeningPct': pct(customerOpeningPct),
    'Ownership.BloXOpeningPct': pct(bloxOpeningPct),
    'Price.TotalCost': money(ctx.listPrice),
    'Price.CustomerContribution': money(ctx.downPayment),
    'Price.BloXContribution': money(amountFinanced),
    'Customer.FullNameEN': snap.full_name,
    'Customer.FullNameAR': snap.full_name,
    'Customer.QID': snap.qid,
    'Customer.NationalAddress': addressOf(snap),
    'Customer.PhoneEmail': [snap.phone, ctx.customerEmail || str(snap.email)].filter(Boolean).join(' / '),
    'Customer.Nationality': str(snap.nationality) || (qid.valid && qid.residency === 'qatari' ? 'Qatari' : ''),
    'Customer.ResidencyStatus': str(snap.residency),
    'Customer.YearsInQatar': str(snap.residenceDuration),
    'Customer.HousingStatus': '',
    'Customer.Age': ageOf(snap, ctx.approvedAt),
    'CoApplicant.FullNameEN': str(guarantor.fullName),
    'CoApplicant.QID': str(guarantor.qid),
    'Vehicle.Make': ctx.vehicle.make,
    'Vehicle.Model': ctx.vehicle.model,
    'Vehicle.Year': ctx.vehicle.year != null ? String(ctx.vehicle.year) : '',
    'Vehicle.MakeModel': `${ctx.vehicle.make} ${ctx.vehicle.model}`.trim(),
    'Vehicle.VIN': str(ctx.vehicle.vin),
    'Vehicle.Chassis': str(ctx.vehicle.chassisNumber),
    'Vehicle.EngineNo': str(ctx.vehicle.engineNumber),
    'Vehicle.Plate': '',
    'Vehicle.Type': str(ctx.vehicle.bodyType) || 'Motor vehicle',
    'Vehicle.Condition': str(ctx.vehicle.condition),
    'Vehicle.ValuationAmount': money(ctx.listPrice),
    'Vehicle.ValuationSource': 'Dealer list price locked at approval',
    'Product.Type': 'Diminishing Musharakah + Ijarah',
    'Product.Condition': str(ctx.vehicle.condition) || 'New',
    'BloX.RegisteredAddress': ctx.lenderAddress,
    'BloX.SignatoryName': ctx.signatoryName,
    'BloX.SignatoryTitle': ctx.signatoryTitle,
    'Ijarah.AbatementDays': '15',
    'Ijarah.IncidentNoticeDays': '5',
    'Ijarah.InspectionsPerYear': '2',
    'Ijarah.MaxDaysAbroad': '90',
    'Classification.RenderedRulesEN':
      'Each period the customer buys ownership units and pays rent on the share still held by BloX. Customer ownership must rise every period.',
    'Classification.RenderedRulesAR':
      'في كل فترة يشتري العميل وحدات ملكية ويدفع أجرة عن الحصة التي ما زالت بلوكس تملكها. ويجب أن ترتفع نسبة ملكية العميل في كل فترة.',
    'Employment.EmployerName': str(employment.company),
    'Employment.ContractType': str(employment.employmentType),
    'Employment.EmployerCategory': str(employment.employmentType),
    'Employment.ServiceYears': str(employment.employmentDuration),
    'Employment.TotalExperienceYears': str(employment.employmentDuration),
    'Takaful.Operator': 'To be declared at signing',
    'Takaful.BorneBy': 'Customer',
    'Sharia.AssetPermissible': 'Yes — passenger motor vehicle',
    'Sharia.SSBApprovalRef': 'BloX SSB — Diminishing Musharakah + Ijarah',
  };
}

export function scheduleRowFields(ctx: ContractFieldContext): Record<string, string> {
  const fields: Record<string, string> = {};
  const units = unitsFor(ctx.listPrice, ctx.downPayment, ctx.tenor);
  const first = ctx.schedule[0];
  const last = ctx.schedule[ctx.schedule.length - 1];
  const write = (prefix: string, row: ContractScheduleRow | undefined, index: number) => {
    if (!row) return;
    const bought = units.unitsPerPeriod;
    const customerPct =
      ctx.listPrice > 0
        ? pct(((ctx.downPayment + row.principal * index) / ctx.listPrice) * 100)
        : '';
    fields[`${prefix}.DueDate`] = row.dueDate;
    fields[`${prefix}.Units`] = String(bought);
    fields[`${prefix}.UnitCost`] = money(row.principal);
    fields[`${prefix}.Rental`] = money(row.interest);
    fields[`${prefix}.Total`] = money(row.payment);
    fields[`${prefix}.CustomerPct`] = customerPct;
    fields[`${prefix}.BloXValue`] = money(row.balance);
  };
  write('Sch.1', first, 1);
  write('Sch.n', last, ctx.schedule.length);
  ctx.schedule.forEach((row, index) => write(`Sch.${index + 1}`, row, index + 1));
  return fields;
}

export function camFields(ctx: ContractFieldContext): Record<string, string> {
  const snap = readCustomerSnapshot(ctx.customerSnapshot);
  const income = monthlyIncomeOf(snap);
  const liabilities = monthlyLiabilitiesOf(snap);
  const assessed = ctx.credit?.assessment;
  const affordability = assessed?.affordability;
  const dbr = affordability?.dbr != null ? `${Math.round(affordability.dbr * 100)}%` : '';
  const ltv = ctx.listPrice > 0 ? pct(((ctx.listPrice - ctx.downPayment) / ctx.listPrice) * 100) : '';
  const residual =
    income != null ? money(Math.max(income - liabilities - ctx.monthly, 0)) : '';
  const path = assessed?.path ?? '';
  const outcome = path.includes('decline') || path.includes('reject') ? 'Decline' : 'Approve';
  const kyc = ctx.kyc ? buildKycVerificationSummary(ctx.kyc, ctx.kycStatus ?? null) : null;
  const identity = ctx.kyc?.extracted_identity ?? [];
  const identityValue = (name: string) =>
    identity.find((field) => field.name === name || field.label.toLowerCase().includes(name))?.value ?? '';

  const screen = {
    'Screen.eKYCTool': kyc?.provider === 'didit' ? 'blox-kyc-module · Didit eKYC' : 'blox-kyc-module',
    'Screen.eKYCDate': kyc?.didit_verified_at ?? '',
    'Screen.eKYCResult': kyc?.checks.id_document.status ?? '',
    'Screen.LivenessTool': 'blox-kyc-module · liveness + face match',
    'Screen.LivenessDate': kyc?.didit_verified_at ?? '',
    'Screen.LivenessResult': `${kyc?.checks.liveness.status ?? ''} · face ${kyc?.checks.face_match.status ?? ''}`,
    'Screen.SanctionsTool': 'blox-kyc-module · sanctions screening',
    'Screen.SanctionsDate': '',
    'Screen.SanctionsResult': '',
    'Screen.PEPTool': 'blox-kyc-module · PEP screening',
    'Screen.PEPDate': '',
    'Screen.PEPResult': '',
    'Screen.PEPRelationTool': 'Declared + MLRO review',
    'Screen.PEPRelationDate': '',
    'Screen.PEPRelationResult': '',
    'Screen.AdverseMediaTool': 'blox-kyc-module · adverse media',
    'Screen.AdverseMediaDate': '',
    'Screen.AdverseMediaResult': '',
    'Screen.SoFMethod': 'Salary certificate + bank statement',
    'Screen.SoFDate': '',
    'Screen.SoFResult': '',
    'Screen.RiskRatingDate': assessed?.assessedAt ?? '',
    'Screen.RiskRating': assessed?.approvalAuthority ?? '',
    'Screen.MLROReferralDate': '',
    'Screen.MLROReferralResult': '',
  };

  return {
    'CAM.Ref': `CAM-${ctx.applicationId}`,
    'CAM.Recommendation': outcome,
    'CAM.Strengths': (assessed?.reasons ?? []).filter((reason) => !reason.includes('cap')).join('; '),
    'CAM.Weaknesses': (assessed?.reasons ?? []).join('; '),
    'CAM.Mitigants': ctx.overrideReason?.trim() || 'None recorded',
    'Credit.DBR': dbr,
    'Credit.DBRResult': affordability?.status ?? '',
    'Credit.LTV': ltv,
    'Credit.LTVResult': '',
    'Credit.ResidualIncome': residual,
    'Credit.ResidualIncomeResult': '',
    'Credit.AgeAtMaturity': '',
    'Credit.VehicleAgeAtMaturity': '',
    'Credit.VehicleAgeResult': '',
    'Credit.EmployerCategoryResult': '',
    'Credit.ExistingBloXExposure': '0.00',
    'Credit.TotalExposurePost': money(ctx.financedTotal),
    'Credit.AvgBankBalance': '',
    'Credit.SalaryTransferResult': '',
    'Credit.ServiceResult': '',
    'Income.TotalMonthly': income != null ? money(income) : '',
    'Income.VerificationSource': 'Application snapshot + KYC documents',
    'Income.SalaryTransferUndertaking': '',
    'Obligation.TotalMonthly': money(liabilities),
    'Obligation.BureauReconciled': '',
    'Bureau.Score': '',
    'Bureau.ScoreResult': '',
    'Bureau.ReportDate': '',
    'Bureau.ReportRef': '',
    'Bureau.Defaults': '',
    'Bureau.WorstArrears': '',
    'Bureau.RecentEnquiries': '',
    'Bureau.UndeclaredObligations': '',
    'BRE.Decision': path,
    'BRE.Score': '',
    'BRE.RiskGrade': assessed?.approvalAuthority ?? '',
    'BRE.RulesTriggered': (assessed?.ruleFlags ?? []).map((flag) => flag.code).join(', '),
    'BRE.OverrideApplied': ctx.overrideReason ? 'Yes' : 'No',
    'BRE.OverrideBy': ctx.overrideReason ? str(ctx.approverName) : '',
    'BRE.OverrideReason': ctx.overrideReason ?? '',
    'Decision.Outcome': outcome,
    'Decision.ApprovedAmount': money(ctx.listPrice - ctx.downPayment),
    'Decision.ApprovedRentalRate': `${ctx.annualRate.toFixed(2)}%`,
    'Decision.ApprovedTermMonths': String(ctx.tenor),
    'Decision.RequiredContribution': money(ctx.downPayment),
    'Decision.ConditionsPrecedent': 'Signed agreements + takaful declaration',
    'Decision.ConditionsSubsequent': 'Registration in nominee name; repayment mandate',
    'Decision.ExpiryDate': '',
    'Policy.DBRMax': affordability ? `${Math.round(affordability.cap * 100)}%` : '',
    'Policy.LTVMax': '',
    'Policy.ResidualIncomeMin': '',
    'Policy.SalaryTransferRequired': '',
    'Policy.ServiceYearsMin': '',
    'Policy.VehicleAgeMax': '',
    'Policy.BureauScoreMin': '',
    'Approval.Maker.Name': str(ctx.approverName),
    'Approval.Maker.Role': str(ctx.approverRole),
    'Approval.Maker.Action': 'Approved',
    'Approval.Maker.Timestamp': iso(ctx.approvedAt),
    'Approval.Checker.Name': '',
    'Approval.Checker.Role': '',
    'Approval.Checker.Action': '',
    'Approval.Checker.Limit': '',
    'Approval.Checker.Timestamp': '',
    'Approval.Approver.Name': str(ctx.approverName),
    'Approval.Approver.Role': str(ctx.approverRole),
    'Approval.Approver.Action': 'Approved',
    'Approval.Approver.Limit': assessed?.approvalAuthority ?? '',
    'Approval.Approver.Timestamp': iso(ctx.approvedAt),
    'Approval.Escalation.Name': '',
    'Approval.Escalation.Role': '',
    'Approval.Escalation.Action': '',
    'Approval.Escalation.Limit': '',
    'Approval.Escalation.Timestamp': '',
    'Party.1.Name': snap.full_name,
    'Party.1.Role': 'Applicant',
    'Party.1.Income': income != null ? money(income) : '',
    'Party.1.DBR': dbr,
    'Party.1.BureauScore': '',
    'Party.1.Assessment': path,
    'Party.2.Name': str(snap.guarantor && typeof snap.guarantor === 'object' ? snap.guarantor.fullName : ''),
    'Party.2.Role': snap.hasGuarantor ? 'Guarantor' : '',
    'Party.2.Income': '',
    'Party.2.DBR': '',
    'Party.2.BureauScore': '',
    'Party.2.Assessment': '',
    'Exception.1.Item': (assessed?.reasons ?? [])[0] ?? '',
    'Exception.1.Limit': '',
    'Exception.1.Actual': dbr,
    'Exception.1.EscalatedTo': ctx.overrideReason ? str(ctx.approverRole) : '',
    'Exception.1.Mitigant': ctx.overrideReason ?? '',
    'Exception.2.Item': (assessed?.reasons ?? [])[1] ?? '',
    'Exception.2.Limit': '',
    'Exception.2.Actual': '',
    'Exception.2.EscalatedTo': '',
    'Exception.2.Mitigant': '',
    'KYC.FullNameEN': identityValue('full_name') || snap.full_name,
    'KYC.QID': identityValue('qid') || snap.qid,
    'KYC.CaseId': kyc?.case_id ?? '',
    'KYC.CaseStatus': kyc?.case_status ?? '',
    ...screen,
  };
}

export function fieldsForDocument(
  documentType: 'ijarah_agreement' | 'musharakah_agreement' | 'ownership_rental_schedule' | 'credit_appraisal_memorandum',
  ctx: ContractFieldContext,
): Record<string, string> {
  const base = commonDealFields(ctx);
  if (documentType === 'ownership_rental_schedule') {
    return { ...base, ...scheduleRowFields(ctx) };
  }
  if (documentType === 'credit_appraisal_memorandum') {
    return { ...base, ...camFields(ctx) };
  }
  return base;
}

export function fallbackFieldPairs(fields: Record<string, string>): Array<[string, string]> {
  const preferred = [
    'Deal.Ref',
    'Deal.ExecutionDate',
    'Customer.FullNameEN',
    'Customer.QID',
    'Customer.NationalAddress',
    'Customer.PhoneEmail',
    'Vehicle.MakeModel',
    'Vehicle.VIN',
    'Vehicle.Chassis',
    'Price.TotalCost',
    'Price.CustomerContribution',
    'Price.BloXContribution',
    'Ownership.CustomerOpeningPct',
    'Ownership.BloXOpeningPct',
    'Deal.RentalRate',
    'Deal.PeriodicPayment',
    'Deal.NumberOfPayments',
  ];
  return preferred
    .filter((key) => fields[key])
    .map((key) => [key.replace(/\./g, ' '), fields[key]] as [string, string]);
}
