/**
 * Customer snapshot shape shared by the marketplace apply flow, the dealer /
 * admin intake wizard and the API (`customerSnapshot` JSON on Application).
 *
 * Keys inside the JSON are camelCase (plus the legacy `full_name`). Older
 * snapshots carried `address.street/country/postalCode` and
 * `employment.position`; those are still read so historic applications keep
 * rendering, but new snapshots follow the customer-platform shape:
 * `address { line1, area, city, zone, poBox }` and `employment.jobTitle`.
 */
import {
  documentSlotsFor,
  type DocumentSlot,
  type DocumentSlotGroup,
  type DocumentSlotProfile,
} from '../lib/document-slots';
import { isValidEmail, isValidQatarPhone } from '../lib/contact';
import { ageFromDateOfBirth, dateOfBirthMatchesQid, parseIsoDateParts, parseQid } from '../lib/qid';
import {
  PRODUCT_RULES,
  RESIDENCE_DURATION_OPTIONS,
  validateFinancingRequest,
  type ProductRuleViolation,
  type ResidencyClass,
  type ResidenceDurationValue,
  type RuleVehicleCondition,
  type VehicleCategory,
} from '../lib/product-rules';

export type ApplicantType = 'individual' | 'corporate';
export type CustomerGender = 'male' | 'female' | 'prefer_not_to_say';
export type GuarantorRelationship = 'spouse' | 'parent' | 'sibling' | 'other';

export type CustomerAddress = {
  line1?: string;
  area?: string;
  city?: string;
  zone?: string;
  poBox?: string;
  /** Legacy keys — read from older snapshots; the corporate registered address still uses them. */
  street?: string;
  state?: string;
  country?: string;
  postalCode?: string;
};

export type CustomerEmployment = {
  company?: string;
  /** Job title. Written to the snapshot as `jobTitle`; older snapshots used `position`. */
  position?: string;
  employmentType?: string;
  employmentDuration?: string;
  salary?: number;
};

export type CustomerGuarantor = {
  fullName: string;
  qid: string;
  phone: string;
  relationship: GuarantorRelationship | '';
  monthlyIncome: number;
};

export type CorporateAuthorizedSignatory = {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  qid?: string;
  nationality?: string;
  position?: string;
};

export type CorporateApplicantInfo = {
  legalName?: string;
  crNumber?: string;
  tradeName?: string;
  industry?: string;
  registeredAddress?: CustomerAddress;
  authorizedSignatory?: CorporateAuthorizedSignatory;
};

export type CustomerInfoFormValue = {
  applicantType: ApplicantType;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  gender: CustomerGender | '';
  dateOfBirth: string;
  nationality: string;
  /** Derived from the QID (634 = Qatar); kept on the form so the UI can show it. */
  residency: ResidencyClass | '';
  /** Expatriates only. */
  residenceDuration: ResidenceDurationValue | '';
  qid: string;
  address: CustomerAddress;
  employment: CustomerEmployment;
  monthlyIncome: number;
  monthlyLiabilities: number;
  hasGuarantor: boolean;
  guarantor: CustomerGuarantor;
  corporate: CorporateApplicantInfo;
};

export const EMPLOYMENT_TYPE_OPTIONS = [
  { value: 'gov-or-semi-gov', labelKey: 'ops.customer.employmentTypes.gov' },
  { value: 'private-international', labelKey: 'ops.customer.employmentTypes.privateIntl' },
  { value: 'private-local', labelKey: 'ops.customer.employmentTypes.privateLocal' },
  { value: 'self-employed', labelKey: 'ops.customer.employmentTypes.selfEmployed' },
] as const;

export const EMPLOYMENT_DURATION_OPTIONS = [
  { value: 'less-than-6-months', labelKey: 'ops.customer.employmentDurations.lt6' },
  { value: 'between-6-12-months', labelKey: 'ops.customer.employmentDurations.b6_12' },
  { value: 'more-than-12-months', labelKey: 'ops.customer.employmentDurations.gt12' },
] as const;

