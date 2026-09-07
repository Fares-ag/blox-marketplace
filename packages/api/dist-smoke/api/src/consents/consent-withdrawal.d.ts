import { ApplicationStatus } from '@prisma/client';
export declare const WITHDRAWAL_BLOCKING_STATUSES: ApplicationStatus[];
export type WithdrawalApplication = {
    id: string;
    status: ApplicationStatus;
    consentsCompletedAt: Date | null;
    consentCodes: readonly string[];
};
export declare function applicationCarriesConsent(app: WithdrawalApplication, code: string): boolean;
export type WithdrawalDecision = {
    allowed: boolean;
    blockingApplicationIds: string[];
    draftIdsToClear: string[];
};
export declare function consentWithdrawalDecision(code: string, applications: WithdrawalApplication[]): WithdrawalDecision;
