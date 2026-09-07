import { ApplicationStatus, DocumentCategory, type Prisma } from '@prisma/client';
import { type ApprovalAuthority } from "@drivemarket/shared/domain-rules";
import type { AffordabilityDto, CreditAssessmentDto, PartnerApplicationDto } from '../../../shared/src/types/customer-platform';
export declare const PARTNER_VISIBLE_STATUSES: ApplicationStatus[];
export declare const PARTNER_DOCUMENT_CATEGORIES: DocumentCategory[];
export declare function isPartnerVisibleStatus(status: ApplicationStatus): boolean;
export declare function isPartnerVisibleDocument(category: DocumentCategory): boolean;
export declare function partnerApplicationWhere(financePartnerId: string, status?: ApplicationStatus | null): Prisma.ApplicationWhereInput;
export declare function financingFromPricing(pricing: unknown): PartnerApplicationDto['financing'];
export declare function customerFromSnapshot(snapshot: unknown, fallbackName: string | null): PartnerApplicationDto['customer'];
export declare function normalizeAffordability(raw: unknown): AffordabilityDto | null;
export declare function approverFor(role: string, authority: ApprovalAuthority): CreditAssessmentDto['approver'];
export declare function creditAssessmentForRole(raw: unknown, role: string): CreditAssessmentDto | null;
export type PartnerApplicationRow = {
    id: string;
    status: ApplicationStatus;
    submittedAt: Date | null;
    updatedAt: Date;
    customerSnapshot: unknown;
    pricingSnapshot: unknown;
    creditAssessment: unknown;
    consentsCompletedAt: Date | null;
    company: {
        name: string;
    };
    branch: {
        name: string;
    } | null;
    product: {
        make: string;
        model: string;
        modelYear: number;
        price: unknown;
    };
    customer: {
        name: string | null;
    };
    documents: Array<{
        id: string;
        category: DocumentCategory;
        originalName: string | null;
        createdAt: Date;
    }>;
};
export declare function toPartnerApplicationDto(row: PartnerApplicationRow, role?: string): PartnerApplicationDto;
export type PartnerSummary = {
    total: number;
    by_status: Record<string, number>;
};
export declare function partnerSummary(groups: Array<{
    status: ApplicationStatus;
    count: number;
}>): PartnerSummary;
