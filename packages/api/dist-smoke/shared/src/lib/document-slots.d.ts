import type { ResidencyClass } from './product-rules';
export declare const DOCUMENT_SLOT_CATEGORIES: readonly ["qid", "passport", "salary", "bank", "credit_bureau", "residence_proof", "license", "employment_contract", "cr", "trade_license", "business_bank", "audited_financials", "tax_card", "guarantor_qid", "guarantor_salary", "guarantor_bank", "vehicle_quotation", "other"];
export type DocumentSlotCategory = (typeof DOCUMENT_SLOT_CATEGORIES)[number];
export type DocumentSlotGroup = 'identity' | 'income' | 'business' | 'guarantor' | 'supporting';
export type DocumentSlot = {
    category: DocumentSlotCategory;
    required: boolean;
    group: DocumentSlotGroup;
    labelKey: string;
    maxAgeDays?: number;
};
export type DocumentSlotProfile = {
    residency?: ResidencyClass | null;
    employmentType?: string | null;
    hasGuarantor?: boolean;
    applicantType?: 'individual' | 'corporate' | null;
};
export declare function isSelfEmployed(employmentType: string | null | undefined): boolean;
export declare function documentSlotsFor(profile: DocumentSlotProfile): DocumentSlot[];
export declare function requiredDocumentCategoriesFor(profile: DocumentSlotProfile): DocumentSlotCategory[];
export declare function missingDocumentCategories(profile: DocumentSlotProfile, uploadedCategories: Iterable<string>): DocumentSlotCategory[];
export declare const DOCUMENT_UPLOAD_ACCEPT = ".pdf,image/jpeg,image/png";
export declare const DOCUMENT_UPLOAD_MAX_BYTES: number;
export type UploadRejection = {
    code: 'type' | 'size';
    params: Record<string, string | number>;
};
export declare function documentUploadRejection(file: {
    name: string;
    type: string;
    size: number;
}): UploadRejection | null;
