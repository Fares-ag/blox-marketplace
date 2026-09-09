import { Controller, Get } from '@nestjs/common';
import {
  CONSENT_CATALOG,
  CONSENT_CATALOG_VERSION,
  PRODUCT_RULES,
  RESIDENCE_DURATION_OPTIONS,
} from '@drivemarket/shared/domain-rules';
import { Public } from '../auth/guards';

/**
 * Read-only view of the shared product rules for clients that cannot import
 * the TypeScript module (the mobile app). The web portals import the module
 * directly; the API enforces the same rules on every application path, so
 * this endpoint is informational.
 */
@Controller('product-rules')
export class ProductRulesController {
  @Public()
  @Get()
  rules() {
    return {
      version: '2026-09-07',
      currency: PRODUCT_RULES.currency,
      individuals_only: PRODUCT_RULES.individualsOnly,
      // Tenure and down payment are flexible: `min`/`max` are the only hard
      // edges, `options` are presets, and the `recommended_*` figures are what
      // a plan is measured against for a review flag.
      tenure: {
        min_months: PRODUCT_RULES.tenure.minMonths,
        max_months: PRODUCT_RULES.tenure.maxMonths,
        options: PRODUCT_RULES.tenure.options,
        recommended_max_months: PRODUCT_RULES.tenure.recommendedMaxMonths,
      },
      down_payment: {
        min_pct: PRODUCT_RULES.downPayment.minPct,
        max_pct: PRODUCT_RULES.downPayment.maxPct,
        recommended_min_pct_by_condition: PRODUCT_RULES.downPayment.recommendedMinPctByCondition,
      },
      premium_car_price_threshold: PRODUCT_RULES.premiumCarPriceThreshold,
      financing_cap: PRODUCT_RULES.financingCap,
      vehicle_age: {
        max_years_at_tenure_end: PRODUCT_RULES.vehicleAge.maxYearsAtTenureEnd,
        max_used_years_at_application: PRODUCT_RULES.vehicleAge.maxUsedYearsAtApplication,
      },
      applicant: {
        age_at_contract_end: PRODUCT_RULES.applicant.ageAtContractEnd,
        min_net_monthly_income: PRODUCT_RULES.applicant.minNetMonthlyIncome,
        min_residency_months_expat: PRODUCT_RULES.applicant.minResidencyMonthsExpat,
      },
      dbr: {
        caps: PRODUCT_RULES.dbr.caps,
        hard_cap: PRODUCT_RULES.dbr.hardCap,
        exception_tiers: PRODUCT_RULES.dbr.exceptionTiers,
      },
      residence_duration_options: RESIDENCE_DURATION_OPTIONS.map((o) => ({ value: o.value, min_months: o.minMonths })),
      consents: {
        catalog_version: CONSENT_CATALOG_VERSION,
        items: Object.values(CONSENT_CATALOG).map((c) => ({
          code: c.code,
          version: c.version,
          title: c.title,
          summary: c.summary,
          body: c.body,
        })),
      },
    };
  }
}
