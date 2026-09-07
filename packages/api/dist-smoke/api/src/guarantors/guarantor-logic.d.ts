import type { GuarantorSessionStatus, Prisma } from '@prisma/client';
import type { GuarantorSessionDto, GuarantorSessionPublicDto } from '../../../shared/src/types/customer-platform';
import { type ConsentLocale } from '../consents/consent-logic';
export declare const GUARANTOR_PROOF_HEADER = "x-assist-proof";
export declare const GUARANTOR_CONSENT_CODES: readonly ["credit_bureau", "terms", "aml"];
export type GuarantorConsentCode = (typeof GUARANTOR_CONSENT_CODES)[number];
export declare function isGuarantorConsentCode(value: unknown): value is GuarantorConsentCode;
export declare const GUARANTOR_STATUS_RANK: Record<GuarantorSessionStatus, number>;
export declare const OPEN_GUARANTOR_STATUSES: readonly GuarantorSessionStatus[];
export declare function isGuarantorSessionOpen(status: GuarantorSessionStatus): boolean;
export declare function effectiveGuarantorStatus(session: {
    status: GuarantorSessionStatus;
    expiresAt: Date;
}, now?: Date): GuarantorSessionStatus;
export declare function advanceGuarantorStatus(current: GuarantorSessionStatus, next: GuarantorSessionStatus): GuarantorSessionStatus;
export type SnapshotGuarantor = {
    fullName: string;
    phone: string;
    qid: string | null;
    email: string | null;
    relationship: string | null;
    monthlyIncome: number | null;
};
export declare function guarantorFromSnapshot(snapshot: unknown): SnapshotGuarantor | null;
export declare function firstNameOf(fullName: string | null | undefined): string | null;
export type GuarantorAcceptanceInput = {
    code: string;
    version: string;
};
export type GuarantorAcceptanceRecord = {
    code: GuarantorConsentCode;
    version: string;
    textHash: string;
    locale: ConsentLocale;
    acceptedAt: string;
};
export type GuarantorAcceptanceValidation = {
    ok: true;
    accepted: {
        code: GuarantorConsentCode;
        version: string;
    }[];
} | {
    ok: false;
    error: 'consent_code_invalid' | 'consent_version_outdated';
    code: string;
} | {
    ok: false;
    error: 'guarantor_consents_incomplete';
    missing: GuarantorConsentCode[];
};
export declare function validateGuarantorAcceptances(acceptances: GuarantorAcceptanceInput[]): GuarantorAcceptanceValidation;
export declare function buildGuarantorAcceptances(accepted: {
    code: GuarantorConsentCode;
    version: string;
}[], locale: string, now?: Date): GuarantorAcceptanceRecord[];
export declare function acceptedGuarantorCodes(raw: Prisma.JsonValue | null | undefined): GuarantorConsentCode[];
export type GuarantorSmsKind = 'link' | 'otp';
export declare function guarantorSmsBody(kind: GuarantorSmsKind, input: {
    applicantName: string | null;
    link: string;
    code: string;
}): string;
export type GuarantorSessionLike = {
    id: string;
    applicationId: string;
    status: GuarantorSessionStatus;
    fullName: string;
    phone: string;
    relationship: string | null;
    consentsCompletedAt: Date | null;
    kycStatus: string | null;
    expiresAt: Date;
    lastOpenedAt: Date | null;
    createdAt: Date;
};
export declare function toGuarantorSessionDto(session: GuarantorSessionLike, link?: string, now?: Date): GuarantorSessionDto;
export type GuarantorPublicViewInput = {
    session: {
        fullName: string;
        expiresAt: Date;
        kycInviteUrl: string | null;
        kycStatus: string | null;
    };
    status: GuarantorSessionStatus;
    applicantName: string | null;
    dealerName: string | null;
    vehicle: {
        make: string;
        model: string;
        modelYear: number | null;
    } | null;
    locale: string | null | undefined;
};
export declare function toGuarantorSessionPublicDto(input: GuarantorPublicViewInput): GuarantorSessionPublicDto;
