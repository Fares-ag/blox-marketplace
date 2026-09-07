import { type ConsentCodeValue } from "@drivemarket/shared/domain-rules";
import type { ConsentRecordDto, ConsentStatusDto } from '../../../shared/src/types/customer-platform';
export type ConsentLocale = 'en' | 'ar';
export declare function normalizeConsentLocale(raw: string | null | undefined): ConsentLocale;
export declare function consentTextHash(code: ConsentCodeValue, locale: ConsentLocale): string;
export declare function consentChannelFromHeader(header: string | string[] | undefined): 'web' | 'mobile';
export type ConsentAcceptanceInput = {
    code: string;
    version: string;
};
export type AcceptanceValidation = {
    ok: true;
    accepted: {
        code: ConsentCodeValue;
        version: string;
    }[];
} | {
    ok: false;
    error: 'consent_code_invalid' | 'consent_version_outdated';
    code: string;
};
export declare function validateAcceptances(acceptances: ConsentAcceptanceInput[]): AcceptanceValidation;
export type ConsentRecordLike = {
    id: string;
    code: string;
    version: string;
    locale: string;
    channel: string;
    acceptedAt: Date;
    applicationId: string | null;
    actor?: {
        name: string | null;
    } | null;
    withdrawnAt?: Date | null;
};
export declare function consentOutdated(record: Pick<ConsentRecordLike, 'code' | 'version'>): boolean;
export declare function toConsentRecordDto(record: ConsentRecordLike): ConsentRecordDto;
export declare function buildConsentStatus(records: ConsentRecordLike[]): ConsentStatusDto;
