/**
 * Document slots — which documents an application needs, derived from the
 * applicant profile (LOS FSD Stage 1 "Required Documents", self-employed pack
 * SELFEMP001, guarantor requirement CBS001).
 *
 * The API and every portal call the same function so the customer, the sales
 * executive and the credit officer all see the same checklist.
 */
import type { ResidencyClass } from './product-rules';

export const DOCUMENT_SLOT_CATEGORIES = [
  'qid',
  'qid_front',
  'qid_back',
  'passport',
  'salary',
  'bank',
  'credit_bureau',
  'residence_proof',
  'license',
  'employment_contract',
  'cr',
  'trade_license',
  'business_bank',
  'audited_financials',
  'tax_card',
  'guarantor_qid',
  'guarantor_salary',
  'guarantor_bank',
  'vehicle_quotation',
  'other',
] as const;

export type DocumentSlotCategory = (typeof DOCUMENT_SLOT_CATEGORIES)[number];

export type DocumentSlotGroup = 'identity' | 'income' | 'business' | 'guarantor' | 'supporting';

export type DocumentSlot = {
  category: DocumentSlotCategory;
  required: boolean;
  group: DocumentSlotGroup;
  /** Translation key under `applyFlow.docs.*` for the label; hint is `${key}Hint`. */
  labelKey: string;
  /** Max age in days for time-sensitive documents (salary certificate, bank statements). */
  maxAgeDays?: number;
};

export type DocumentSlotProfile = {
  residency?: ResidencyClass | null;
  employmentType?: string | null;
  hasGuarantor?: boolean;
  applicantType?: 'individual' | 'corporate' | null;
};

const SALARY_CERT_MAX_AGE_DAYS = 30;
const BANK_STATEMENT_MAX_AGE_DAYS = 30;

export function isSelfEmployed(employmentType: string | null | undefined): boolean {
  return (employmentType ?? '').trim() === 'self-employed';
}

/** Ordered slots for the checklist; `required` drives the submit gate. */
export function documentSlotsFor(profile: DocumentSlotProfile): DocumentSlot[] {
  const selfEmployed = isSelfEmployed(profile.employmentType);
  const expat = profile.residency === 'expat';
  const slots: DocumentSlot[] = [];

  slots.push({ category: 'qid_front', required: true, group: 'identity', labelKey: 'applyFlow.docs.qidFront' });
  slots.push({ category: 'qid_back', required: true, group: 'identity', labelKey: 'applyFlow.docs.qidBack' });
  slots.push({ category: 'passport', required: expat, group: 'identity', labelKey: 'applyFlow.docs.passport' });
  slots.push({ category: 'license', required: false, group: 'identity', labelKey: 'applyFlow.docs.license' });
  slots.push({ category: 'residence_proof', required: false, group: 'identity', labelKey: 'applyFlow.docs.residenceProof' });

  if (selfEmployed) {
    slots.push({ category: 'cr', required: true, group: 'business', labelKey: 'applyFlow.docs.cr' });
    slots.push({ category: 'trade_license', required: true, group: 'business', labelKey: 'applyFlow.docs.tradeLicense' });
    slots.push({
      category: 'business_bank',
      required: true,
      group: 'business',
      labelKey: 'applyFlow.docs.businessBank',
      maxAgeDays: BANK_STATEMENT_MAX_AGE_DAYS,
    });
    slots.push({
      category: 'bank',
      required: true,
      group: 'income',
      labelKey: 'applyFlow.docs.personalBank',
      maxAgeDays: BANK_STATEMENT_MAX_AGE_DAYS,
    });
    slots.push({ category: 'audited_financials', required: false, group: 'business', labelKey: 'applyFlow.docs.auditedFinancials' });
    slots.push({ category: 'tax_card', required: false, group: 'business', labelKey: 'applyFlow.docs.taxCard' });
  } else {
    slots.push({
      category: 'salary',
      required: true,
      group: 'income',
      labelKey: 'applyFlow.docs.salary',
      maxAgeDays: SALARY_CERT_MAX_AGE_DAYS,
    });
    slots.push({
      category: 'bank',
      required: true,
      group: 'income',
      labelKey: 'applyFlow.docs.bank',
      maxAgeDays: BANK_STATEMENT_MAX_AGE_DAYS,
    });
    slots.push({ category: 'employment_contract', required: false, group: 'income', labelKey: 'applyFlow.docs.employmentContract' });
  }

  slots.push({ category: 'credit_bureau', required: false, group: 'income', labelKey: 'applyFlow.docs.creditBureau' });

  if (profile.hasGuarantor) {
    slots.push({ category: 'guarantor_qid', required: true, group: 'guarantor', labelKey: 'applyFlow.docs.guarantorQid' });
    slots.push({
      category: 'guarantor_salary',
      required: true,
      group: 'guarantor',
      labelKey: 'applyFlow.docs.guarantorSalary',
      maxAgeDays: SALARY_CERT_MAX_AGE_DAYS,
    });
    slots.push({ category: 'guarantor_bank', required: false, group: 'guarantor', labelKey: 'applyFlow.docs.guarantorBank' });
  }

  slots.push({ category: 'vehicle_quotation', required: false, group: 'supporting', labelKey: 'applyFlow.docs.vehicleQuotation' });
  slots.push({ category: 'other', required: false, group: 'supporting', labelKey: 'applyFlow.docs.other' });
  return slots;
}

