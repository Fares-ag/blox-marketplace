/**
 * Pure form model for the guided apply stepper: field shape, snapshot mapping
 * (both directions), plan pricing and per-step validation. No React, no I/O,
 * so it can be unit-tested and shared by the step components and the page.
 *
 * Validation returns translation keys (`applyFlow.error.*`) rather than text so
 * the components decide how and when to render them.
 */
import {
  allowedTenureOptions,
  assessCredit,
  buildPricingSnapshot,
  dateOfBirthMatchesQid,
  employerCategoryFromEmploymentType,
  minDownPaymentPctFor,
  tenureBounds,
  downPaymentBounds,
  isValidQatarPhone,
  normalizeQid,
  parseQid,
  validateFinancingRequest,
  type CreditAssessment,
  type DocumentSlot,
  type DocumentSlotProfile,
  type ParsedQid,
  type PricingSnapshot,
  type ProductRuleViolation,
  type ResidencyClass,
  type RuleVehicleCondition,
} from '@drivemarket/shared';

export const APPLY_STEPS = ['vehicle', 'identity', 'employment', 'guarantor', 'documents', 'consents', 'review'] as const;
export type ApplyStep = (typeof APPLY_STEPS)[number];
export const APPLY_STEP_COUNT = APPLY_STEPS.length;

export function stepIndex(step: ApplyStep): number {
  return APPLY_STEPS.indexOf(step);
}

export type GenderValue = '' | 'male' | 'female';
export type GuarantorRelationship = '' | 'spouse' | 'parent' | 'sibling' | 'other';

export const GENDER_OPTIONS: ReadonlyArray<{ value: Exclude<GenderValue, ''>; labelKey: string }> = [
  { value: 'male', labelKey: 'applyFlow.identity.genderMale' },
  { value: 'female', labelKey: 'applyFlow.identity.genderFemale' },
];

export const GUARANTOR_RELATIONSHIP_OPTIONS: ReadonlyArray<{ value: Exclude<GuarantorRelationship, ''>; labelKey: string }> = [
  { value: 'spouse', labelKey: 'applyFlow.guarantor.relationshipSpouse' },
  { value: 'parent', labelKey: 'applyFlow.guarantor.relationshipParent' },
  { value: 'sibling', labelKey: 'applyFlow.guarantor.relationshipSibling' },
  { value: 'other', labelKey: 'applyFlow.guarantor.relationshipOther' },
];

export type GuarantorForm = {
  fullName: string;
  qid: string;
  phone: string;
  relationship: GuarantorRelationship;
  monthlyIncome: string;
};

export type ApplyForm = {
  firstName: string;
  lastName: string;
  gender: GenderValue;
  /** ISO date `YYYY-MM-DD` (native date input value). */
  dateOfBirth: string;
  qid: string;
  /** Free-text nationality, only used when the QID's country code is not in our table. */
  nationality: string;
  residenceDuration: string;
  phone: string;
  email: string;
  city: string;
  employer: string;
  employmentType: string;
  employmentDuration: string;
  /** Kept as strings so the inputs stay controlled while typing. */
  monthlyIncome: string;
  monthlyLiabilities: string;
  hasGuarantor: boolean;
  guarantor: GuarantorForm;
};

export type ApplyPlan = { tenure: number; downPct: number };

/** Everything the plan step needs to know about the listing and its offer. */
export type PlanContext = {
  price: number;
  condition: RuleVehicleCondition;
  modelYear: number | null;
  annualRatePercent: number;
  offerTenureOptions: number[];
  offerMinDownPct: number;
};

export type FieldErrors = Record<string, string>;

export function emptyGuarantor(): GuarantorForm {
  return { fullName: '', qid: '', phone: '', relationship: '', monthlyIncome: '' };
}

export function emptyApplyForm(): ApplyForm {
  return {
    firstName: '',
    lastName: '',
    gender: '',
    dateOfBirth: '',
    qid: '',
    nationality: '',
    residenceDuration: '',
    phone: '',
    email: '',
    city: '',
    employer: '',
    employmentType: '',
    employmentDuration: '',
    monthlyIncome: '',
    monthlyLiabilities: '',
    hasGuarantor: false,
    guarantor: emptyGuarantor(),
  };
}

export type AccountPrefill = {
  fullName?: string | null;
  phone?: string | null;
  email?: string | null;
  qid?: string | null;
};

