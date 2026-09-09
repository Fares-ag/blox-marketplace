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
  /**
   * Tenure is deliberately flexible: any whole month between `minMonths` and
   * `maxMonths` is accepted from anyone. `options` are only the presets the UI
   * offers, and the residency figures below are guidelines that raise a review
   * flag instead of refusing the plan.
   */
  tenure: {
    /** LMS §1: shortest tenure the schedule generator supports. */
    minMonths: 3,
    /** Hard ceiling, the same for every applicant. */
    maxMonths: 60,
    /** Presets the UI shows as chips; a customer may still type any month in the band. */
    options: [12, 24, 36, 48, 60] as const,
    /** LOS FSD §1.4/§9.2 (Max_Tenure_Expat = 48) — a review flag, not a block. */
    recommendedMaxMonths: { qatari: 60, expat: 48 } as Record<ResidencyClass, number>,
  },
  /**
   * Down payment is equally flexible: anything inside the hard band is accepted.
   * The FSD contribution minimums are kept as guidelines so credit still sees a
   * flag when a customer puts in less than the product expects.
   */
  downPayment: {
    /** Hard band. The ceiling stays below 100% because a fully paid vehicle needs no financing. */
    minPct: 0,
    maxPct: 90,
    /** LOS FSD §9.2 Min_Cust_Contribution_New = 20%; LMS §2.5 allows 15% for used. */
    recommendedMinPctByCondition: { new: 20, used: 15 } as Record<RuleVehicleCondition, number>,
  },
  /** LOS FSD §1.4: "New Car — Premium" is a vehicle above QAR 90,000. */
  premiumCarPriceThreshold: 90_000,
  /**
   * Maximum financing amount per variant (LOS FSD §1.4/§1.5). `null` means the
   * variant is uncapped.
   *
   * Car caps are lifted for now. The FSD's QAR 50,000 / 70,000 ceilings predate
   * this catalogue and refused most of it: a 150,000 vehicle at 20% down
   * finances 120,000, so the eligibility check answered "not eligible" for cars
   * the showroom actually sells. The caps are removed together rather than only
   * the premium one, because capping standard cars at 50,000 while leaving
   * premium uncapped would refuse an 80,000 car and allow a 150,000 one.
   * Put the numbers back here to restore the ceilings.
   */
  financingCap: {
    car_new_standard: null,
    car_new_premium: null,
    car_used: null,
    motorcycle: 15_000,
  } as Record<ProductVariant, number | null>,
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
  | 'tenure_above_recommended'
  | 'down_payment_below_min'
  | 'down_payment_below_recommended'
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
  /**
   * Turn the plan guidelines (residency tenure ceiling, contribution minimum,
   * the offer's tenure list) back into hard blocks. Off by default: tenure and
   * down payment are flexible and anything unusual is flagged for review.
   */
  enforcePlanGuidelines?: boolean;
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

/** Maximum financeable amount for a variant, or `null` when it is uncapped. */
export function financingCapFor(variant: ProductVariant): number | null {
  return PRODUCT_RULES.financingCap[variant];
}

/** Hard tenure ceiling. The same for everyone; residency only sets a guideline. */
export function maxTenureFor(_residency?: ResidencyClass | null): number {
  return PRODUCT_RULES.tenure.maxMonths;
}

/** The whole tenure band a customer may choose from. */
export function tenureBounds(): { min: number; max: number } {
  return { min: PRODUCT_RULES.tenure.minMonths, max: PRODUCT_RULES.tenure.maxMonths };
}

/** Guideline ceiling for a residency; exceeding it is flagged for review, never refused. */
export function recommendedMaxTenureFor(residency: ResidencyClass | null | undefined): number | null {
  return residency ? PRODUCT_RULES.tenure.recommendedMaxMonths[residency] : null;
}

/**
 * Tenure presets to show as chips: the product's own presets plus anything the
 * offer adds, inside the hard band. Offer options no longer restrict the
 * choice — they only add to it — because any month in the band is acceptable.
 */
export function allowedTenureOptions(
  _residency?: ResidencyClass | null,
  offerTenureOptions?: number[] | null,
): number[] {
  const { min, max } = tenureBounds();
  const merged = new Set<number>([...PRODUCT_RULES.tenure.options, ...(offerTenureOptions ?? [])]);
  return [...merged]
    .filter((m) => Number.isFinite(m) && Number.isInteger(m) && m >= min && m <= max)
    .sort((a, b) => a - b);
}

/**
 * Recommended starting down payment (the FSD contribution minimum, raised by the
 * offer when it asks for more). Used to pre-fill the form — it is not a floor;
 * `downPaymentBounds()` gives what is actually accepted.
 */
export function minDownPaymentPctFor(
  condition: RuleVehicleCondition,
  offerMinDownPaymentPct?: number | null,
): number {
  const product = PRODUCT_RULES.downPayment.recommendedMinPctByCondition[condition];
  return Math.max(product, Number(offerMinDownPaymentPct ?? 0));
}

/** The whole down-payment band a customer may choose from. */
export function downPaymentBounds(): { min: number; max: number } {
  return { min: PRODUCT_RULES.downPayment.minPct, max: PRODUCT_RULES.downPayment.maxPct };
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

  // Guidelines (residency tenure ceiling, contribution minimum, the offer's own
  // tenure list) are review flags. `enforcePlanGuidelines` turns them back into
  // blocks for a stricter product configuration.
  const guidelineSeverity: ProductRuleViolation['severity'] = req.enforcePlanGuidelines ? 'hard' : 'soft';

  const tenure = Number(req.tenureMonths);
  const { min: minTenure, max: maxTenure } = tenureBounds();
  if (tenure < minTenure) {
    out.push({ code: 'tenure_below_min', severity: 'hard', params: { min: minTenure } });
  }
  if (tenure > maxTenure) {
    out.push({ code: 'tenure_above_max', severity: 'hard', params: { max: maxTenure, residency: req.residency ?? '' } });
  }
  const recommendedTenure = recommendedMaxTenureFor(req.residency);
  if (recommendedTenure != null && tenure > recommendedTenure && tenure <= maxTenure) {
    out.push({
      code: 'tenure_above_recommended',
      severity: guidelineSeverity,
      params: { max: recommendedTenure, residency: req.residency ?? '' },
    });
  }
  if (req.offerTenureOptions?.length && !req.offerTenureOptions.includes(tenure)) {
    out.push({
      code: 'tenure_not_offered',
      severity: guidelineSeverity,
      params: { options: req.offerTenureOptions.join(', ') },
    });
  }

  const recommendedDown = minDownPaymentPctFor(req.vehicle.condition, req.offerMinDownPaymentPct);
  const { min: minDown, max: maxDown } = downPaymentBounds();
  const downPct = Number(req.downPaymentPct);
  if (!Number.isFinite(downPct) || downPct < minDown) {
    out.push({ code: 'down_payment_below_min', severity: 'hard', params: { min: minDown } });
  } else if (downPct < recommendedDown) {
    out.push({
      code: 'down_payment_below_recommended',
      severity: guidelineSeverity,
      params: { min: recommendedDown, condition: req.vehicle.condition },
    });
  }
  if (downPct > maxDown) {
    out.push({ code: 'down_payment_above_max', severity: 'hard', params: { max: maxDown } });
  }

  const variant = resolveProductVariant(req.vehicle);
  const financed = Math.max(0, price - (price * Math.min(Math.max(downPct, 0), 100)) / 100);
  const cap = financingCapFor(variant);
  if (cap != null && financed > cap) {
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
