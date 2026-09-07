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
  /** Upload time — drives the freshness check on time-sensitive slots. */
  createdAt?: Date | string | null;
  /** Role of the uploader (`customer` or a staff role); decides whether a manual QID counts under e-KYC. */
  uploadedByRole?: string | null;
};

/**
 * How the identity (QID) slot may be satisfied — BRD Qatar e-KYC BR-3/FR-3.
 *
 * With `ekycRequired` a hand-uploaded QID photo from the customer no longer
 * satisfies the slot: identity must come from the KYC platform (OCR + liveness
 * + face match), which lands as verified `qid_front`/`qid_back` rows. Staff
 * uploads remain acceptable only when `allowStaffManualIdentity` is on, for the
 * face-to-face branch procedure where the officer attests the original card.
 */
export type IdentityPolicy = {
  ekycRequired?: boolean;
  allowStaffManualIdentity?: boolean;
};

function isVerifiedKycSlot(doc: ApplicationDocumentForValidation, type: string): boolean {
  return doc.kycDocumentType === type && doc.verificationStatus === 'verified';
}

function isManualIdentityUpload(doc: ApplicationDocumentForValidation): boolean {
  return (doc.category === 'qid' || doc.category === 'id') && !doc.kycDocumentType;
}

function manualIdentityAccepted(doc: ApplicationDocumentForValidation, policy: IdentityPolicy): boolean {
  if (!policy.ekycRequired) return true;
  if (policy.allowStaffManualIdentity === false) return false;
  return !!doc.uploadedByRole && doc.uploadedByRole !== 'customer';
}

/** QID requirement satisfied by manual uploads (subject to the identity policy) or synced KYC identity slots. */
export function hasQidRequirement(
  documents: ApplicationDocumentForValidation[],
  policy: IdentityPolicy = {},
): boolean {
  if (documents.some((d) => isManualIdentityUpload(d) && manualIdentityAccepted(d, policy))) return true;

  const hasFront = documents.some((d) => isVerifiedKycSlot(d, 'qid_front'));
  const hasBack = documents.some((d) => isVerifiedKycSlot(d, 'qid_back'));
  if (hasFront && hasBack) return true;

  // Didit / hosted capture often stores only qid_front on the application.
  if (hasFront && !documents.some((d) => d.kycDocumentType === 'qid_back')) return true;

  return false;
}

export function missingRequiredDocumentCategories(
  documents: ApplicationDocumentForValidation[],
  policy: IdentityPolicy = {},
): RequiredDocCategory[] {
  const present = new Set(documents.map((d) => d.category));
  present.delete('qid');
  present.delete('id');
  if (hasQidRequirement(documents, policy)) {
    present.add('qid');
  }
  return REQUIRED_APPLICATION_DOC_CATEGORIES.filter((c) => !present.has(c));
}

