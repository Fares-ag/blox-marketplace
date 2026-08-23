/** Customer snapshot shape aligned with blox-vercel ExtendedCustomerInformation. */
export type ApplicantType = 'individual' | 'corporate';

export type CustomerAddress = {
  street?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
};

export type CustomerEmployment = {
  company?: string;
  position?: string;
  employmentType?: string;
  employmentDuration?: string;
  salary?: number;
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
  dateOfBirth: string;
  nationality: string;
  qid: string;
  address: CustomerAddress;
  employment: CustomerEmployment;
  monthlyIncome: number;
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

export const INDIVIDUAL_DOC_CATEGORIES = ['id', 'passport', 'license', 'salary', 'bank', 'other'] as const;
export const CORPORATE_DOC_CATEGORIES = ['cr', 'computer_card', 'rental_agreement', 'signatory_id'] as const;

export type IndividualDocCategory = (typeof INDIVIDUAL_DOC_CATEGORIES)[number];
export type CorporateDocCategory = (typeof CORPORATE_DOC_CATEGORIES)[number];

export function emptyCustomerInfo(): CustomerInfoFormValue {
  return {
    applicantType: 'individual',
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    dateOfBirth: '',
    nationality: '',
    qid: '',
    address: { street: '', city: '', country: '', postalCode: '', state: '' },
    employment: {
      company: '',
      position: '',
      employmentType: '',
      employmentDuration: '',
      salary: 0,
    },
    monthlyIncome: 0,
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

export function customerInfoFromSnapshot(raw: Record<string, unknown> | undefined | null): CustomerInfoFormValue {
  const base = emptyCustomerInfo();
  if (!raw) return base;

  const applicantType: ApplicantType = raw.applicantType === 'corporate' ? 'corporate' : 'individual';
  const employmentRaw = raw.employment;
  const employmentObj: CustomerEmployment =
    typeof employmentRaw === 'string'
      ? { company: employmentRaw }
      : employmentRaw && typeof employmentRaw === 'object'
        ? (employmentRaw as CustomerEmployment)
        : {};
  const address = (raw.address as CustomerAddress | undefined) ?? {};
  const incomeRaw = raw.income ?? raw.monthlyIncome ?? employmentObj.salary;
  const corp = (raw.corporate as CorporateApplicantInfo | undefined) ?? {};

  const fullName = String(raw.full_name ?? '').trim();
  const nameParts = fullName.split(/\s+/).filter(Boolean);

  return {
    applicantType,
    firstName: String(raw.firstName ?? nameParts[0] ?? ''),
    lastName: String(raw.lastName ?? nameParts.slice(1).join(' ') ?? ''),
    email: String(raw.email ?? ''),
    phone: String(raw.phone ?? ''),
    dateOfBirth: String(raw.dateOfBirth ?? ''),
    nationality: String(raw.nationality ?? ''),
    qid: String(raw.qid ?? ''),
    address: {
      street: String(address.street ?? raw.street ?? ''),
      city: String(address.city ?? raw.city ?? ''),
      country: String(address.country ?? raw.country ?? ''),
      postalCode: String(address.postalCode ?? raw.postalCode ?? ''),
      state: String(address.state ?? ''),
    },
    employment: {
      company: String(employmentObj.company ?? ''),
      position: String(employmentObj.position ?? ''),
      employmentType: String(employmentObj.employmentType ?? ''),
      employmentDuration: String(employmentObj.employmentDuration ?? ''),
      salary: Number(employmentObj.salary ?? incomeRaw ?? 0) || 0,
    },
    monthlyIncome: Number(raw.monthlyIncome ?? incomeRaw ?? employmentObj.salary ?? 0) || 0,
    corporate: {
      legalName: String(corp.legalName ?? ''),
      crNumber: String(corp.crNumber ?? ''),
      tradeName: String(corp.tradeName ?? ''),
      industry: String(corp.industry ?? ''),
      registeredAddress: {
        street: String(corp.registeredAddress?.street ?? ''),
        city: String(corp.registeredAddress?.city ?? ''),
        country: String(corp.registeredAddress?.country ?? ''),
        postalCode: String(corp.registeredAddress?.postalCode ?? ''),
        state: String(corp.registeredAddress?.state ?? ''),
      },
      authorizedSignatory: {
        firstName: String(corp.authorizedSignatory?.firstName ?? ''),
        lastName: String(corp.authorizedSignatory?.lastName ?? ''),
        email: String(corp.authorizedSignatory?.email ?? raw.email ?? ''),
        phone: String(corp.authorizedSignatory?.phone ?? raw.phone ?? ''),
        qid: String(corp.authorizedSignatory?.qid ?? raw.qid ?? ''),
        nationality: String(corp.authorizedSignatory?.nationality ?? ''),
        position: String(corp.authorizedSignatory?.position ?? ''),
      },
    },
  };
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

  const full_name = `${value.firstName} ${value.lastName}`.trim() || value.email;
  return {
    applicantType: 'individual',
    firstName: value.firstName.trim(),
    lastName: value.lastName.trim(),
    full_name,
    email: value.email.trim().toLowerCase(),
    phone: value.phone.trim(),
    qid: value.qid.trim(),
    dateOfBirth: value.dateOfBirth || undefined,
    nationality: value.nationality || undefined,
    address: value.address,
    street: value.address.street,
    city: value.address.city,
    country: value.address.country,
    postalCode: value.address.postalCode,
    employment: {
      company: value.employment.company,
      position: value.employment.position,
      employmentType: value.employment.employmentType,
      employmentDuration: value.employment.employmentDuration,
      salary: value.monthlyIncome || value.employment.salary,
    },
    income: value.monthlyIncome,
    monthlyIncome: value.monthlyIncome,
  };
}

export function validateCustomerInfo(value: CustomerInfoFormValue): string | null {
  if (value.applicantType === 'corporate') {
    const corp = value.corporate;
    const sig = corp.authorizedSignatory;
    if (!corp.legalName?.trim()) return 'Company legal name is required.';
    if (!sig?.email?.trim()) return 'Authorized signatory email is required.';
    if (!sig?.phone?.trim()) return 'Authorized signatory phone is required.';
    if (!sig?.qid?.trim() || !/^\d{11}$/.test(sig.qid.trim())) return 'Authorized signatory QID must be 11 digits.';
    return null;
  }
  if (!value.firstName.trim() || !value.lastName.trim()) return 'First and last name are required.';
  if (!value.email.trim()) return 'Email is required.';
  if (!value.phone.trim()) return 'Phone is required.';
  if (!value.qid.trim() || !/^\d{11}$/.test(value.qid.trim())) return 'QID must be 11 digits.';
  return null;
}

export function docCategoriesForApplicant(type: ApplicantType): readonly string[] {
  return type === 'corporate' ? CORPORATE_DOC_CATEGORIES : INDIVIDUAL_DOC_CATEGORIES;
}
