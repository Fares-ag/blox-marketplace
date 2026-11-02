/** Dealer SAP / ERP customer number — stored on the application, not the snapshot. */
export const SAP_NUMBER_MAX_LENGTH = 40;

/**
 * Contract series prefixes used by credit when recording the lender contract
 * number (RSK / RA / Ru / RV / FU / FSK).
 */
export const CONTRACT_SERIES = ['RSK', 'RA', 'Ru', 'RV', 'FU', 'FSK'] as const;
export type ContractSeries = (typeof CONTRACT_SERIES)[number];
export const CONTRACT_NUMBER_MAX_LENGTH = 40;
/** Lender contract numbers are numeric only (series prefix is stored separately). */
export const CONTRACT_NUMBER_PATTERN = /^\d+$/;

export function contractNumberValidationError(value: unknown): 'empty' | 'invalid' | null {
  if (value == null || (typeof value === 'string' && !value.trim())) return null;
  if (typeof value !== 'string') return 'invalid';
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > CONTRACT_NUMBER_MAX_LENGTH) return 'invalid';
  return CONTRACT_NUMBER_PATTERN.test(trimmed) ? null : 'invalid';
}

export function isContractSeries(value: unknown): value is ContractSeries {
  return typeof value === 'string' && (CONTRACT_SERIES as readonly string[]).includes(value);
}

/** Maps credit shorthand (RU) onto the stored series `Ru`. Other values pass through trimmed. */
export function normalizeContractSeries(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.toUpperCase() === 'RU') return 'Ru';
  return trimmed;
}

export function formatContractRef(series?: string | null, number?: string | null): string | null {
  const prefix = series?.trim() ?? '';
  const n = number?.trim() ?? '';
  if (!prefix && !n) return null;
  if (prefix && n) return `${prefix}-${n}`;
  return prefix || n;
}

/**
 * Things credit can ask a dealer to fix on resubmission. Each key maps to
 * applicant-profile fields, plan fields, or document slots so the dealer
 * workspace can highlight them.
 */
export const RESUBMISSION_ITEM_KEYS = [
  'identity',
  'contact',
  'address',
  'employment',
  'income',
  'guarantor',
  'plan',
  'qid_front',
  'qid_back',
  'salary',
  'bank',
  'quotation',
  'other_docs',
] as const;

export type ResubmissionItemKey = (typeof RESUBMISSION_ITEM_KEYS)[number];

const RESUBMISSION_KEY_SET = new Set<string>(RESUBMISSION_ITEM_KEYS);

export function isResubmissionItemKey(value: unknown): value is ResubmissionItemKey {
  return typeof value === 'string' && RESUBMISSION_KEY_SET.has(value);
}

export function parseResubmissionItems(value: unknown): ResubmissionItemKey[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<ResubmissionItemKey>();
  const out: ResubmissionItemKey[] = [];
  for (const item of value) {
    if (!isResubmissionItemKey(item) || seen.has(item)) continue;
    seen.add(item);
    out.push(item);
  }
  return out;
}

const INFO_HIGHLIGHTS: Record<ResubmissionItemKey, readonly string[]> = {
  identity: ['firstName', 'lastName', 'gender', 'dateOfBirth', 'qid', 'nationality', 'residency', 'residenceDuration', 'legalName', 'crNumber'],
  contact: ['email', 'phone'],
  address: ['address', 'street', 'city', 'area', 'zone', 'poBox', 'country', 'postalCode'],
  employment: ['employment', 'companyName', 'position', 'employmentType', 'employmentDuration'],
  income: ['monthlyIncome', 'monthlyLiabilities'],
  guarantor: ['guarantor'],
  plan: [],
  qid_front: [],
  qid_back: [],
  salary: [],
  bank: [],
  quotation: [],
  other_docs: [],
};

const DOC_HIGHLIGHTS: Record<ResubmissionItemKey, readonly string[]> = {
  identity: ['qid_front', 'qid', 'qid_back'],
  contact: [],
  address: [],
  employment: [],
  income: [],
  guarantor: [],
  plan: [],
  qid_front: ['qid_front', 'qid'],
  qid_back: ['qid_back'],
  salary: ['salary'],
  bank: ['bank', 'business_bank', 'bank_liability'],
  quotation: ['vehicle_quotation'],
  other_docs: ['other', 'national_address', 'cr', 'trade_license', 'selfie'],
};

export function resubmissionHighlights(items: unknown): {
  info: Set<string>;
  docs: Set<string>;
  plan: boolean;
  keys: ResubmissionItemKey[];
} {
  const keys = parseResubmissionItems(items);
  const info = new Set<string>();
  const docs = new Set<string>();
  let plan = false;
  for (const key of keys) {
    for (const field of INFO_HIGHLIGHTS[key]) info.add(field);
    for (const category of DOC_HIGHLIGHTS[key]) docs.add(category);
    if (key === 'plan') plan = true;
  }
  return { info, docs, plan, keys };
}

export function resubmissionItemLabelKey(key: ResubmissionItemKey): string {
  return `ops.workspace.resubmitItem.${key}`;
}