export function hasAllRequiredDocuments(
  documents: ApplicationDocumentForValidation[],
  policy: IdentityPolicy = {},
): boolean {
  return missingRequiredDocumentCategories(documents, policy).length === 0;
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
export function uploadedDocumentCategories(
  documents: ApplicationDocumentForValidation[],
  policy: IdentityPolicy = {},
): string[] {
  const present = new Set(documents.map((d) => d.category));
  // A manual QID that the policy rejects must not read as "uploaded", or the
  // customer portal would show the slot as done while submit refuses it.
  present.delete('qid');
  present.delete('id');
  if (hasQidRequirement(documents, policy)) present.add('qid');
  return [...present].sort();
}

export function missingDocumentsForApplication(
  snapshotRaw: unknown,
  documents: ApplicationDocumentForValidation[],
  policy: IdentityPolicy = {},
): string[] {
  const profile = documentProfileFromSnapshot(snapshotRaw);
  if (profile.applicantType === 'corporate') {
    return [...missingRequiredDocumentCategories(documents, policy)];
  }
  return [...missingDocumentCategories(profile, uploadedDocumentCategories(documents, policy))];
}

export function hasAllDocumentsForApplication(
  snapshotRaw: unknown,
  documents: ApplicationDocumentForValidation[],
  policy: IdentityPolicy = {},
): boolean {
  return missingDocumentsForApplication(snapshotRaw, documents, policy).length === 0;
}

/** Profile-aware slot list (corporate applicants keep the legacy rule set). */
export function applicationDocumentSlots(snapshotRaw: unknown): ApplicationDocumentSlot[] {
  const profile = documentProfileFromSnapshot(snapshotRaw);
  return profile.applicantType === 'corporate'
    ? CORPORATE_DOCUMENT_SLOTS.map((slot) => ({ ...slot }))
    : documentSlotsFor(profile).map((slot) => ({ ...slot }));
}

const DAY_MS = 86_400_000;

function uploadTimeOf(doc: ApplicationDocumentForValidation): number | null {
  if (!doc.createdAt) return null;
  const time = doc.createdAt instanceof Date ? doc.createdAt.getTime() : new Date(doc.createdAt).getTime();
  return Number.isFinite(time) ? time : null;
}

/** Newest upload time per category (ms since epoch); a legacy `id` upload also counts for `qid`. */
export function newestUploadByCategory(documents: ApplicationDocumentForValidation[]): Map<string, number> {
  const newest = new Map<string, number>();
  const note = (category: string, time: number) => {
    const current = newest.get(category);
    if (current == null || time > current) newest.set(category, time);
  };
  for (const doc of documents) {
    const time = uploadTimeOf(doc);
    if (time == null) continue;
    note(doc.category, time);
    if (doc.category === 'id') note('qid', time);
  }
  return newest;
}

/** A time-sensitive slot is stale when its newest upload is older than `maxAgeDays`. */
export function isSlotStale(
  slot: { maxAgeDays?: number },
  newestUploadMs: number | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!slot.maxAgeDays || newestUploadMs == null) return false;
  return now.getTime() - newestUploadMs > slot.maxAgeDays * DAY_MS;
}

/**
 * Categories whose newest upload is older than the slot allows (salary
 * certificates and bank statements: 30 days). Slots without an upload are the
 * `documents_missing` gate's business, not this one's.
 */
export function staleDocumentCategories(
  snapshotRaw: unknown,
  documents: ApplicationDocumentForValidation[],
  now: Date = new Date(),
): string[] {
  const newest = newestUploadByCategory(documents);
  return applicationDocumentSlots(snapshotRaw)
    .filter((slot) => isSlotStale(slot, newest.get(slot.category), now))
    .map((slot) => slot.category);
}

export type ApplicationDocumentSlotDto = ApplicationDocumentSlot & {
  /** Newest upload for the slot (ISO), null when nothing was uploaded yet. */
  uploaded_at: string | null;
};

export type ApplicationDocumentSlotsDto = {
  slots: ApplicationDocumentSlotDto[];
  uploaded: string[];
  missing: string[];
  /** Time-sensitive slots whose newest upload is older than allowed (re-upload before submit). */
  stale: string[];
};

export function documentSlotsForApplication(
  snapshotRaw: unknown,
  documents: ApplicationDocumentForValidation[],
  now: Date = new Date(),
  policy: IdentityPolicy = {},
): ApplicationDocumentSlotsDto {
  const newest = newestUploadByCategory(documents);
  const slots: ApplicationDocumentSlotDto[] = applicationDocumentSlots(snapshotRaw).map((slot) => {
    const uploadedAt = newest.get(slot.category);
    return { ...slot, uploaded_at: uploadedAt == null ? null : new Date(uploadedAt).toISOString() };
  });
  return {
    slots,
    uploaded: uploadedDocumentCategories(documents, policy),
    missing: missingDocumentsForApplication(snapshotRaw, documents, policy),
    stale: slots.filter((slot) => isSlotStale(slot, newest.get(slot.category), now)).map((slot) => slot.category),
  };
}
