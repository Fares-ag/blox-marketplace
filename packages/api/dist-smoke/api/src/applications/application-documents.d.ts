import { type DocumentSlot, type DocumentSlotProfile } from "@drivemarket/shared/domain-rules";
export declare const APPLICATION_DOC_CATEGORIES: readonly ["qid", "id", "passport", "license", "salary", "bank", "other", "cr", "computer_card", "rental_agreement", "signatory_id", "credit_bureau", "residence_proof", "employment_contract", "trade_license", "audited_financials", "tax_card", "business_bank", "guarantor_qid", "guarantor_salary", "guarantor_bank", "vehicle_quotation", "takaful_policy"];
export declare const REQUIRED_APPLICATION_DOC_CATEGORIES: readonly ["qid", "salary", "bank"];
export type RequiredDocCategory = (typeof REQUIRED_APPLICATION_DOC_CATEGORIES)[number];
export type ApplicationDocCategory = (typeof APPLICATION_DOC_CATEGORIES)[number];
export type ApplicationDocumentForValidation = {
    category: string;
    kycDocumentType?: string | null;
    verificationStatus?: string | null;
    createdAt?: Date | string | null;
    uploadedByRole?: string | null;
};
export type IdentityPolicy = {
    ekycRequired?: boolean;
    allowStaffManualIdentity?: boolean;
};
export declare function hasQidRequirement(documents: ApplicationDocumentForValidation[], policy?: IdentityPolicy): boolean;
export declare function missingRequiredDocumentCategories(documents: ApplicationDocumentForValidation[], policy?: IdentityPolicy): RequiredDocCategory[];
export declare function hasAllRequiredDocuments(documents: ApplicationDocumentForValidation[], policy?: IdentityPolicy): boolean;
export type ApplicationDocumentSlot = Omit<DocumentSlot, 'category'> & {
    category: string;
};
export declare function documentProfileFromSnapshot(snapshotRaw: unknown): DocumentSlotProfile;
export declare function uploadedDocumentCategories(documents: ApplicationDocumentForValidation[], policy?: IdentityPolicy): string[];
export declare function missingDocumentsForApplication(snapshotRaw: unknown, documents: ApplicationDocumentForValidation[], policy?: IdentityPolicy): string[];
export declare function hasAllDocumentsForApplication(snapshotRaw: unknown, documents: ApplicationDocumentForValidation[], policy?: IdentityPolicy): boolean;
export declare function applicationDocumentSlots(snapshotRaw: unknown): ApplicationDocumentSlot[];
export declare function newestUploadByCategory(documents: ApplicationDocumentForValidation[]): Map<string, number>;
export declare function isSlotStale(slot: {
    maxAgeDays?: number;
}, newestUploadMs: number | null | undefined, now?: Date): boolean;
export declare function staleDocumentCategories(snapshotRaw: unknown, documents: ApplicationDocumentForValidation[], now?: Date): string[];
export type ApplicationDocumentSlotDto = ApplicationDocumentSlot & {
    uploaded_at: string | null;
};
export type ApplicationDocumentSlotsDto = {
    slots: ApplicationDocumentSlotDto[];
    uploaded: string[];
    missing: string[];
    stale: string[];
};
export declare function documentSlotsForApplication(snapshotRaw: unknown, documents: ApplicationDocumentForValidation[], now?: Date, policy?: IdentityPolicy): ApplicationDocumentSlotsDto;
