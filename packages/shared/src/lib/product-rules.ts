/**
 * Shared product rules — one source of truth for the web wizard, the dealer
 * wizard, quotes, the customer eligibility pre-check and the API.
 *
 * Values come from the Blox vehicle financing specifications (LOS FSD v2.1
 * §1.4/§1.5/§9.2 and the LMS product configuration §1/§2.5). Where the two
 * documents disagree the more conservative figure is used and the choice is
 * noted inline so product can override it in one place.
 *
 * Pure data + pure functions: no I/O, no React, no Prisma. Bundled for the API
 * through `@drivemarket/shared/domain-rules`.
 */

export type RuleVehicleCondition = 'new' | 'used';
export type VehicleCategory = 'car' | 'motorcycle';
export type ResidencyClass = 'qatari' | 'expat';
export type ApplicantKind = 'individual' | 'corporate';
export type ProductVariant = 'car_new_standard' | 'car_new_premium' | 'car_used' | 'motorcycle';
export type EmployerCategory = 'government' | 'private_approved' | 'private_unlisted' | 'self_employed';

export const PRODUCT_RULES = {
  currency: 'QAR',
  /** LMS §2.5(2): the Diminishing Musharakah product is for individual customers only. */
  individualsOnly: true,
  tenure: {
    /** LMS §1: minimum tenure across all variants. */
    minMonths: 3,
    /** LOS FSD Stage 1 list of values, capped per nationality below. */
    options: [12, 24, 36, 48, 60] as const,
    /** LOS FSD §1.4 and §9.2 (Max_Tenure_Expat = 48). */
    maxMonths: { qatari: 60, expat: 48 } as Record<ResidencyClass, number>,
  },
  downPayment: {
    /** LOS FSD §9.2 Min_Cust_Contribution_New = 20%; LMS §2.5 allows 15% for used. */
    minPctByCondition: { new: 20, used: 15 } as Record<RuleVehicleCondition, number>,
    maxPct: 80,
  },
  /** LOS FSD §1.4: "New Car — Premium" is a vehicle above QAR 90,000. */
  premiumCarPriceThreshold: 90_000,
  /** Maximum financing amount per variant (LOS FSD §1.4/§1.5). */
  financingCap: {
    car_new_standard: 50_000,
    car_new_premium: 70_000,
    car_used: 50_000,
    motorcycle: 15_000,
  } as Record<ProductVariant, number>,
  /** LOS FSD §1.5 approval authority matrix. */
  approvalAuthority: {
    car: { seniorManager: 50_000, headOfCredit: 70_000 },
    motorcycle: { seniorManager: 10_000, headOfCredit: 15_000 },
  } as Record<VehicleCategory, { seniorManager: number; headOfCredit: number }>,
  vehicleAge: {
    /** LOS FSD §9.2 Max_VehicleAge_End = 10 years at tenure end. */
    maxYearsAtTenureEnd: 10,
    /** LOS FSD Stage 1: used cars must be within the allowed age at application (example: 5 years). */
    maxUsedYearsAtApplication: 5,
  },
  applicant: {
    /** LOS FSD ELIG001: age band evaluated at contract end. */
    ageAtContractEnd: {
      qatari: { min: 18, max: 65 },
      expat: { min: 21, max: 60 },
    } as Record<ResidencyClass, { min: number; max: number }>,
    /** LOS FSD ELIG001 minimum net monthly income (QAR). */
    minNetMonthlyIncome: { qatari: 5_000, expat: 7_000 } as Record<ResidencyClass, number>,
    /** LOS FSD ELIG001: expatriate residency must be at least 6 months. */
    minResidencyMonthsExpat: 6,
  },
  dbr: {
    /** LOS FSD DBR001 caps by residency × employer category. */
    caps: {
      qatari_government: 0.7,
      qatari_private_approved: 0.6,
      qatari_private_unlisted: 0.6,
      qatari_self_employed: 0.6,
      expat_government: 0.5,
      expat_private_approved: 0.5,
      expat_private_unlisted: 0.5,
      expat_self_employed: 0.5,
    } as Record<`${ResidencyClass}_${EmployerCategory}`, number>,
    /** Above the cap but within these excesses the case is referred, not declined (EXC001 tiers). */
    exceptionTiers: [
      { maxExcess: 0.03, tier: 1 },
      { maxExcess: 0.05, tier: 2 },
    ] as ReadonlyArray<{ maxExcess: number; tier: number }>,
    /** LOS FSD §9.2 DBR_Hard_Cap: auto-decline above this. */
    hardCap: 0.75,
    /** Stress test parameters (LOS FSD DBR001). */
    stress: { rentalIncrease: 0.02, incomeReduction: 0.1, highTicketThreshold: 50_000, maxStressedDbr: 0.6 },
  },
} as const;