export const GENDER_OPTIONS = [
  { value: 'male', labelKey: 'dealerOps.intake.genderMale' },
  { value: 'female', labelKey: 'dealerOps.intake.genderFemale' },
  { value: 'prefer_not_to_say', labelKey: 'dealerOps.intake.genderPreferNot' },
] as const satisfies ReadonlyArray<{ value: CustomerGender; labelKey: string }>;

export const GUARANTOR_RELATIONSHIP_OPTIONS = [
  { value: 'spouse', labelKey: 'dealerOps.intake.relationship.spouse' },
  { value: 'parent', labelKey: 'dealerOps.intake.relationship.parent' },
  { value: 'sibling', labelKey: 'dealerOps.intake.relationship.sibling' },
  { value: 'other', labelKey: 'dealerOps.intake.relationship.other' },
] as const satisfies ReadonlyArray<{ value: GuarantorRelationship; labelKey: string }>;

// `qid` leads deliberately: REQUIRED_APPLICATION_DOC_CATEGORIES (api) requires
// exactly 'qid', so a Qatar ID filed by staff under the generic 'id' category
// left the application still reporting its QID as missing. Both remain valid —
// 'id' covers a non-Qatari identity card.
export const INDIVIDUAL_DOC_CATEGORIES = [
  'qid',
  'passport',
  'id',
  'license',
  'salary',
  'bank',
  'other',
] as const;
export const CORPORATE_DOC_CATEGORIES = ['cr', 'computer_card', 'rental_agreement', 'signatory_id'] as const;

/**
 * Must stay in step with StorageService.assertKycFile in the API, which accepts
 * only these four types and 10 MB. The ops upload inputs used `accept=".pdf,
 * image/*"`, which is far wider: a phone photo (HEIC/HEIF) or a screenshot
 * (GIF/AVIF) passed the file picker and came back as an opaque 400
 * invalid_file_type, with nothing on screen explaining which file was wrong.
 */
export const KYC_UPLOAD_ACCEPT = '.pdf,image/jpeg,image/png,image/webp';
export const KYC_UPLOAD_MAX_BYTES = 10 * 1024 * 1024;
const KYC_UPLOAD_MIME = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);

/**
 * Why the API would refuse this file, or null when it will accept it. Checked
 * client-side so the person uploading is told which file is wrong and why,
 * rather than seeing a bare 400 after the upload round-trip.
 */
export function kycUploadRejection(file: { name: string; type: string; size: number }): string | null {
  if (!KYC_UPLOAD_MIME.has(file.type)) {
    const kind = file.type || 'unknown type';
    return `${file.name} is a ${kind} file. Upload a PDF, JPG, PNG or WebP — a photo taken on an iPhone is usually HEIC and needs converting first.`;
  }
  if (file.size > KYC_UPLOAD_MAX_BYTES) {
    return `${file.name} is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is 10 MB.`;
  }
  return null;
}

export type IndividualDocCategory = (typeof INDIVIDUAL_DOC_CATEGORIES)[number];
export type CorporateDocCategory = (typeof CORPORATE_DOC_CATEGORIES)[number];

/**
 * Translator accepted by the validators. The i18next `t` from `useOpsLabels`
 * fits; when omitted the English `defaultValue` is returned (with `{{param}}`
 * interpolation) so pure callers and tests keep working.
 */
export type IntakeTranslate = (key: string, options?: { defaultValue?: string; [param: string]: unknown }) => string;

const passthroughTranslate: IntakeTranslate = (key, options) => {
  const template = typeof options?.defaultValue === 'string' ? options.defaultValue : key;
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, name: string) => {
    const value = options?.[name];
    return value === undefined || value === null ? '' : String(value);
  });
};

function emptyGuarantor(): CustomerGuarantor {
  return { fullName: '', qid: '', phone: '', relationship: '', monthlyIncome: 0 };
}

