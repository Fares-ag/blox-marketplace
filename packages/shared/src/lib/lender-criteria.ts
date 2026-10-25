/**
 * Lender-specific overlays on top of Blox PRODUCT_RULES. Al Jazeera Finance
 * publishes its own car-financing grid (age, salary, DBR, tenure, amount).
 * Other lenders keep the platform defaults.
 */
import type { EmployerCategory, ProductRuleViolation, ResidencyClass } from './product-rules';

export const AL_JAZEERA_FINANCE_CODE = 'al-jazeera-finance';

export type AlJazeeraSegment = 'qatari' | 'expat_govt_listed' | 'expat_private';

export type LenderSegmentCriteria = {
  segment: AlJazeeraSegment;
  minAge: number;
  /** Null = no application-age ceiling (only maturity is checked). */
  maxAgeAtApplication: number | null;
  maxAgeAtMaturity: number;
  minEmploymentMonths: number;
  minSalary: number;
  minFinancing: number;
  maxFinancing: number | null;
  maxTenureMonths: number;
  minDownPaymentPct: number;
  dbrCap: number;
  /** Qatari DBR is 75% of basic + social allowance; we apply it to captured income. */
  dbrBase: 'gross_salary' | 'basic_plus_social';
  guarantorRequired: boolean;
  /** Private-sector expats: one financed car. Null = no cap. */
  maxPrivateSectorCars: number | null;
};

const EXPAT_GOVT_LISTED: LenderSegmentCriteria = {
  segment: 'expat_govt_listed',
  minAge: 21,
  maxAgeAtApplication: 59,
  maxAgeAtMaturity: 60,
  minEmploymentMonths: 6,
  minSalary: 4_000,
  minFinancing: 50_000,
  maxFinancing: 200_000,
  maxTenureMonths: 48,
  minDownPaymentPct: 0,
  dbrCap: 0.5,
  dbrBase: 'gross_salary',
  guarantorRequired: false,
  maxPrivateSectorCars: null,
};

const EXPAT_PRIVATE: LenderSegmentCriteria = {
  ...EXPAT_GOVT_LISTED,
  segment: 'expat_private',
  minSalary: 5_000,
  maxPrivateSectorCars: 1,
};

const QATARI: LenderSegmentCriteria = {
  segment: 'qatari',
  minAge: 21,
  maxAgeAtApplication: null,
  maxAgeAtMaturity: 69,
  minEmploymentMonths: 6,
  minSalary: 4_000,
  minFinancing: 50_000,
  maxFinancing: null,
  maxTenureMonths: 71,
  minDownPaymentPct: 0,
  dbrCap: 0.75,
  dbrBase: 'basic_plus_social',
  guarantorRequired: false,
  maxPrivateSectorCars: null,
};

export function isAlJazeeraFinance(code?: string | null): boolean {
  return (code ?? '').trim().toLowerCase() === AL_JAZEERA_FINANCE_CODE;
}

/** Govt / semi-govt / listed / banks → government + private_approved. */
export function alJazeeraSegmentFor(
  residency: ResidencyClass,
  employer?: EmployerCategory | null,
): AlJazeeraSegment {
  if (residency === 'qatari') return 'qatari';
  if (employer === 'government' || employer === 'private_approved') return 'expat_govt_listed';
  return 'expat_private';
}

export function alJazeeraCriteriaFor(
  residency: ResidencyClass,
  employer?: EmployerCategory | null,
): LenderSegmentCriteria {
  const segment = alJazeeraSegmentFor(residency, employer);
  if (segment === 'qatari') return QATARI;
  if (segment === 'expat_govt_listed') return EXPAT_GOVT_LISTED;
  return EXPAT_PRIVATE;
}

export function resolveLenderCriteria(
  lenderCode: string | null | undefined,
  residency: ResidencyClass | null | undefined,
  employer?: EmployerCategory | null,
): LenderSegmentCriteria | null {
  if (!isAlJazeeraFinance(lenderCode) || !residency) return null;
  return alJazeeraCriteriaFor(residency, employer);
}

export function employmentMonthsFromDuration(value: string | null | undefined): number | null {
  switch ((value ?? '').trim()) {
    case 'less-than-6-months':
      return 0;
    case 'between-6-12-months':
      return 6;
    case 'more-than-12-months':
      return 12;
    default:
      return null;
  }
}

