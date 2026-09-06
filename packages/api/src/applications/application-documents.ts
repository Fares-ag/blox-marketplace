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