export function emptyCustomerInfo(): CustomerInfoFormValue {
  return {
    applicantType: 'individual',
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    gender: '',
    dateOfBirth: '',
    nationality: '',
    residency: '',
    residenceDuration: '',
    qid: '',
    address: { line1: '', area: '', city: '', zone: '', poBox: '' },
    employment: {
      company: '',
      position: '',
      employmentType: '',
      employmentDuration: '',
      salary: 0,
    },
    monthlyIncome: 0,
    monthlyLiabilities: 0,
    hasGuarantor: false,
    guarantor: emptyGuarantor(),
    corporate: {
      legalName: '',
      crNumber: '',
      tradeName: '',
      industry: '',
      registeredAddress: { street: '', city: '', country: '', postalCode: '', state: '' },
      authorizedSignatory: {
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        qid: '',
        nationality: '',
        position: '',
      },
    },
  };
}

function asGender(value: unknown): CustomerGender | '' {
  return value === 'male' || value === 'female' || value === 'prefer_not_to_say' ? value : '';
}

function asResidency(value: unknown): ResidencyClass | '' {
  return value === 'qatari' || value === 'expat' ? value : '';
}

function asResidenceDuration(value: unknown): ResidenceDurationValue | '' {
  return RESIDENCE_DURATION_OPTIONS.some((o) => o.value === value) ? (value as ResidenceDurationValue) : '';
}

function asRelationship(value: unknown): GuarantorRelationship | '' {
  return value === 'spouse' || value === 'parent' || value === 'sibling' || value === 'other' ? value : '';
}

function str(value: unknown): string {
  return value === undefined || value === null ? '' : String(value);
}

/** Residency for a form value: the explicit field first, else read from the QID. */
export function residencyForInfo(info: Pick<CustomerInfoFormValue, 'residency' | 'qid'>): ResidencyClass | null {
  if (info.residency) return info.residency;
  return parseQid(info.qid).residency;
}

