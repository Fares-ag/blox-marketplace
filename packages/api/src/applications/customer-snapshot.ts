import { BadRequestException } from '@nestjs/common';
import {
  RESIDENCE_DURATION_OPTIONS,
  dateOfBirthMatchesQid,
  normalizeQid,
  parseQid,
  residencyFromNationality,
  type ParsedQid,
  type ResidencyClass,
} from '@drivemarket/shared/domain-rules';

/**
 * Customer snapshot — the shared shape stored on `Application.customerSnapshot`
 * (camelCase keys inside the JSON, `full_name`/`phone`/`qid` kept for the
 * partner CRM mapper and the contract generator). Every intake surface
 * (marketplace stepper, dealer wizard, mobile app, ops patch) is normalised
 * through `normalizeCustomerSnapshot` so residency and nationality are always
 * derived server-side from the Qatar ID and never trusted from the client.
 */

export const GENDER_VALUES = ['male', 'female', 'prefer_not_to_say'] as const;
export type GenderValue = (typeof GENDER_VALUES)[number];

export const APPLICANT_TYPES = ['individual', 'corporate'] as const;
export type ApplicantType = (typeof APPLICANT_TYPES)[number];

export const RESIDENCY_VALUES = ['qatari', 'expat'] as const;

export const GUARANTOR_RELATIONSHIPS = ['spouse', 'parent', 'sibling', 'other'] as const;
export type GuarantorRelationship = (typeof GUARANTOR_RELATIONSHIPS)[number];

export const RESIDENCE_DURATION_VALUES: readonly string[] = RESIDENCE_DURATION_OPTIONS.map((o) => o.value);

export type CustomerEmployment = {
  company?: string;
  jobTitle?: string;
  /** Legacy spelling of `jobTitle` still sent by older bundles. */
  position?: string;
  employmentType?: string;
  employmentDuration?: string;
  salary?: number;
};

export type CustomerGuarantor = {
  fullName?: string;
  qid?: string;
  phone?: string;
  relationship?: string;
  monthlyIncome?: number;
};

export type CustomerSnapshot = {
  full_name: string;
  phone: string;
  qid: string;
  email?: string;
  applicantType: ApplicantType;
  firstName?: string;
  lastName?: string;
  gender?: GenderValue;
  /** ISO date (YYYY-MM-DD). */
  dateOfBirth?: string;
  nationality?: string;
  residency?: ResidencyClass;
  residenceDuration?: string;
  city?: string;
  address?: Record<string, unknown>;
  employment?: string | CustomerEmployment;
  income?: number;
  monthlyIncome?: number;
  monthlyLiabilities?: number;
  hasGuarantor?: boolean;
  guarantor?: CustomerGuarantor;
  corporate?: Record<string, unknown>;
  [key: string]: unknown;
};

/**
 * What intake surfaces send: validated by the controller DTOs (class-validator)
 * and read here defensively, so it is typed loosely — every key is optional and
 * unknown keys (legacy address fields, dealer `employmentDetails`, …) survive.
 */
export type CustomerSnapshotInput = Record<string, unknown>;

/** Profile columns mirrored onto `User` when the customer provides them. */
export type CustomerProfileFields = {
  firstName?: string;
  lastName?: string;
  gender?: GenderValue;
  dateOfBirth?: Date;
  nationality?: string;
};

export type NormalizedCustomerSnapshot = {
  snapshot: CustomerSnapshot;
  parsedQid: ParsedQid;
  residency: ResidencyClass | null;
  /** From the typed date of birth, else from the QID. */
  birthYear: number | null;
  profile: CustomerProfileFields;
};

function str(value: unknown): string | undefined {
  if (value == null) return undefined;
  const s = String(value).trim();
  return s ? s : undefined;
}

function num(value: unknown): number | undefined {
  if (value == null || value === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

/** `YYYY-MM-DD` for a date-like value, or null when it cannot be parsed. */
export function isoDateOnly(value: unknown): string | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString().slice(0, 10);
  }
  const raw = str(value);
  if (!raw) return null;
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const [, y, m, d] = match;
  const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  if (
    Number.isNaN(date.getTime()) ||
    date.getUTCFullYear() !== Number(y) ||
    date.getUTCMonth() !== Number(m) - 1 ||
    date.getUTCDate() !== Number(d)
  ) {
    return null;
  }
  return `${y}-${m}-${d}`;
}

/** Reads a stored snapshot JSON without trusting its shape. */
export function readCustomerSnapshot(raw: unknown): CustomerSnapshot {
  const source = isRecord(raw) ? raw : {};
  return {
    ...source,
    full_name: str(source.full_name) ?? '',
    phone: str(source.phone) ?? '',
    qid: str(source.qid) ?? '',
    applicantType: source.applicantType === 'corporate' ? 'corporate' : 'individual',
  } as CustomerSnapshot;
}

