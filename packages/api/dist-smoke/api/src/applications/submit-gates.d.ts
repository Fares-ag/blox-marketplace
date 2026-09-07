import { type ApplicationDocumentForValidation, type IdentityPolicy } from './application-documents';
export declare const SUBMIT_GATE_ORDER: readonly ["identity_hold", "consents_required", "documents_missing", "documents_stale", "guarantor_consent_required", "vehicle_identity_incomplete", "vehicle_age_rule"];
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
export type SubmitGateInput = {
    application: SubmitGateApplication;
    documents: ApplicationDocumentForValidation[];
    product: SubmitGateProduct;
    requireVehicleIdentity: boolean;
    requireConsents?: boolean;
    guarantorConsentCompleted?: boolean;
    identityPolicy?: IdentityPolicy;
    now?: Date;
};
export declare function guarantorConsentRequired(application: Pick<SubmitGateApplication, 'customerSnapshot'>, guarantorConsentCompleted: boolean | undefined): boolean;
export declare function identityHoldActive(app: Pick<SubmitGateApplication, 'identityHoldAt' | 'identityHoldClearedAt'>): boolean;
export declare function vehicleIdentityComplete(product: SubmitGateProduct): boolean;
export declare function evaluateSubmitGates(input: SubmitGateInput): SubmitGateFailure | null;
export declare function assertSubmitGates(input: SubmitGateInput): void;