export function customerInfoFromSnapshot(raw: Record<string, unknown> | undefined | null): CustomerInfoFormValue {
  const base = emptyCustomerInfo();
  if (!raw) return base;

  const applicantType: ApplicantType = raw.applicantType === 'corporate' ? 'corporate' : 'individual';
  const employmentRaw = raw.employment;
  const employmentObj: CustomerEmployment & { jobTitle?: string } =
    typeof employmentRaw === 'string'
      ? { company: employmentRaw }
      : employmentRaw && typeof employmentRaw === 'object'
        ? (employmentRaw as CustomerEmployment & { jobTitle?: string })
        : {};
  const address = (raw.address as CustomerAddress | undefined) ?? {};
  const incomeRaw = raw.income ?? raw.monthlyIncome ?? employmentObj.salary;
  const corp = (raw.corporate as CorporateApplicantInfo | undefined) ?? {};
  const guarantorRaw = raw.guarantor && typeof raw.guarantor === 'object' ? (raw.guarantor as Record<string, unknown>) : null;

  const fullName = str(raw.full_name).trim();
  const nameParts = fullName.split(/\s+/).filter(Boolean);
  const qid = str(raw.qid);
  const residency = asResidency(raw.residency) || asResidency(parseQid(qid).residency);

  return {
    applicantType,
    firstName: str(raw.firstName ?? nameParts[0] ?? ''),
    lastName: str(raw.lastName ?? nameParts.slice(1).join(' ') ?? ''),
    email: str(raw.email),
    phone: str(raw.phone),
    gender: asGender(raw.gender),
    dateOfBirth: str(raw.dateOfBirth),
    nationality: str(raw.nationality),
    residency,
    residenceDuration: asResidenceDuration(raw.residenceDuration),
    qid,
    address: {
      line1: str(address.line1 ?? address.street ?? raw.street ?? ''),
      area: str(address.area ?? address.state ?? ''),
      city: str(address.city ?? raw.city ?? ''),
      zone: str(address.zone ?? ''),
      poBox: str(address.poBox ?? address.postalCode ?? raw.postalCode ?? ''),
      country: str(address.country ?? raw.country ?? ''),
    },
    employment: {
      company: str(employmentObj.company),
      position: str(employmentObj.jobTitle ?? employmentObj.position ?? ''),
      employmentType: str(employmentObj.employmentType),
      employmentDuration: str(employmentObj.employmentDuration),
      salary: Number(employmentObj.salary ?? incomeRaw ?? 0) || 0,
    },
    monthlyIncome: Number(raw.monthlyIncome ?? incomeRaw ?? employmentObj.salary ?? 0) || 0,
    monthlyLiabilities: Number(raw.monthlyLiabilities ?? 0) || 0,
    hasGuarantor: raw.hasGuarantor === true || !!(guarantorRaw && (guarantorRaw.fullName || guarantorRaw.qid)),
    guarantor: guarantorRaw
      ? {
          fullName: str(guarantorRaw.fullName),
          qid: str(guarantorRaw.qid),
          phone: str(guarantorRaw.phone),
          relationship: asRelationship(guarantorRaw.relationship),
          monthlyIncome: Number(guarantorRaw.monthlyIncome ?? 0) || 0,
        }
      : emptyGuarantor(),
    corporate: {
      legalName: str(corp.legalName),
      crNumber: str(corp.crNumber),
      tradeName: str(corp.tradeName),
      industry: str(corp.industry),
      registeredAddress: {
        street: str(corp.registeredAddress?.street),
        city: str(corp.registeredAddress?.city),
        country: str(corp.registeredAddress?.country),
        postalCode: str(corp.registeredAddress?.postalCode),
        state: str(corp.registeredAddress?.state),
      },
      authorizedSignatory: {
        firstName: str(corp.authorizedSignatory?.firstName),
        lastName: str(corp.authorizedSignatory?.lastName),
        email: str(corp.authorizedSignatory?.email ?? raw.email ?? ''),
        phone: str(corp.authorizedSignatory?.phone ?? raw.phone ?? ''),
        qid: str(corp.authorizedSignatory?.qid ?? raw.qid ?? ''),
        nationality: str(corp.authorizedSignatory?.nationality),
        position: str(corp.authorizedSignatory?.position),
      },
    },
  };
}

function compactStrings<T extends Record<string, string | undefined>>(value: T): Partial<T> {
  const out: Partial<T> = {};
  for (const [key, raw] of Object.entries(value)) {
    const trimmed = raw?.trim();
    if (trimmed) (out as Record<string, string>)[key] = trimmed;
  }
  return out;
}