export function employmentTypeOf(snapshot: CustomerSnapshotInput | null | undefined): string | null {
  if (!snapshot) return null;
  const employment = snapshot.employment;
  if (isRecord(employment)) return str(employment.employmentType) ?? null;
  if (typeof employment === 'string') return str(employment) ?? null;
  const details = snapshot.employmentDetails;
  if (isRecord(details)) return str(details.employmentType) ?? null;
  return null;
}

export function hasGuarantorOf(snapshot: CustomerSnapshotInput | null | undefined): boolean {
  if (!snapshot) return false;
  if (snapshot.hasGuarantor === true) return true;
  if (snapshot.hasGuarantor === false) return false;
  const guarantor = snapshot.guarantor;
  return isRecord(guarantor) && (!!str(guarantor.fullName) || !!str(guarantor.qid));
}

/** Residency class for a stored snapshot: QID first, then the stored value, then the nationality text. */
export function residencyOf(snapshot: CustomerSnapshotInput | null | undefined): ResidencyClass | null {
  if (!snapshot) return null;
  const parsed = parseQid(normalizeQid(str(snapshot.qid)));
  if (parsed.valid && parsed.residency) return parsed.residency;
  if (snapshot.residency === 'qatari' || snapshot.residency === 'expat') return snapshot.residency;
  return residencyFromNationality(str(snapshot.nationality));
}

/** Birth year from the typed date of birth, else from the QID. */
export function birthYearOf(snapshot: CustomerSnapshotInput | null | undefined): number | null {
  if (!snapshot) return null;
  const dob = isoDateOnly(snapshot.dateOfBirth);
  if (dob) return Number(dob.slice(0, 4));
  const parsed = parseQid(normalizeQid(str(snapshot.qid)));
  return parsed.valid ? parsed.birthYear : null;
}

