import {
  documentSlotsFor,
  missingDocumentCategories,
  type DocumentSlot,
  type DocumentSlotProfile,
} from '@drivemarket/shared/domain-rules';
import { employmentTypeOf, hasGuarantorOf, readCustomerSnapshot, residencyOf } from './customer-snapshot';

/**
 * Every `DocumentCategory` a person may attach to an application (the KYC-only
 * `selfie` slot is written by the KYC bridge, never uploaded by hand).
 */
export const APPLICATION_DOC_CATEGORIES = [
  'qid',
  'id',
  'passport',
  'license',
  'salary',
  'bank',
  'other',
  'cr',
  'computer_card',
  'rental_agreement',
  'signatory_id',
  'credit_bureau',
  'residence_proof',
  'employment_contract',
  'trade_license',
  'audited_financials',
  'tax_card',
  'business_bank',
  'guarantor_qid',
  'guarantor_salary',
  'guarantor_bank',
  'vehicle_quotation',
  'takaful_policy',
] as const;
export const REQUIRED_APPLICATION_DOC_CATEGORIES = ['qid', 'salary', 'bank'] as const;
export type RequiredDocCategory = (typeof REQUIRED_APPLICATION_DOC_CATEGORIES)[number];
export type ApplicationDocCategory = (typeof APPLICATION_DOC_CATEGORIES)[number];

export type ApplicationDocumentForValidation = {
  category: string;
  kycDocumentType?: string | null;
  verificationStatus?: string | null;
};

function isVerifiedKycSlot(doc: ApplicationDocumentForValidation, type: string): boolean {
  return doc.kycDocumentType === type && doc.verificationStatus === 'verified';
}

/** QID requirement satisfied by manual uploads or synced KYC identity slots. */
export function hasQidRequirement(documents: ApplicationDocumentForValidation[]): boolean {
  const categories = new Set(documents.map((d) => d.category));
  if (categories.has('qid') || categories.has('id')) return true;

  const hasFront = documents.some((d) => isVerifiedKycSlot(d, 'qid_front'));
  const hasBack = documents.some((d) => isVerifiedKycSlot(d, 'qid_back'));
  if (hasFront && hasBack) return true;

  // Didit / hosted capture often stores only qid_front on the application.
  if (hasFront && !documents.some((d) => d.kycDocumentType === 'qid_back')) return true;

  return false;
}

export function missingRequiredDocumentCategories(
  documents: ApplicationDocumentForValidation[],
): RequiredDocCategory[] {
  const present = new Set(documents.map((d) => d.category));
  if (hasQidRequirement(documents)) {
    present.add('qid');
  }
  return REQUIRED_APPLICATION_DOC_CATEGORIES.filter((c) => !present.has(c));
}

export function hasAllRequiredDocuments(documents: ApplicationDocumentForValidation[]): boolean {
  return missingRequiredDocumentCategories(documents).length === 0;
}

/**
 * Profile-aware document slots (LOS FSD Stage 1). Individuals follow the shared
 * `documentSlotsFor` checklist (residency, employment type, guarantor);
 * corporate applicants keep the pre-existing rule set: the three core
 * documents plus the dealer wizard's corporate categories.
 */
export type ApplicationDocumentSlot = Omit<DocumentSlot, 'category'> & { category: string };

const CORPORATE_DOCUMENT_SLOTS: ApplicationDocumentSlot[] = [
  { category: 'qid', required: true, group: 'identity', labelKey: 'applyFlow.docs.qid' },
  { category: 'signatory_id', required: false, group: 'identity', labelKey: 'ops.wizard.doc.signatory_id' },
  { category: 'salary', required: true, group: 'income', labelKey: 'applyFlow.docs.salary', maxAgeDays: 30 },
  { category: 'bank', required: true, group: 'income', labelKey: 'applyFlow.docs.bank', maxAgeDays: 30 },
  { category: 'cr', required: false, group: 'business', labelKey: 'applyFlow.docs.cr' },
  { category: 'computer_card', required: false, group: 'business', labelKey: 'ops.wizard.doc.computer_card' },
  { category: 'rental_agreement', required: false, group: 'business', labelKey: 'ops.wizard.doc.rental_agreement' },
  { category: 'vehicle_quotation', required: false, group: 'supporting', labelKey: 'applyFlow.docs.vehicleQuotation' },
  { category: 'other', required: false, group: 'supporting', labelKey: 'applyFlow.docs.other' },
];

export function documentProfileFromSnapshot(snapshotRaw: unknown): DocumentSlotProfile {
  const snapshot = readCustomerSnapshot(snapshotRaw);
  return {
    residency: residencyOf(snapshot),
    employmentType: employmentTypeOf(snapshot),
    hasGuarantor: hasGuarantorOf(snapshot),
    applicantType: snapshot.applicantType,
  };
}

/** Uploaded categories, with `qid` counted when the KYC identity slots satisfy it. */
export function uploadedDocumentCategories(documents: ApplicationDocumentForValidation[]): string[] {
  const present = new Set(documents.map((d) => d.category));
  if (hasQidRequirement(documents)) present.add('qid');
  return [...present].sort();
}

export function missingDocumentsForApplication(
  snapshotRaw: unknown,
  documents: ApplicationDocumentForValidation[],
): string[] {
  const profile = documentProfileFromSnapshot(snapshotRaw);
  if (profile.applicantType === 'corporate') {
    return [...missingRequiredDocumentCategories(documents)];
  }
  return [...missingDocumentCategories(profile, uploadedDocumentCategories(documents))];
}

export function hasAllDocumentsForApplication(
  snapshotRaw: unknown,
  documents: ApplicationDocumentForValidation[],
): boolean {
  return missingDocumentsForApplication(snapshotRaw, documents).length === 0;
}

export type ApplicationDocumentSlotsDto = {
  slots: ApplicationDocumentSlot[];
  uploaded: string[];
  missing: string[];
};

export function documentSlotsForApplication(
  snapshotRaw: unknown,
  documents: ApplicationDocumentForValidation[],
): ApplicationDocumentSlotsDto {
  const profile = documentProfileFromSnapshot(snapshotRaw);
  const slots: ApplicationDocumentSlot[] =
    profile.applicantType === 'corporate'
      ? CORPORATE_DOCUMENT_SLOTS.map((slot) => ({ ...slot }))
      : documentSlotsFor(profile).map((slot) => ({ ...slot }));
  return {
    slots,
    uploaded: uploadedDocumentCategories(documents),
    missing: missingDocumentsForApplication(snapshotRaw, documents),
  };
}