export function requiredDocumentCategoriesFor(profile: DocumentSlotProfile): DocumentSlotCategory[] {
  return documentSlotsFor(profile)
    .filter((s) => s.required)
    .map((s) => s.category);
}

/** Categories still missing given the uploaded categories (`qid`/`id` cover both QID sides). */
export function missingDocumentCategories(
  profile: DocumentSlotProfile,
  uploadedCategories: Iterable<string>,
): DocumentSlotCategory[] {
  const present = identityPresentSet(uploadedCategories);
  return requiredDocumentCategoriesFor(profile).filter((c) => !present.has(c));
}

/** A single QID file (or the legacy `id` category) satisfies both front and back slots. */
export function identityPresentSet(uploadedCategories: Iterable<string>): Set<string> {
  const present = new Set(uploadedCategories);
  if (present.has('id') || present.has('qid')) {
    present.add('qid');
    present.add('qid_front');
    present.add('qid_back');
  }
  if (present.has('qid_front') && present.has('qid_back')) present.add('qid');
  return present;
}

type SlotDocument = {
  category?: string | null;
  kyc_document_type?: string | null;
  kycDocumentType?: string | null;
};

/** True when an uploaded file belongs to a checklist slot (including QID front/back aliases). */
export function documentMatchesSlot(doc: SlotDocument, category: string): boolean {
  const stored = String(doc.category ?? '');
  const kyc = String(doc.kyc_document_type ?? doc.kycDocumentType ?? '');
  if (kyc === category || stored === category) return true;
  if (category === 'qid' && (stored === 'id' || kyc === 'qid_front' || kyc === 'qid_back')) return true;
  if (category === 'qid_front' || category === 'qid_back') {
    if (kyc && kyc !== category) return false;
    return stored === 'qid' || stored === 'id';
  }
  return false;
}

export function documentsForSlot<T extends SlotDocument>(docs: T[], category: string): T[] {
  return docs.filter((doc) => documentMatchesSlot(doc, category));
}

/** Upload constraints shared by every upload surface (LOS FSD Stage 1 "Document Controls"). */
export const DOCUMENT_UPLOAD_ACCEPT = '.pdf,image/jpeg,image/png';
export const DOCUMENT_UPLOAD_MAX_BYTES = 5 * 1024 * 1024;
const DOCUMENT_UPLOAD_MIME = new Set(['application/pdf', 'image/jpeg', 'image/png']);

export type UploadRejection = { code: 'type' | 'size'; params: Record<string, string | number> };

export function documentUploadRejection(file: { name: string; type: string; size: number }): UploadRejection | null {
  if (!DOCUMENT_UPLOAD_MIME.has(file.type)) {
    return { code: 'type', params: { name: file.name, type: file.type || 'unknown' } };
  }
  if (file.size > DOCUMENT_UPLOAD_MAX_BYTES) {
    return { code: 'size', params: { name: file.name, mb: Math.round((file.size / 1024 / 1024) * 10) / 10, limitMb: 5 } };
  }
  return null;
}