/** Seed empty identity fields from the signed-in account; never overwrites typed values. */
export function prefillFromAccount(form: ApplyForm, account: AccountPrefill | null | undefined): ApplyForm {
  if (!account) return form;
  const next = { ...form };
  const name = (account.fullName ?? '').trim();
  if (name && !next.firstName && !next.lastName) {
    const parts = name.split(/\s+/).filter(Boolean);
    next.firstName = parts[0] ?? '';
    next.lastName = parts.slice(1).join(' ');
  }
  if (!next.phone && account.phone) next.phone = account.phone;
  if (!next.email && account.email) next.email = account.email;
  if (!next.qid && account.qid) next.qid = normalizeQid(account.qid);
  return next;
}

function str(value: unknown): string {
  return value == null ? '' : String(value);
}

function numStr(value: unknown): string {
  if (value == null || value === '') return '';
  const n = Number(value);
  return Number.isFinite(n) && n !== 0 ? String(n) : n === 0 ? '0' : '';
}

/** Rebuild the form from a stored `customer_snapshot` (resume flow). */
export function formFromSnapshot(raw: Record<string, unknown> | null | undefined): ApplyForm {
  const form = emptyApplyForm();
  if (!raw) return form;

  const fullName = str(raw.full_name).trim();
  const parts = fullName.split(/\s+/).filter(Boolean);
  form.firstName = str(raw.firstName) || parts[0] || '';
  form.lastName = str(raw.lastName) || parts.slice(1).join(' ');
  const gender = str(raw.gender);
  form.gender = gender === 'male' || gender === 'female' ? gender : '';
  form.dateOfBirth = str(raw.dateOfBirth).slice(0, 10);
  form.qid = normalizeQid(str(raw.qid));
  // The free-text nationality only exists for QIDs whose country code we cannot
  // read; a known code always wins, so do not echo the derived value back.
  const parsedQid = parseQid(form.qid);
  form.nationality = parsedQid.valid && parsedQid.nationality ? '' : str(raw.nationality);
  form.residenceDuration = str(raw.residenceDuration);
  form.phone = str(raw.phone);
  form.email = str(raw.email);
  const address = (raw.address as { city?: unknown } | undefined) ?? {};
  form.city = str(raw.city) || str(address.city);

  const employment = raw.employment;
  if (typeof employment === 'string') {
    form.employer = employment;
  } else if (employment && typeof employment === 'object') {
    const e = employment as Record<string, unknown>;
    form.employer = str(e.company);
    form.employmentType = str(e.employmentType);
    form.employmentDuration = str(e.employmentDuration);
    form.monthlyIncome = numStr(e.salary);
  }
  form.monthlyIncome = numStr(raw.monthlyIncome) || numStr(raw.income) || form.monthlyIncome;
  form.monthlyLiabilities = numStr(raw.monthlyLiabilities);

  const guarantor = raw.guarantor as Record<string, unknown> | undefined;
  form.hasGuarantor = Boolean(raw.hasGuarantor) || (!!guarantor && !!str(guarantor.fullName));
  if (guarantor && typeof guarantor === 'object') {
    const rel = str(guarantor.relationship);
    form.guarantor = {
      fullName: str(guarantor.fullName),
      qid: normalizeQid(str(guarantor.qid)),
      phone: str(guarantor.phone),
      relationship: rel === 'spouse' || rel === 'parent' || rel === 'sibling' || rel === 'other' ? rel : '',
      monthlyIncome: numStr(guarantor.monthlyIncome),
    };
  }
  return form;
}

/** Tenure / down payment from a stored `pricing_snapshot`, if it carries them. */
export function planFromPricingSnapshot(raw: Record<string, unknown> | null | undefined): ApplyPlan | null {
  if (!raw) return null;
  const tenure = Number(raw.tenor ?? raw.tenure ?? 0);
  const downPct = Number(raw.down_payment_pct ?? NaN);
  if (!tenure || !Number.isFinite(downPct)) return null;
  return { tenure, downPct };
}

export type DerivedIdentity = {
  parsed: ParsedQid;
  residency: ResidencyClass | null;
  /** Localised nationality name when the QID's country code is known. */
  nationalityLabel: string | null;
  /** English nationality name stored on the snapshot; falls back to the typed value. */
  nationalityValue: string;
  nationalityKnown: boolean;
  dobMatch: boolean | null;
  age: number | null;
};

export function ageFromIsoDate(dateOfBirth: string, now: Date = new Date()): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) return null;
  const dob = new Date(`${dateOfBirth}T00:00:00`);
  if (Number.isNaN(dob.getTime())) return null;
  let age = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age -= 1;
  return age;
}

