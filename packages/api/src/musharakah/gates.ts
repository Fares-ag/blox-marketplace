import { DocumentCategory, TakafulStatus } from '@prisma/client';
import { vehicleIdentityComplete, type VehicleIdentity } from '../products/vehicle-identity';
import { requiredDownPaymentAmount, sumDownPaymentRecorded } from '../applications/down-payment';
import type { Prisma } from '@prisma/client';

export type PreDisbursalItem = {
  code: string;
  complete: boolean;
  id?: string;
  completed?: boolean;
  label?: string;
};

export type PreDisbursalChecklist = {
  application_id: string;
  status: string;
  customer_phase: string;
  complete: boolean;
  completed_at: string | null;
  items: PreDisbursalItem[];
};

const ACQUISITION_DOC_CATEGORIES: DocumentCategory[] = [
  DocumentCategory.delivery_note,
  DocumentCategory.registration_card,
  DocumentCategory.vin_evidence,
];

const PRE_DISBURSAL_LABELS: Record<string, string> = {
  kyc_verified: 'Identity verification',
  contract_generated: 'Master agreement generated',
  signed_contract: 'Signed agreement on file',
  down_payment: 'Initial unit contribution paid',
  mandate_registered: 'Repayment mandate registered',
  takaful_coverage: 'Takaful coverage at least vehicle value',
};

export function evaluatePreDisbursal(input: {
  applicationId: string;
  status: string;
  customerPhase: string;
  kycStatus: string | null;
  contractGenerated: boolean;
  signedContractPath: string | null;
  preDisbursalCompletedAt: Date | null;
  repaymentMandateStatus: string | null;
  requiredDown: Prisma.Decimal;
  recordedDown: Prisma.Decimal;
  takafulCoverageOk: boolean;
}): PreDisbursalChecklist {
  const items: PreDisbursalItem[] = [
    { code: 'kyc_verified', complete: input.kycStatus === 'verified' },
    { code: 'contract_generated', complete: input.contractGenerated },
    { code: 'signed_contract', complete: Boolean(input.signedContractPath) },
    { code: 'down_payment', complete: input.recordedDown.gte(input.requiredDown) },
    { code: 'mandate_registered', complete: input.repaymentMandateStatus === 'registered' },
    { code: 'takaful_coverage', complete: input.takafulCoverageOk },
  ].map((item) => ({
    ...item,
    id: item.code,
    completed: item.complete,
    label: PRE_DISBURSAL_LABELS[item.code] ?? item.code,
  }));
  return {
    application_id: input.applicationId,
    status: input.status,
    customer_phase: input.customerPhase,
    complete: items.every((item) => item.complete),
    completed_at: input.preDisbursalCompletedAt?.toISOString() ?? null,
    items,
  };
}

export function evaluateAcquisitionGate(input: {
  lpoSettled: boolean;
  vehicle: VehicleIdentity;
  documents: Array<{ category: DocumentCategory }>;
  preDisbursalComplete: boolean;
}): { ok: boolean; missing: string[] } {
  const missing: string[] = [];
  if (!input.lpoSettled) missing.push('lpo_not_settled');
  if (!vehicleIdentityComplete(input.vehicle)) missing.push('vehicle_identity_incomplete');
  const present = new Set(input.documents.map((d) => d.category));
  for (const category of ACQUISITION_DOC_CATEGORIES) {
    if (!present.has(category)) missing.push(`doc_${category}`);
  }
  if (!input.preDisbursalComplete) missing.push('pre_disbursal_incomplete');
  return { ok: missing.length === 0, missing };
}

export { requiredDownPaymentAmount, sumDownPaymentRecorded };
export { TakafulStatus };
