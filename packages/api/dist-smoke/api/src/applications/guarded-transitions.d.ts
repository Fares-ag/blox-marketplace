import { ApplicationStatus, Prisma } from '@prisma/client';
export type GuardConflictCode = 'stale_transition' | 'vehicle_unavailable' | 'quote_unavailable';
export declare function assertRowsUpdated(count: number, code?: GuardConflictCode): void;
export declare function transitionApplication(tx: Prisma.TransactionClient, id: string, fromStatus: ApplicationStatus, data: Prisma.ApplicationUpdateManyMutationInput): Promise<void>;