/** Hard tenure band when the lender publishes one; null = use PRODUCT_RULES. */
export function lenderTenureBounds(
  lenderCode?: string | null,
  residency?: ResidencyClass | null,
): { min: number; max: number } | null {
  if (!isAlJazeeraFinance(lenderCode)) return null;
  if (residency === 'expat') return { min: 3, max: EXPAT_GOVT_LISTED.maxTenureMonths };
  return { min: 3, max: QATARI.maxTenureMonths };
}

export function lenderMinDownPaymentPct(lenderCode?: string | null): number | null {
  return isAlJazeeraFinance(lenderCode) ? 0 : null;
}

export function lenderCodeOf(source: {
  lenderCode?: string | null;
  financePartner?: { code?: string | null } | null;
} | null | undefined): string | null {
  return source?.lenderCode ?? source?.financePartner?.code ?? null;
}

export type LenderApplicantIssueCode = 'age_band' | 'income_floor' | 'employment_duration' | 'car_limit';

export type LenderApplicantIssue = {
  code: LenderApplicantIssueCode;
  params: Record<string, number | string>;
};

function ageAt(dobIso: string, at: Date): number | null {
  const dob = new Date(dobIso);
  if (Number.isNaN(dob.getTime())) return null;
  let age = at.getFullYear() - dob.getFullYear();
  const m = at.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && at.getDate() < dob.getDate())) age -= 1;
  return age;
}

/** Applicant-side Al Jazeera gates (age, salary, work period, 1-car). Empty when the lender is not AJ. */
export function lenderApplicantIssues(input: {
  lenderCode?: string | null;
  residency: ResidencyClass | null | undefined;
  employerCategory?: EmployerCategory | null;
  dateOfBirth?: string | null;
  monthlyIncome?: number | null;
  employmentDuration?: string | null;
  tenureMonths?: number | null;
  existingActiveCarCount?: number | null;
  now?: Date;
}): LenderApplicantIssue[] {
  const criteria = resolveLenderCriteria(input.lenderCode, input.residency, input.employerCategory);
  if (!criteria) return [];
  const now = input.now ?? new Date();
  const out: LenderApplicantIssue[] = [];

  if (input.dateOfBirth) {
    const ageNow = ageAt(input.dateOfBirth, now);
    if (ageNow != null) {
      const end = new Date(now);
      end.setMonth(end.getMonth() + Math.max(0, Number(input.tenureMonths) || 0));
      const ageAtEnd = ageAt(input.dateOfBirth, end) ?? ageNow;
      const inApplication =
        ageNow >= criteria.minAge &&
        (criteria.maxAgeAtApplication == null || ageNow <= criteria.maxAgeAtApplication);
      const inMaturity = ageAtEnd >= criteria.minAge && ageAtEnd <= criteria.maxAgeAtMaturity;
      if (!inApplication || !inMaturity) {
        out.push({
          code: 'age_band',
          params: { ageNow, ageAtEnd, min: criteria.minAge, max: criteria.maxAgeAtMaturity },
        });
      }
    }
  }

  const income = Number(input.monthlyIncome);
  if (Number.isFinite(income) && income > 0 && income < criteria.minSalary) {
    out.push({ code: 'income_floor', params: { floor: criteria.minSalary, income } });
  }

  const employedMonths = employmentMonthsFromDuration(input.employmentDuration);
  if (employedMonths != null && employedMonths < criteria.minEmploymentMonths) {
    out.push({
      code: 'employment_duration',
      params: { min: criteria.minEmploymentMonths, months: employedMonths },
    });
  }

  if (
    criteria.maxPrivateSectorCars != null &&
    input.existingActiveCarCount != null &&
    input.existingActiveCarCount >= criteria.maxPrivateSectorCars
  ) {
    out.push({
      code: 'car_limit',
      params: { max: criteria.maxPrivateSectorCars, existing: input.existingActiveCarCount },
    });
  }

  return out;
}

export function privateSectorCarLimitViolation(
  lenderCode: string | null | undefined,
  residency: ResidencyClass | null | undefined,
  employer: EmployerCategory | null | undefined,
  existingActiveCarCount: number | null | undefined,
): ProductRuleViolation | null {
  const criteria = resolveLenderCriteria(lenderCode, residency, employer);
  if (!criteria || criteria.maxPrivateSectorCars == null || existingActiveCarCount == null) return null;
  if (existingActiveCarCount < criteria.maxPrivateSectorCars) return null;
  return {
    code: 'private_sector_car_limit',
    severity: 'hard',
    params: { max: criteria.maxPrivateSectorCars, existing: existingActiveCarCount },
  };
}