export function deriveIdentity(form: ApplyForm, locale: 'en' | 'ar', now: Date = new Date()): DerivedIdentity {
  const parsed = parseQid(normalizeQid(form.qid), now);
  const known = parsed.valid && parsed.nationality != null;
  return {
    parsed,
    residency: parsed.valid ? parsed.residency : null,
    nationalityLabel: known ? parsed.nationality![locale] : null,
    nationalityValue: known ? parsed.nationality!.en : form.nationality.trim(),
    nationalityKnown: known,
    dobMatch: parsed.valid ? dateOfBirthMatchesQid(form.dateOfBirth || null, parsed.qid) : null,
    age: ageFromIsoDate(form.dateOfBirth, now),
  };
}

export function isValidPhone(value: string): boolean {
  return isValidQatarPhone(value);
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
}

/** Parses a typed amount ("12,500" / "12500.50"); null when not a non-negative number. */
export function parseAmount(value: string): number | null {
  const compact = value.replace(/[,\s]/g, '');
  if (compact === '') return null;
  const n = Number(compact);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

const MIN_APPLICANT_AGE = 18;
const MAX_APPLICANT_AGE = 80;

export function validateIdentity(form: ApplyForm, now: Date = new Date()): FieldErrors {
  const errors: FieldErrors = {};
  if (!form.firstName.trim()) errors.firstName = 'applyFlow.error.required';
  if (!form.lastName.trim()) errors.lastName = 'applyFlow.error.required';
  if (!form.gender) errors.gender = 'applyFlow.error.required';

  const parsed = parseQid(normalizeQid(form.qid), now);
  if (!form.qid.trim()) errors.qid = 'applyFlow.error.required';
  else if (!parsed.valid) errors.qid = 'applyFlow.error.invalidQid';

  if (!form.dateOfBirth) {
    errors.dateOfBirth = 'applyFlow.error.required';
  } else {
    const age = ageFromIsoDate(form.dateOfBirth, now);
    if (age == null) errors.dateOfBirth = 'applyFlow.error.invalidDob';
    else if (age < MIN_APPLICANT_AGE || age > MAX_APPLICANT_AGE) errors.dateOfBirth = 'applyFlow.error.ageRange';
    else if (parsed.valid && dateOfBirthMatchesQid(form.dateOfBirth, parsed.qid) === false) {
      errors.dateOfBirth = 'applyFlow.identity.dobMismatch';
    }
  }

  if (parsed.valid && !parsed.nationality && !form.nationality.trim()) errors.nationality = 'applyFlow.error.required';
  if (parsed.valid && parsed.residency === 'expat' && !form.residenceDuration) {
    errors.residenceDuration = 'applyFlow.error.required';
  }

  if (!form.phone.trim()) errors.phone = 'applyFlow.error.required';
  else if (!isValidPhone(form.phone)) errors.phone = 'applyFlow.error.invalidPhone';

  if (form.email.trim() && !isValidEmail(form.email)) errors.email = 'applyFlow.error.invalidEmail';
  return errors;
}

export function validateEmployment(form: ApplyForm): FieldErrors {
  const errors: FieldErrors = {};
  if (!form.employer.trim()) errors.employer = 'applyFlow.error.required';
  if (!form.employmentType) errors.employmentType = 'applyFlow.error.required';
  if (!form.employmentDuration) errors.employmentDuration = 'applyFlow.error.required';
  const income = parseAmount(form.monthlyIncome);
  if (income == null || income <= 0) errors.monthlyIncome = 'applyFlow.error.invalidAmount';
  if (form.monthlyLiabilities.trim() && parseAmount(form.monthlyLiabilities) == null) {
    errors.monthlyLiabilities = 'applyFlow.error.invalidAmount';
  }
  return errors;
}

export function validateGuarantor(form: ApplyForm, now: Date = new Date()): FieldErrors {
  const errors: FieldErrors = {};
  if (!form.hasGuarantor) return errors;
  const g = form.guarantor;
  if (!g.fullName.trim()) errors['guarantor.fullName'] = 'applyFlow.error.required';
  if (!g.qid.trim()) errors['guarantor.qid'] = 'applyFlow.error.required';
  else if (!parseQid(normalizeQid(g.qid), now).valid) errors['guarantor.qid'] = 'applyFlow.error.invalidQid';
  if (!g.phone.trim()) errors['guarantor.phone'] = 'applyFlow.error.required';
  else if (!isValidPhone(g.phone)) errors['guarantor.phone'] = 'applyFlow.error.invalidPhone';
  if (!g.relationship) errors['guarantor.relationship'] = 'applyFlow.error.required';
  if (g.monthlyIncome.trim() && parseAmount(g.monthlyIncome) == null) {
    errors['guarantor.monthlyIncome'] = 'applyFlow.error.invalidAmount';
  }
  return errors;
}

export function planTenureOptions(ctx: PlanContext, residency: ResidencyClass | null): number[] {
  return allowedTenureOptions(residency, ctx.offerTenureOptions);
}

export function planMinDownPct(ctx: PlanContext): number {
  return minDownPaymentPctFor(ctx.condition, ctx.offerMinDownPct);
}

export function planViolations(plan: ApplyPlan, ctx: PlanContext, residency: ResidencyClass | null, now?: Date): ProductRuleViolation[] {
  return validateFinancingRequest({
    applicantType: 'individual',
    residency,
    vehicle: { price: ctx.price, condition: ctx.condition, category: 'car', modelYear: ctx.modelYear },
    tenureMonths: plan.tenure,
    downPaymentPct: plan.downPct,
    offerTenureOptions: ctx.offerTenureOptions.length ? ctx.offerTenureOptions : null,
    offerMinDownPaymentPct: ctx.offerMinDownPct,
    now,
  });
}

export function buildPlanPricing(plan: ApplyPlan, ctx: PlanContext): PricingSnapshot {
  return buildPricingSnapshot({
    listPrice: ctx.price,
    annualRatePercent: ctx.annualRatePercent,
    // Price the contribution the customer actually chose; the recommended
    // minimum only pre-fills the form.
    minDownPaymentPct: downPaymentBounds().min,
    tenureMonths: plan.tenure,
    downPaymentPct: plan.downPct,
  });
}

/**
 * Keep a plan inside the bands the product actually accepts: any whole month
 * between 3 and 60, and any down payment between 0% and 90%. Tenures outside
 * the offer's presets and contributions under the recommended minimum are
 * allowed here — they surface as review flags, not as blocks.
 */
export function normalizePlan(plan: ApplyPlan, ctx: PlanContext, _residency?: ResidencyClass | null): { plan: ApplyPlan; adjusted: boolean } {
  const tenureBand = tenureBounds();
  const downBand = downPaymentBounds();
  const requested = Number.isFinite(plan.tenure) ? Math.round(plan.tenure) : planMinDownPct(ctx);
  const tenure = Math.min(Math.max(requested, tenureBand.min), tenureBand.max);
  const requestedDown = Number.isFinite(plan.downPct) ? plan.downPct : planMinDownPct(ctx);
  const downPct = Math.min(Math.max(requestedDown, downBand.min), downBand.max);
  const adjusted = tenure !== plan.tenure || downPct !== plan.downPct;
  return { plan: { tenure, downPct }, adjusted };
}

export function validateStep(
  step: ApplyStep,
  form: ApplyForm,
  plan: ApplyPlan,
  ctx: PlanContext | null,
  residency: ResidencyClass | null,
  now: Date = new Date(),
): FieldErrors {
  switch (step) {
    case 'vehicle': {
      if (!ctx) return { plan: 'applyFlow.error.listingUnavailable' };
      const hard = planViolations(plan, ctx, residency, now).some((v) => v.severity === 'hard');
      return hard ? { plan: 'applyFlow.error.ruleViolation' } : {};
    }
    case 'identity':
      return validateIdentity(form, now);
    case 'employment':
      return validateEmployment(form);
    case 'guarantor':
      return validateGuarantor(form, now);
    default:
      return {};
  }
}

export function documentProfile(form: ApplyForm, residency: ResidencyClass | null): DocumentSlotProfile {
  return {
    residency,
    employmentType: form.employmentType || null,
    hasGuarantor: form.hasGuarantor,
    applicantType: 'individual',
  };
}

function compact<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined || value === null || value === '') continue;
    out[key] = value;
  }
  return out as Partial<T>;
}

