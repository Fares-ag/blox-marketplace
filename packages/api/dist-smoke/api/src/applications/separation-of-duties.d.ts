import type { ConfigService } from '@nestjs/config';
import type { Prisma } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
export type ActivityLogEntry = {
    actorUserId: string | null;
    action: string;
    fromValue?: string | null;
    toValue?: string | null;
    metadata?: unknown;
    createdAt?: Date;
};
type PrismaLike = Pick<PrismaService, 'activityLog'> | Prisma.TransactionClient;
export declare function separationOfDutiesEnabled(opts?: {
    envValue?: string | null;
    companyFlag?: boolean | null;
}): boolean;
export declare function resolveSeparationOfDutiesEnabled(config: ConfigService, companyFlag?: boolean | null): boolean;
export declare function isCreditApprovalLog(entry: ActivityLogEntry): boolean;
export declare function findCreditApproverId(logs: ActivityLogEntry[]): string | null;
export declare function violatesSeparationOfDuties(actorUserId: string, creditApproverId: string | null): boolean;
export declare function assertActorNotCreditApprover(actorUserId: string, creditApproverId: string | null): void;
export declare function assertDualControlWaive(confirmActorUserId: string, requestedByUserId: string | null): void;
export declare function resolveCreditApproverId(prisma: PrismaLike, applicationId: string): Promise<string | null>;
export declare function assertSeparationOfDutiesForApplication(prisma: PrismaLike, actorUserId: string, applicationId: string, enabled: boolean): Promise<void>;
export {};
