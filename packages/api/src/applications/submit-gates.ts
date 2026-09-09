import { ConflictException } from '@nestjs/common';
import { PRODUCT_RULES, vehicleAgeAtTenureEnd } from '@drivemarket/shared/domain-rules';
import {
  missingDocumentsForApplication,
  staleDocumentCategories,
  type ApplicationDocumentForValidation,
  type IdentityPolicy,
} from './application-documents';
import { resolveTenureMonths } from './application-pricing';
import { hasGuarantorOf, readCustomerSnapshot } from './customer-snapshot';

/**
 * Submit gates, evaluated in this order (each a 409 with the code as message):
 *
 *   1. `identity_hold`               — MISMATCHED_IDENTITY hold set and not cleared by credit
 *   2. `consents_required`           — the four mandatory consents were not captured
 *   3. `documents_missing`           — required document slots still empty (`missing` list)
 *   4. `documents_stale`             — time-sensitive uploads older than the slot allows (`stale` list)
 *   5. `guarantor_consent_required`  — a declared guarantor has not completed the consent session
 *   6. `vehicle_identity_incomplete` — VIN + chassis + engine number before the listing is reserved
 *   7. `vehicle_age_rule`            — vehicle older than 10 years at tenure end
 *
 * Pure so the ordering is unit-tested without a database.
 */

export const SUBMIT_GATE_ORDER = [
  'identity_hold',
  'consents_required',
  'documents_missing',
  'documents_stale',
  'guarantor_consent_required',
  'vehicle_identity_incomplete',
  'vehicle_age_rule',
] as const;

export type SubmitGateCode = (typeof SUBMIT_GATE_ORDER)[number];

export type SubmitGateFailure = {
  code: SubmitGateCode;
  missing?: string[];
  stale?: string[];
  params?: Record<string, number>;
};

export type SubmitGateApplication = {
  identityHoldAt?: Date | null;
  identityHoldClearedAt?: Date | null;
  consentsCompletedAt?: Date | null;
  customerSnapshot: unknown;
  pricingSnapshot: unknown;
};

export type SubmitGateProduct = {
  vin?: string | null;
  chassisNumber?: string | null;
  engineNumber?: string | null;
  modelYear?: number | null;
};

/** Re-enable when inventory requires VIN, chassis and engine before reserve. */
export const VEHICLE_IDENTITY_REQUIRED_FOR_RESERVE = false;

export type SubmitGateInput = {
  application: SubmitGateApplication;
  documents: ApplicationDocumentForValidation[];
  product: SubmitGateProduct;
  /** True only when this submit will reserve the listing (first submit from `draft`). */
  requireVehicleIdentity: boolean;
  /** Defaults to true; the consent gate is skipped only for flows that capture consents later. */
  requireConsents?: boolean;
  /**
   * Whether a `GuarantorConsentSession` with `consentsCompletedAt` exists for the
   * application. Only consulted when the snapshot declares a guarantor.
   */
  guarantorConsentCompleted?: boolean;
  /** e-KYC policy for the identity slot (BRD BR-7/BR-8): omitted ⇒ manual QID uploads still count. */
  identityPolicy?: IdentityPolicy;
  now?: Date;
};

export function guarantorConsentRequired(
  application: Pick<SubmitGateApplication, 'customerSnapshot'>,
  guarantorConsentCompleted: boolean | undefined,
): boolean {
  return hasGuarantorOf(readCustomerSnapshot(application.customerSnapshot)) && guarantorConsentCompleted !== true;
}

export function identityHoldActive(app: Pick<SubmitGateApplication, 'identityHoldAt' | 'identityHoldClearedAt'>): boolean {
  return !!app.identityHoldAt && !app.identityHoldClearedAt;
}

export function vehicleIdentityComplete(product: SubmitGateProduct): boolean {
  return [product.vin, product.chassisNumber, product.engineNumber].every(
    (value) => typeof value === 'string' && value.trim().length > 0,
  );
}

export function evaluateSubmitGates(input: SubmitGateInput): SubmitGateFailure | null {
  const { application, product } = input;

  if (identityHoldActive(application)) return { code: 'identity_hold' };

  if (input.requireConsents !== false && !application.consentsCompletedAt) {
    return { code: 'consents_required' };
  }

  const missing = missingDocumentsForApplication(
    application.customerSnapshot,
    input.documents,
    input.identityPolicy ?? {},
  );
  if (missing.length > 0) return { code: 'documents_missing', missing };

  const stale = staleDocumentCategories(application.customerSnapshot, input.documents, input.now);
  if (stale.length > 0) return { code: 'documents_stale', stale };

  if (guarantorConsentRequired(application, input.guarantorConsentCompleted)) {
    return { code: 'guarantor_consent_required' };
  }

  if (
    VEHICLE_IDENTITY_REQUIRED_FOR_RESERVE &&
    input.requireVehicleIdentity &&
    !vehicleIdentityComplete(product)
  ) {
    return { code: 'vehicle_identity_incomplete' };
  }

  if (product.modelYear) {
    const pricing = (application.pricingSnapshot as Record<string, unknown>) ?? {};
    const tenureMonths = resolveTenureMonths(pricing);
    const ageAtEnd = vehicleAgeAtTenureEnd(product.modelYear, tenureMonths, input.now);
    if (ageAtEnd > PRODUCT_RULES.vehicleAge.maxYearsAtTenureEnd) {
      return {
        code: 'vehicle_age_rule',
        params: {
          max_years_at_tenure_end: PRODUCT_RULES.vehicleAge.maxYearsAtTenureEnd,
          age_at_tenure_end: Math.round(ageAtEnd * 10) / 10,
        },
      };
    }
  }

  return null;
}

/** Throws the 409 for the first failing gate; returns normally when the application may be submitted. */
export function assertSubmitGates(input: SubmitGateInput): void {
  const failure = evaluateSubmitGates(input);
  if (!failure) return;
  if (failure.code === 'documents_missing') {
    throw new ConflictException({ message: 'documents_missing', missing: failure.missing ?? [] });
  }
  if (failure.code === 'documents_stale') {
    throw new ConflictException({ message: 'documents_stale', stale: failure.stale ?? [] });
  }
  if (failure.code === 'vehicle_age_rule') {
    throw new ConflictException({ message: 'vehicle_age_rule', ...(failure.params ?? {}) });
  }
  throw new ConflictException(failure.code);
}