/**
 * The `customerSnapshot` the API stores. Keys follow the shared snapshot shape
 * (camelCase inside the JSON, `full_name`/`phone`/`qid` legacy names kept).
 * Empty values are omitted so the DTO whitelist never sees stray fields.
 */
export function snapshotFromForm(form: ApplyForm, derived: DerivedIdentity): Record<string, unknown> {
  const firstName = form.firstName.trim();
  const lastName = form.lastName.trim();
  const income = parseAmount(form.monthlyIncome) ?? undefined;
  const liabilities = form.monthlyLiabilities.trim() ? (parseAmount(form.monthlyLiabilities) ?? undefined) : 0;
  const city = form.city.trim();

  const employment = compact({
    company: form.employer.trim(),
    employmentType: form.employmentType,
    employmentDuration: form.employmentDuration,
    salary: income,
  });

  const guarantor = form.hasGuarantor
    ? compact({
        fullName: form.guarantor.fullName.trim(),
        qid: normalizeQid(form.guarantor.qid),
        phone: form.guarantor.phone.trim(),
        relationship: form.guarantor.relationship,
        monthlyIncome: form.guarantor.monthlyIncome.trim() ? (parseAmount(form.guarantor.monthlyIncome) ?? undefined) : undefined,
      })
    : undefined;

  return compact({
    full_name: `${firstName} ${lastName}`.trim(),
    phone: form.phone.trim(),
    qid: normalizeQid(form.qid),
    email: form.email.trim().toLowerCase() || undefined,
    applicantType: 'individual',
    firstName,
    lastName,
    gender: form.gender || undefined,
    dateOfBirth: form.dateOfBirth || undefined,
    nationality: derived.nationalityValue || undefined,
    residency: derived.residency ?? undefined,
    residenceDuration: derived.residency === 'expat' ? form.residenceDuration || undefined : undefined,
    city: city || undefined,
    address: city ? { city } : undefined,
    employment,
    income,
    monthlyIncome: income,
    monthlyLiabilities: liabilities,
    hasGuarantor: form.hasGuarantor,
    guarantor,
  });
}

