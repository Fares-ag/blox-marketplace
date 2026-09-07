import { ApplicationStatus, UserRole } from '@prisma/client';
export type TransitionActor = 'customer' | 'credit' | 'finance' | 'admin' | 'dealer';
type TransitionRule = {
    from: ApplicationStatus;
    to: ApplicationStatus;
    actors: TransitionActor[];
    reasonRequired?: boolean;
};
export declare const ACTIVATE_FROM_STATUSES: ApplicationStatus[];
export declare const ADMIN_ACTIVATE_FROM_STATUSES: ApplicationStatus[];
export declare const FINANCE_ACTIVATION_QUEUE_STATUSES: ApplicationStatus[];
export declare function allowedTargets(from: ApplicationStatus, actor: TransitionActor): ApplicationStatus[];
export declare const CREDIT_PIPELINE_STATUSES: ApplicationStatus[];
export declare const CREDIT_QUEUE_STATUSES: ApplicationStatus[];
export declare function roleToActor(role: UserRole): TransitionActor | null;
export declare function findTransitionRule(from: ApplicationStatus, to: ApplicationStatus): TransitionRule | undefined;
export declare function assertOpsTransitionAllowed(from: ApplicationStatus, to: ApplicationStatus, role: UserRole): void;
export declare function opsTransitionRequiresReason(from: ApplicationStatus, to: ApplicationStatus): boolean;
export {};