export function buildCustomerSnapshot(value: CustomerInfoFormValue): Record<string, unknown> {
  if (value.applicantType === 'corporate') {
    const signatory = value.corporate.authorizedSignatory ?? {};
    const email = (signatory.email || value.email).trim().toLowerCase();
    const phone = signatory.phone || value.phone;
    const qid = signatory.qid || value.qid;
    const full_name = value.corporate.legalName?.trim() || 'Corporate applicant';
    return {
      applicantType: 'corporate',
      email,
      phone,
      qid,
      full_name,
      firstName: signatory.firstName,
      lastName: signatory.lastName,
      corporate: {
        legalName: value.corporate.legalName,
        crNumber: value.corporate.crNumber,
        tradeName: value.corporate.tradeName || undefined,
        industry: value.corporate.industry || undefined,
        registeredAddress: value.corporate.registeredAddress,
        authorizedSignatory: {
          ...signatory,
          email,
          phone,
          qid,
        },
      },
    };
  }

  const qid = value.qid.trim();
  const residency = residencyForInfo({ residency: value.residency, qid }) ?? undefined;
  const full_name = `${value.firstName} ${value.lastName}`.trim() || value.email;
  const address = compactStrings({
    line1: value.address.line1,
    area: value.address.area,
    city: value.address.city,
    zone: value.address.zone,
    poBox: value.address.poBox,
  });
  const guarantor = value.hasGuarantor
    ? {
        fullName: value.guarantor.fullName.trim(),
        qid: value.guarantor.qid.trim(),
        phone: value.guarantor.phone.trim(),
        relationship: value.guarantor.relationship || 'other',
        monthlyIncome: value.guarantor.monthlyIncome > 0 ? value.guarantor.monthlyIncome : undefined,
      }
    : undefined;

  return {
    applicantType: 'individual',
    firstName: value.firstName.trim(),
    lastName: value.lastName.trim(),
    full_name,
    email: value.email.trim().toLowerCase(),
    phone: value.phone.trim(),
    qid,
    gender: value.gender || undefined,
    dateOfBirth: value.dateOfBirth || undefined,
    nationality: value.nationality.trim() || undefined,
    residency,
    residenceDuration: residency === 'expat' && value.residenceDuration ? value.residenceDuration : undefined,
    city: address.city,
    address: Object.keys(address).length ? address : undefined,
    employment: {
      company: value.employment.company,
      jobTitle: value.employment.position,
      employmentType: value.employment.employmentType,
      employmentDuration: value.employment.employmentDuration,
      salary: value.monthlyIncome || value.employment.salary,
    },
    income: value.monthlyIncome,
    monthlyIncome: value.monthlyIncome,
    monthlyLiabilities: Math.max(0, value.monthlyLiabilities || 0),
    hasGuarantor: value.hasGuarantor,
    guarantor,
  };
}

const VALIDATION_DEFAULTS = {
  nameRequired: 'First and last name are required.',
  emailRequired: 'Email is required.',
  emailInvalid: 'Enter a valid email address, for example name@example.com.',
  genderRequired: 'Gender is required.',
  phoneRequired: 'Phone is required.',
  phoneInvalid: 'Enter an 8-digit Qatar phone number, for example 5551 2345.',
  dobInvalid: 'Enter the date of birth as a real calendar date.',
  qidInvalid: 'Qatar ID must be 11 digits starting with 2 or 3.',
  dobRequired: 'Date of birth is required.',
  dobMismatch: 'The date of birth does not match the birth year on the Qatar ID.',
  nationalityRequired: 'Nationality is required.',
  residenceDurationRequired: 'Time in Qatar is required for expatriate applicants.',
  addressLine1Required: 'Address line 1 is required.',
  cityRequired: 'City is required.',
  companyRequired: 'Employer name is required.',
  positionRequired: 'Job title is required.',
  employmentTypeRequired: 'Employment type is required.',
  employmentDurationRequired: 'Employment duration is required.',
  incomeRequired: 'Stated monthly income is required.',
  liabilitiesInvalid: 'Monthly commitments cannot be negative.',
  guarantorNameRequired: 'Guarantor full name is required.',
  guarantorQidInvalid: 'Guarantor Qatar ID must be 11 valid digits.',
  guarantorPhoneRequired: 'Guarantor phone is required.',
  guarantorRelationshipRequired: 'Guarantor relationship is required.',
  corpLegalName: 'Company legal name is required.',
  corpCr: 'Commercial registration number is required.',
  corpStreet: 'Registered street address is required.',
  corpCity: 'Registered city is required.',
  corpCountry: 'Registered country is required.',
  corpSignatoryName: 'Authorized signatory name is required.',
  corpSignatoryEmail: 'Authorized signatory email is required.',
  corpSignatoryPhone: 'Authorized signatory phone is required.',
  corpSignatoryQid: 'Authorized signatory QID must be 11 digits.',
  documentsMissing: 'Please upload all required documents ({{labels}}).',
  rulesBlocking: 'The plan breaks a product rule. Fix the highlighted items before continuing.',
} as const;

export type CustomerInfoValidationKey = keyof typeof VALIDATION_DEFAULTS;

