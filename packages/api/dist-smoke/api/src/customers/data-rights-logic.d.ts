import { ApplicationStatus, DataRightsRequestStatus, type DataRightsRequest } from '@prisma/client';
import type { DataRightsRequestDto } from '../../../shared/src/types/customer-platform';
export declare const DATA_RIGHTS_SLA_DAYS = 30;
export declare function dataRightsDueAt(now?: Date): Date;
export declare const DELETION_BLOCKING_STATUSES: ApplicationStatus[];
export declare const PENDING_DATA_RIGHTS_STATUSES: DataRightsRequestStatus[];
export declare const DATA_RIGHTS_TRANSITIONS: Record<DataRightsRequestStatus, readonly DataRightsRequestStatus[]>;
export declare function canTransitionDataRights(from: DataRightsRequestStatus, to: DataRightsRequestStatus): boolean;
export declare function isTerminalDataRightsStatus(status: DataRightsRequestStatus): boolean;
export declare const ANONYMISED_NAME = "Deleted customer";
export declare function anonymisedEmail(userId: string): string;
export declare function anonymisationPatch(userId: string): {
    name: string;
    email: string;
    emailVerified: boolean;
    image: null;
    phone: null;
    firstName: null;
    lastName: null;
    gender: null;
    dateOfBirth: null;
    nationality: null;
    isActive: boolean;
    twoFactorEnabled: boolean;
};
export type DataRightsRow = DataRightsRequest & {
    handledBy?: {
        name: string | null;
    } | null;
    user?: {
        id: string;
        name: string | null;
        email: string;
    } | null;
};
export declare function toDataRightsRequestDto(row: DataRightsRow, opts?: {
    includeCustomer?: boolean;
}): DataRightsRequestDto;