/** Comparable form of a person's name: case, diacritics, punctuation and spacing folded. */
export function normalizePersonName(name: string | null | undefined): string {
  return String(name ?? '')
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeGuarantor(value: unknown): CustomerGuarantor | undefined {
  if (!isRecord(value)) return undefined;
  const out: CustomerGuarantor = { ...(value as CustomerGuarantor) };
  const fullName = str(value.fullName);
  const qid = str(value.qid);
  const phone = str(value.phone);
  const relationship = str(value.relationship);
  const monthlyIncome = num(value.monthlyIncome);
  if (fullName) out.fullName = fullName;
  if (qid) {
    const digits = normalizeQid(qid);
    out.qid = parseQid(digits).valid ? digits : qid;
  }
  if (phone) out.phone = phone;
  if (relationship) out.relationship = relationship;
  if (monthlyIncome !== undefined) out.monthlyIncome = monthlyIncome;
  return out;
}

/**
 * Validates and normalises an intake snapshot.
 *
 *   - `full_name` falls back to `firstName lastName`; name, phone and QID are
 *     mandatory unless `requireContact` is false (partial draft saves).
 *   - Residency and nationality are re-derived from the QID when it parses.
 *   - A typed date of birth that disagrees with the QID birth year is rejected
 *     with 400 `dob_qid_mismatch`.
 */
export function normalizeCustomerSnapshot(
  input: CustomerSnapshotInput,
  opts: { now?: Date; requireContact?: boolean } = {},
): NormalizedCustomerSnapshot {
  const source: Record<string, unknown> = isRecord(input) ? { ...input } : {};
  const firstName = str(source.firstName);
  const lastName = str(source.lastName);
  const fullName = str(source.full_name) ?? [firstName, lastName].filter(Boolean).join(' ');
  const phone = str(source.phone);
  const qidRaw = str(source.qid);
  if (opts.requireContact !== false && (!fullName || !phone || !qidRaw)) {
    throw new BadRequestException('validation_failed');
  }

  // Digits only for parsing so "2856 3412 345" is still a valid QID; anything
  // that is not a QID (a passport number, say) is kept verbatim.
  const qidDigits = normalizeQid(qidRaw);
  const parsedQid = parseQid(qidDigits, opts.now);
  const qid = parsedQid.valid ? qidDigits : (qidRaw ?? '');

  let dateOfBirth: string | undefined;
  if (source.dateOfBirth != null && source.dateOfBirth !== '') {
    const iso = isoDateOnly(source.dateOfBirth);
    if (!iso) throw new BadRequestException('validation_failed');
    dateOfBirth = iso;
  }
  if (dateOfBirth && parsedQid.valid && dateOfBirthMatchesQid(dateOfBirth, qid) === false) {
    throw new BadRequestException('dob_qid_mismatch');
  }

  const typedNationality = str(source.nationality);
  const nationality = parsedQid.valid && parsedQid.nationality ? parsedQid.nationality.en : typedNationality;
  const residency: ResidencyClass | null = parsedQid.valid
    ? parsedQid.residency
    : source.residency === 'qatari' || source.residency === 'expat'
      ? source.residency
      : residencyFromNationality(nationality);

  const gender = (GENDER_VALUES as readonly string[]).includes(String(source.gender))
    ? (source.gender as GenderValue)
    : undefined;
  const residenceDuration = RESIDENCE_DURATION_VALUES.includes(String(source.residenceDuration))
    ? String(source.residenceDuration)
    : undefined;
  const applicantType: ApplicantType = source.applicantType === 'corporate' ? 'corporate' : 'individual';

  const guarantor = normalizeGuarantor(source.guarantor);
  const hasGuarantor = hasGuarantorOf({
    hasGuarantor: typeof source.hasGuarantor === 'boolean' ? source.hasGuarantor : undefined,
    guarantor,
  });

  const snapshot: CustomerSnapshot = {
    ...source,
    full_name: fullName,
    phone: phone ?? '',
    qid,
    applicantType,
  } as CustomerSnapshot;

  const email = str(source.email);
  if (email) snapshot.email = email.toLowerCase();
  else delete snapshot.email;
  if (firstName) snapshot.firstName = firstName;
  if (lastName) snapshot.lastName = lastName;
  if (gender) snapshot.gender = gender;
  else delete snapshot.gender;
  if (dateOfBirth) snapshot.dateOfBirth = dateOfBirth;
  else delete snapshot.dateOfBirth;
  if (nationality) snapshot.nationality = nationality;
  else delete snapshot.nationality;
  if (residency) snapshot.residency = residency;
  else delete snapshot.residency;
  if (residenceDuration) snapshot.residenceDuration = residenceDuration;
  else delete snapshot.residenceDuration;

  const income = num(source.income);
  const monthlyIncome = num(source.monthlyIncome);
  const monthlyLiabilities = num(source.monthlyLiabilities);
  if (income !== undefined) snapshot.income = income;
  else delete snapshot.income;
  if (monthlyIncome !== undefined) snapshot.monthlyIncome = monthlyIncome;
  else if (income !== undefined) snapshot.monthlyIncome = income;
  else delete snapshot.monthlyIncome;
  if (monthlyLiabilities !== undefined) snapshot.monthlyLiabilities = monthlyLiabilities;
  else delete snapshot.monthlyLiabilities;

  if (isRecord(source.employment)) {
    const employment = { ...(source.employment as CustomerEmployment) };
    const salary = num(employment.salary);
    if (salary !== undefined) employment.salary = salary;
    else delete employment.salary;
    snapshot.employment = employment;
  }

  snapshot.hasGuarantor = hasGuarantor;
  if (hasGuarantor && guarantor) snapshot.guarantor = guarantor;
  else delete snapshot.guarantor;

  const profile: CustomerProfileFields = {};
  if (firstName) profile.firstName = firstName;
  if (lastName) profile.lastName = lastName;
  if (gender) profile.gender = gender;
  if (dateOfBirth) profile.dateOfBirth = new Date(`${dateOfBirth}T00:00:00.000Z`);
  if (nationality) profile.nationality = nationality;

  return {
    snapshot,
    parsedQid,
    residency,
    birthYear: dateOfBirth ? Number(dateOfBirth.slice(0, 4)) : parsedQid.valid ? parsedQid.birthYear : null,
    profile,
  };
}

/**
 * Deep copy without the keys whose value is `undefined`.
 *
 * Bodies validated by class-transformer are class instances on which every
 * declared property exists, so a field the client left out still shows up as
 * `undefined`. Spreading such an object over stored data would blank the
 * stored values, which is never what a partial save means.
 */
export function stripUndefinedDeep<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => stripUndefinedDeep(item)) as unknown as T;
  }
  if (!value || typeof value !== 'object') return value;
  // Values that are objects but not records get passed through whole. Nested
  // DTO instances must NOT be exempted here: class-transformer builds the
  // address, employment and guarantor objects as class instances too, and they
  // carry the same `undefined` placeholders as the root.
  if (value instanceof Date || value instanceof RegExp || Buffer.isBuffer(value)) return value;

  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (item === undefined) continue;
    out[key] = stripUndefinedDeep(item);
  }
  return out as T;
}
