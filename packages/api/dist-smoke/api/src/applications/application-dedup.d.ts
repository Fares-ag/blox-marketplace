import { ApplicationStatus } from '@prisma/client';
export declare const ACTIVE_BLOCKING_APPLICATION_STATUSES: ApplicationStatus[];
export type DedupCandidate = {
    id: string;
    status: ApplicationStatus;
    productId: string;
    createdAt?: Date | null;
};
export type DedupDecision = {
    kind: 'create';
} | {
    kind: 'resume';
    applicationId: string;
} | {
    kind: 'blocked';
    applicationId: string;
    status: ApplicationStatus;
};
export declare function decideDuplicateApplication(existing: DedupCandidate[], productId: string): DedupDecision;
export type BlockingSummary = {
    blocking: boolean;
    applicationId: string | null;
    status: ApplicationStatus | null;
    draftApplicationId: string | null;
};
export declare function summarizeBlocking(existing: DedupCandidate[], productId?: string): BlockingSummary;
export declare const IDENTITY_HOLD_REASON: "qid_identity_mismatch";
export type IdentityCandidate = {
    userId: string;
    name?: string | null;
    birthYear?: number | null;
    source?: 'user' | 'application';
};
export type IdentityConflict = {
    userId: string;
    source: 'user' | 'application';
    nameMismatch: boolean;
    birthYearMismatch: boolean;
};
export type IdentityHoldDecision = {
    reason: typeof IDENTITY_HOLD_REASON;
    conflicts: IdentityConflict[];
} | null;
export declare function decideIdentityHold(subject: IdentityCandidate, matches: IdentityCandidate[]): IdentityHoldDecision;