/**
 * Informational credit preview for the review step: the same `assessCredit`
 * the credit officer's screen runs, fed from the form. With a guarantor income
 * the assessment carries both the "income alone" and "with guarantor" views.
 * Null until the plan is priced; incomplete income yields a `refer` preview
 * with `affordability_unknown`, which the UI explains rather than hides.
 */
export function creditPreviewFor(
  form: ApplyForm,
  residency: ResidencyClass | null,
  pricing: PricingSnapshot | null,
  violations: ProductRuleViolation[],
  now: Date = new Date(),
): CreditAssessment | null {
  if (!pricing || !(pricing.list_price > 0)) return null;
  const income = parseAmount(form.monthlyIncome) ?? 0;
  const liabilities = parseAmount(form.monthlyLiabilities) ?? 0;
  const installment = Number(pricing.monthly) || 0;
  const financedAmount = Math.max(pricing.list_price - pricing.down_payment, 0);
  const affordability =
    income > 0 && installment > 0
      ? {
          monthlyIncome: income,
          monthlyLiabilities: liabilities,
          proposedInstallment: installment,
          residency: residency ?? 'expat',
          employerCategory: employerCategoryFromEmploymentType(form.employmentType),
          financedAmount,
        }
      : null;
  const guarantorIncome = form.hasGuarantor ? (parseAmount(form.guarantor.monthlyIncome) ?? 0) : 0;
  return assessCredit(
    {
      affordability,
      financedAmount,
      vehicleCategory: 'car',
      ruleFlags: violations,
      guarantorMonthlyIncome: guarantorIncome > 0 ? guarantorIncome : null,
    },
    now,
  );
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Categories whose newest upload is older than the slot allows. The API's own
 * `stale` list wins when present; the date maths covers builds where the slots
 * endpoint predates the freshness rule.
 */
export function staleDocumentCategories(
  slots: DocumentSlot[],
  uploadedAt: Record<string, string>,
  serverStale: Iterable<string> = [],
  now: Date = new Date(),
): string[] {
  const stale = new Set<string>(serverStale);
  for (const slot of slots) {
    if (!slot.maxAgeDays) continue;
    const at = uploadedAt[slot.category];
    if (!at) continue;
    const uploaded = new Date(at);
    if (Number.isNaN(uploaded.getTime())) continue;
    const ageDays = (now.getTime() - uploaded.getTime()) / DAY_MS;
    if (ageDays > slot.maxAgeDays) stale.add(slot.category);
  }
  return slots.map((s) => s.category).filter((c) => stale.has(c));
}

/** First step whose data is still incomplete — where a resumed draft should reopen. */
export function firstIncompleteStep(
  form: ApplyForm,
  plan: ApplyPlan,
  ctx: PlanContext | null,
  residency: ResidencyClass | null,
  now: Date = new Date(),
): ApplyStep {
  for (const step of ['vehicle', 'identity', 'employment', 'guarantor'] as const) {
    if (Object.keys(validateStep(step, form, plan, ctx, residency, now)).length) return step;
  }
  return 'documents';
}