export type ProductRuleCode =
  | 'corporate_not_eligible'
  | 'tenure_below_min'
  | 'tenure_above_max'
  | 'tenure_not_offered'
  | 'down_payment_below_min'
  | 'down_payment_above_max'
  | 'financing_amount_exceeds_cap'
  | 'vehicle_age_at_tenure_end'
  | 'used_vehicle_too_old'
  | 'price_not_positive';

export type ProductRuleViolation = {
  code: ProductRuleCode;
  /** Hard violations block the application; soft ones are shown as warnings. */
  severity: 'hard' | 'soft';
  /** Interpolation values for the UI message (all numbers are plain QAR / months / years). */
  params: Record<string, number | string>;
};

export type FinancingRequest = {
  applicantType?: ApplicantKind | null;
  residency?: ResidencyClass | null;
  vehicle: {
    price: number;
    condition: RuleVehicleCondition;
    category?: VehicleCategory | null;
    modelYear?: number | null;
  };
  tenureMonths: number;
  downPaymentPct: number;
  /** Offer-configured tenure options; when present the tenure must be one of them. */
  offerTenureOptions?: number[] | null;
  /** Offer-configured minimum, applied when higher than the product minimum. */
  offerMinDownPaymentPct?: number | null;
  /** Evaluate financing caps as hard violations (defaults to soft while the cap table is under review). */
  enforceFinancingCaps?: boolean;
  /** Block corporate applicants outright (defaults to a review flag so the dealer corporate flow keeps working). */
  enforceIndividualsOnly?: boolean;
  now?: Date;
};

export function resolveProductVariant(vehicle: {
  price: number;
  condition: RuleVehicleCondition;
  category?: VehicleCategory | null;
}): ProductVariant {
  if (vehicle.category === 'motorcycle') return 'motorcycle';
  if (vehicle.condition === 'used') return 'car_used';
  return vehicle.price > PRODUCT_RULES.premiumCarPriceThreshold ? 'car_new_premium' : 'car_new_standard';
}

export function financingCapFor(variant: ProductVariant): number {
  return PRODUCT_RULES.financingCap[variant];
}

export function maxTenureFor(residency: ResidencyClass | null | undefined): number {
  return residency ? PRODUCT_RULES.tenure.maxMonths[residency] : Math.max(...Object.values(PRODUCT_RULES.tenure.maxMonths));
}

/** Tenure choices a customer may pick: product options ∩ offer options, capped by nationality. */
export function allowedTenureOptions(
  residency: ResidencyClass | null | undefined,
  offerTenureOptions?: number[] | null,
): number[] {
  const max = maxTenureFor(residency);
  const base: number[] = offerTenureOptions?.length
    ? [...offerTenureOptions]
    : [...PRODUCT_RULES.tenure.options];
  return base
    .filter((m) => Number.isFinite(m) && m >= PRODUCT_RULES.tenure.minMonths && m <= max)
    .sort((a, b) => a - b);
}

export function minDownPaymentPctFor(
  condition: RuleVehicleCondition,
  offerMinDownPaymentPct?: number | null,
): number {
  const product = PRODUCT_RULES.downPayment.minPctByCondition[condition];
  return Math.max(product, Number(offerMinDownPaymentPct ?? 0));
}

export function vehicleAgeAtTenureEnd(modelYear: number, tenureMonths: number, now = new Date()): number {
  const endYear = now.getFullYear() + tenureMonths / 12;
  return Math.max(0, endYear - modelYear);
}

