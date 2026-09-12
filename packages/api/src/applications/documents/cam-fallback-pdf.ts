import { readCustomerSnapshot } from '../customer-snapshot';
import { camFields, commonDealFields, type ContractFieldContext } from './field-maps';
import { normalizeContractContext } from './contract-terms';
import { BrandedPdfWriter } from './pdf-brand';

export async function buildCamFallbackPdf(ctx: ContractFieldContext): Promise<Buffer> {
  const normalized = normalizeContractContext(ctx);
  const snap = readCustomerSnapshot(normalized.customerSnapshot);
  const deal = commonDealFields(normalized);
  const cam = camFields(normalized);
  const fields = { ...deal, ...cam };

  const writer = await BrandedPdfWriter.create({
    title: 'Credit Appraisal Memorandum',
    subtitle: `CAM-${normalized.applicationId}`,
    confidential: true,
    footerTag: 'BLX-TPL-004 · BloX LLC · INTERNAL · CONFIDENTIAL · blox-it.com',
  });

  writer.metaGrid([
    ['CAM reference', fields['CAM.Ref'] ?? `CAM-${normalized.applicationId}`],
    ['Application', normalized.applicationId],
    ['Applicant', snap.full_name],
    ['QID', snap.qid],
    ['Recommendation', fields['CAM.Recommendation'] ?? ''],
    ['Decision outcome', fields['Decision.Outcome'] ?? ''],
    ['Approver', fields['Approval.Approver.Name'] ?? ''],
    ['Approval date', fields['Approval.Approver.Timestamp'] ?? ''],
  ]);

  const sections: Array<[string, string[]]> = [
    [
      '1. Facility summary',
      [
        'Vehicle.MakeModel',
        'Vehicle.VIN',
        'Price.TotalCost',
        'Price.CustomerContribution',
        'Price.BloXContribution',
        'Credit.LTV',
        'Deal.RentalRate',
        'Deal.PeriodicPayment',
        'Offer.TermMonths',
      ],
    ],
    [
      '2. Affordability',
      ['Income.TotalMonthly', 'Obligation.TotalMonthly', 'Credit.DBR', 'Credit.DBRResult', 'Credit.ResidualIncome'],
    ],
    [
      '3. Credit engine & decision',
      ['BRE.Decision', 'BRE.RiskGrade', 'BRE.RulesTriggered', 'BRE.OverrideApplied', 'BRE.OverrideReason', 'CAM.Strengths', 'CAM.Weaknesses', 'CAM.Mitigants'],
    ],
    [
      '4. Compliance screening',
      ['Screen.eKYCTool', 'Screen.eKYCResult', 'Screen.LivenessResult', 'Screen.SanctionsResult', 'Screen.PEPResult', 'KYC.CaseStatus'],
    ],
    [
      '5. Approval trail',
      ['Approval.Maker.Name', 'Approval.Maker.Role', 'Approval.Approver.Name', 'Approval.Approver.Role', 'Approval.Approver.Limit'],
    ],
  ];

  for (const [heading, keys] of sections) {
    writer.section(heading);
    for (const key of keys) {
      const value = fields[key];
      if (!value?.trim()) continue;
      writer.keyValue(key.replace(/\./g, ' '), value);
    }
  }

  return writer.toBuffer();
}