function message(t: IntakeTranslate, key: CustomerInfoValidationKey, params?: Record<string, unknown>): string {
  return t(`dealerOps.validation.${key}`, { defaultValue: VALIDATION_DEFAULTS[key], ...params });
}

function requireTrimmed(value: string | undefined | null, msg: string): string | null {
  if (!value?.trim()) return msg;
  return null;
}

export function validateCustomerInfo(value: CustomerInfoFormValue, t: IntakeTranslate = passthroughTranslate): string | null {
  if (value.applicantType === 'corporate') {
    const corp = value.corporate;
    const sig = corp.authorizedSignatory;
    const addr = corp.registeredAddress;
    if (!corp.legalName?.trim()) return message(t, 'corpLegalName');
    if (!corp.crNumber?.trim()) return message(t, 'corpCr');
    if (!addr?.street?.trim()) return message(t, 'corpStreet');
    if (!addr?.city?.trim()) return message(t, 'corpCity');
    if (!addr?.country?.trim()) return message(t, 'corpCountry');
    if (!sig?.firstName?.trim() || !sig?.lastName?.trim()) return message(t, 'corpSignatoryName');
    if (!sig?.email?.trim() || !isValidEmail(sig.email)) return message(t, 'corpSignatoryEmail');
    if (!sig?.phone?.trim() || !isValidQatarPhone(sig.phone)) return message(t, 'corpSignatoryPhone');
    if (!sig?.qid?.trim() || !/^\d{11}$/.test(sig.qid.trim())) return message(t, 'corpSignatoryQid');
    return null;
  }

  if (!value.firstName.trim() || !value.lastName.trim()) return message(t, 'nameRequired');
  if (!value.gender) return message(t, 'genderRequired');
  if (!value.email.trim()) return message(t, 'emailRequired');
  if (!isValidEmail(value.email)) return message(t, 'emailInvalid');
  if (!value.phone.trim()) return message(t, 'phoneRequired');
  if (!isValidQatarPhone(value.phone)) return message(t, 'phoneInvalid');

  const qid = value.qid.trim();
  if (!/^\d{11}$/.test(qid) || !parseQid(qid).valid) return message(t, 'qidInvalid');
  if (!value.dateOfBirth.trim()) return message(t, 'dobRequired');
  // Separated from the QID comparison so "20001-05-12" reads as a bad date
  // rather than as a birth-year mismatch.
  if (!parseIsoDateParts(value.dateOfBirth)) return message(t, 'dobInvalid');
  if (dateOfBirthMatchesQid(value.dateOfBirth, qid) === false) return message(t, 'dobMismatch');
  if (!value.nationality.trim()) return message(t, 'nationalityRequired');
  if (residencyForInfo({ residency: value.residency, qid }) === 'expat' && !value.residenceDuration) {
    return message(t, 'residenceDurationRequired');
  }

  const addressError =
    requireTrimmed(value.address.line1 ?? value.address.street, message(t, 'addressLine1Required')) ??
    requireTrimmed(value.address.city, message(t, 'cityRequired'));
  if (addressError) return addressError;

  const employmentError =
    requireTrimmed(value.employment.company, message(t, 'companyRequired')) ??
    requireTrimmed(value.employment.position, message(t, 'positionRequired')) ??
    requireTrimmed(value.employment.employmentType, message(t, 'employmentTypeRequired')) ??
    requireTrimmed(value.employment.employmentDuration, message(t, 'employmentDurationRequired'));
  if (employmentError) return employmentError;

  if (!value.monthlyIncome || value.monthlyIncome <= 0) return message(t, 'incomeRequired');
  if (value.monthlyLiabilities < 0) return message(t, 'liabilitiesInvalid');

  if (value.hasGuarantor) {
    const g = value.guarantor;
    if (!g.fullName.trim()) return message(t, 'guarantorNameRequired');
    if (!/^\d{11}$/.test(g.qid.trim()) || !parseQid(g.qid.trim()).valid) return message(t, 'guarantorQidInvalid');
    if (!g.phone.trim()) return message(t, 'guarantorPhoneRequired');
    if (!g.relationship) return message(t, 'guarantorRelationshipRequired');
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Document slots                                                      */
/* ------------------------------------------------------------------ */

/** A checklist row: the shared `DocumentSlot` plus corporate pseudo-slots. */
export type WizardDocumentSlot = {
  category: string;
  required: boolean;
  group: DocumentSlotGroup;
  /** Translation key for the label; `${labelKey}Hint` is the optional hint. */
  labelKey: string;
  maxAgeDays?: number;
};

export const DOCUMENT_SLOT_GROUP_ORDER: DocumentSlotGroup[] = ['identity', 'income', 'business', 'guarantor', 'supporting'];

export const DOCUMENT_SLOT_GROUP_LABEL_KEYS: Record<DocumentSlotGroup, string> = {
  identity: 'applyFlow.docs.groupIdentity',
  income: 'applyFlow.docs.groupIncome',
  business: 'applyFlow.docs.groupBusiness',
  guarantor: 'applyFlow.docs.groupGuarantor',
  supporting: 'applyFlow.docs.groupSupporting',
};

/** Profile handed to `documentSlotsFor` — the same inputs the API uses for the submit gate. */
export function documentSlotProfileFor(info: CustomerInfoFormValue): DocumentSlotProfile {
  return {
    residency: residencyForInfo(info),
    employmentType: info.employment.employmentType || null,
    hasGuarantor: !!info.hasGuarantor,
    applicantType: info.applicantType,
  };
}

/** Ordered checklist for the applicant; corporate applicants keep their fixed document set. */
export function wizardDocumentSlots(info: CustomerInfoFormValue): WizardDocumentSlot[] {
  if (info.applicantType === 'corporate') {
    return CORPORATE_DOC_CATEGORIES.map((category) => ({
      category,
      required: true,
      group: 'business',
      labelKey: `ops.wizard.doc.${category}`,
    }));
  }
  return documentSlotsFor(documentSlotProfileFor(info)).map((slot: DocumentSlot) => ({ ...slot }));
}

/** Slots grouped in display order (groups without slots are dropped). */
export function groupDocumentSlots(slots: WizardDocumentSlot[]): Array<{ group: DocumentSlotGroup; slots: WizardDocumentSlot[] }> {
  return DOCUMENT_SLOT_GROUP_ORDER.map((group) => ({ group, slots: slots.filter((s) => s.group === group) })).filter(
    (g) => g.slots.length > 0,
  );
}

/** `qid` is satisfied by a document filed as the generic `id` category too. */
export function slotSatisfiedBy(category: string, uploaded: Iterable<string>): boolean {
  const present = new Set(uploaded);
  if (category === 'qid') return present.has('qid') || present.has('id');
  return present.has(category);
}

/**
 * Wizard / create flow: every required document must have a file selected.
 * Accepts the legacy applicant type (fixed categories) or the full form value
 * (slots derived from residency, employment type and guarantor).
 */
export function validateRequiredWizardDocuments(
  files: Partial<Record<string, File>>,
  applicantTypeOrInfo: ApplicantType | CustomerInfoFormValue,
  t: IntakeTranslate = passthroughTranslate,
): string | null {
  const required: Array<{ category: string; labelKey: string }> =
    typeof applicantTypeOrInfo === 'string'
      ? requiredDocCategoriesForApplicant(applicantTypeOrInfo).map((category) => ({
          category,
          labelKey: `ops.wizard.doc.${category}`,
        }))
      : wizardDocumentSlots(applicantTypeOrInfo).filter((s) => s.required);
  const chosen = Object.keys(files).filter((key) => !!files[key]);
  const missing = required.filter((slot) => !slotSatisfiedBy(slot.category, chosen));
  if (missing.length === 0) return null;
  const labels = missing
    .map((slot) => t(slot.labelKey, { defaultValue: slot.category.replace(/_/g, ' ') }))
    .join(', ');
  return message(t, 'documentsMissing', { labels });
}

export function docCategoriesForApplicant(type: ApplicantType): readonly string[] {
  return type === 'corporate' ? CORPORATE_DOC_CATEGORIES : INDIVIDUAL_DOC_CATEGORIES;
}

/** Mirrors REQUIRED_APPLICATION_DOC_CATEGORIES in the API for individuals; corporate needs its full set. */
export const REQUIRED_INDIVIDUAL_DOC_CATEGORIES = ['qid', 'salary', 'bank'] as const;

export function requiredDocCategoriesForApplicant(type: ApplicantType): readonly string[] {
  return type === 'corporate' ? CORPORATE_DOC_CATEGORIES : REQUIRED_INDIVIDUAL_DOC_CATEGORIES;
}

/* ------------------------------------------------------------------ */
/* Product rules in the wizard                                          */
/* ------------------------------------------------------------------ */

export type WizardRuleVehicle = {
  price: number;
  condition?: string | null;
  modelYear?: number | null;
  category?: VehicleCategory | null;
};

export type WizardRuleInput = {
  info: Pick<CustomerInfoFormValue, 'applicantType' | 'residency' | 'qid'>;
  vehicle: WizardRuleVehicle;
  tenureMonths: number;
  downPaymentPct: number;
  offerTenureOptions?: number[] | null;
  offerMinDownPaymentPct?: number | null;
};

/**
 * Product-rule check for the staff wizard. Financing caps and the
 * individuals-only rule stay soft here (the API decides from its env flags);
 * everything else is hard and blocks the step.
 */
export function wizardRuleViolations(input: WizardRuleInput): ProductRuleViolation[] {
  const condition: RuleVehicleCondition = input.vehicle.condition === 'used' ? 'used' : 'new';
  return validateFinancingRequest({
    applicantType: input.info.applicantType,
    residency: residencyForInfo(input.info),
    vehicle: {
      price: Number(input.vehicle.price) || 0,
      condition,
      modelYear: input.vehicle.modelYear ?? null,
      category: input.vehicle.category ?? null,
    },
    tenureMonths: input.tenureMonths,
    downPaymentPct: input.downPaymentPct,
    offerTenureOptions: input.offerTenureOptions ?? null,
    offerMinDownPaymentPct: input.offerMinDownPaymentPct ?? null,
    enforceFinancingCaps: false,
    enforceIndividualsOnly: false,
  });
}

/** Human message for a rule code (`applyFlow.rule.*` carries the copy for every code). */
export function ruleViolationMessage(violation: ProductRuleViolation, t: IntakeTranslate = passthroughTranslate): string {
  return t(`applyFlow.rule.${violation.code}`, {
    defaultValue: violation.code.replace(/_/g, ' '),
    ...violation.params,
  });
}

/** Age-band warning (ELIG001) evaluated at the end of the tenure; null when in band or unknown. */
export function applicantAgeBandWarning(
  info: Pick<CustomerInfoFormValue, 'dateOfBirth' | 'residency' | 'qid'>,
  tenureMonths: number,
  t: IntakeTranslate = passthroughTranslate,
): string | null {
  const residency = residencyForInfo(info);
  const age = ageFromDateOfBirth(info.dateOfBirth);
  if (!residency || age == null) return null;
  const band = PRODUCT_RULES.applicant.ageAtContractEnd[residency];
  const ageAtEnd = age + tenureMonths / 12;
  if (ageAtEnd >= band.min && ageAtEnd <= band.max) return null;
  return t('dealerOps.plan.ageWarning', {
    defaultValue: 'The applicant would be {{age}} at the end of the tenure; the allowed band is {{min}}–{{max}}.',
    age: Math.floor(ageAtEnd),
    min: band.min,
    max: band.max,
  });
}