/** Validate a financing request against the product rules. Empty array = compliant. */
export function validateFinancingRequest(req: FinancingRequest): ProductRuleViolation[] {
  const out: ProductRuleViolation[] = [];
  const now = req.now ?? new Date();
  const price = Number(req.vehicle.price);

  if (PRODUCT_RULES.individualsOnly && req.applicantType === 'corporate') {
    out.push({ code: 'corporate_not_eligible', severity: req.enforceIndividualsOnly ? 'hard' : 'soft', params: {} });
  }
  if (!Number.isFinite(price) || price <= 0) {
    out.push({ code: 'price_not_positive', severity: 'hard', params: {} });
    return out;
  }

  const tenure = Number(req.tenureMonths);
  const maxTenure = maxTenureFor(req.residency);
  if (tenure < PRODUCT_RULES.tenure.minMonths) {
    out.push({ code: 'tenure_below_min', severity: 'hard', params: { min: PRODUCT_RULES.tenure.minMonths } });
  }
  if (tenure > maxTenure) {
    out.push({ code: 'tenure_above_max', severity: 'hard', params: { max: maxTenure, residency: req.residency ?? '' } });
  }
  if (req.offerTenureOptions?.length && !req.offerTenureOptions.includes(tenure)) {
    out.push({ code: 'tenure_not_offered', severity: 'hard', params: { options: req.offerTenureOptions.join(', ') } });
  }

  const minDown = minDownPaymentPctFor(req.vehicle.condition, req.offerMinDownPaymentPct);
  const downPct = Number(req.downPaymentPct);
  if (downPct < minDown) {
    out.push({ code: 'down_payment_below_min', severity: 'hard', params: { min: minDown } });
  }
  if (downPct > PRODUCT_RULES.downPayment.maxPct) {
    out.push({ code: 'down_payment_above_max', severity: 'hard', params: { max: PRODUCT_RULES.downPayment.maxPct } });
  }

  const variant = resolveProductVariant(req.vehicle);
  const financed = Math.max(0, price - (price * Math.min(Math.max(downPct, 0), 100)) / 100);
  const cap = financingCapFor(variant);
  if (financed > cap) {
    out.push({
      code: 'financing_amount_exceeds_cap',
      severity: req.enforceFinancingCaps ? 'hard' : 'soft',
      params: { cap, financed: Math.round(financed), variant },
    });
  }

  if (req.vehicle.modelYear) {
    const ageAtEnd = vehicleAgeAtTenureEnd(req.vehicle.modelYear, tenure, now);
    if (ageAtEnd > PRODUCT_RULES.vehicleAge.maxYearsAtTenureEnd) {
      out.push({
        code: 'vehicle_age_at_tenure_end',
        severity: 'hard',
        params: { max: PRODUCT_RULES.vehicleAge.maxYearsAtTenureEnd, ageAtEnd: Math.round(ageAtEnd * 10) / 10 },
      });
    }
    if (req.vehicle.condition === 'used') {
      const ageNow = now.getFullYear() - req.vehicle.modelYear;
      if (ageNow > PRODUCT_RULES.vehicleAge.maxUsedYearsAtApplication) {
        out.push({
          code: 'used_vehicle_too_old',
          severity: 'hard',
          params: { max: PRODUCT_RULES.vehicleAge.maxUsedYearsAtApplication, age: ageNow },
        });
      }
    }
  }

  return out;
}

export function hasHardViolation(violations: ProductRuleViolation[]): boolean {
  return violations.some((v) => v.severity === 'hard');
}

/** Which approval level a financed amount needs (LOS FSD §1.5). */
export function requiredApprovalAuthority(
  category: VehicleCategory,
  financedAmount: number,
): 'senior_manager' | 'head_of_credit' | 'above_matrix' {
  const matrix = PRODUCT_RULES.approvalAuthority[category];
  if (financedAmount <= matrix.seniorManager) return 'senior_manager';
  if (financedAmount <= matrix.headOfCredit) return 'head_of_credit';
  return 'above_matrix';
}

/** Employment-type values used by the intake forms → employer category used by the DBR matrix. */
export function employerCategoryFromEmploymentType(value: string | null | undefined): EmployerCategory {
  switch ((value ?? '').trim()) {
    case 'gov-or-semi-gov':
      return 'government';
    case 'private-international':
      return 'private_approved';
    case 'self-employed':
      return 'self_employed';
    case 'private-local':
    default:
      return 'private_unlisted';
  }
}

/** Residency class from a free-text nationality (falls back to expat when unknown). */
export function residencyFromNationality(nationality: string | null | undefined): ResidencyClass | null {
  const value = (nationality ?? '').trim().toLowerCase();
  if (!value) return null;
  if (value === 'qa' || value === 'qat' || value === 'qatar' || value === 'qatari' || value.includes('قطر')) {
    return 'qatari';
  }
  return 'expat';
}

/** Residence-duration options for expatriates (LOS FSD Stage 1 "Duration of Residence"). */
export const RESIDENCE_DURATION_OPTIONS = [
  { value: 'less-than-6-months', minMonths: 0, labelKey: 'applyFlow.residence.lt6' },
  { value: '6-12-months', minMonths: 6, labelKey: 'applyFlow.residence.m6_12' },
  { value: '1-3-years', minMonths: 12, labelKey: 'applyFlow.residence.y1_3' },
  { value: '3-5-years', minMonths: 36, labelKey: 'applyFlow.residence.y3_5' },
  { value: 'more-than-5-years', minMonths: 60, labelKey: 'applyFlow.residence.gt5' },
] as const;

export type ResidenceDurationValue = (typeof RESIDENCE_DURATION_OPTIONS)[number]['value'];

export function residenceMonthsFromOption(value: string | null | undefined): number | null {
  const hit = RESIDENCE_DURATION_OPTIONS.find((o) => o.value === value);
  return hit ? hit.minMonths : null;
}
