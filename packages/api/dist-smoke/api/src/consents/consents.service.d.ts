import { ConsentChannel, Prisma, User } from '@prisma/client';
import type { ConsentStatusDto } from '../../../shared/src/types/customer-platform';
import { ActivityService } from '../common/activity.service';
import { PrismaService } from '../prisma/prisma.service';
import { type ConsentAcceptanceInput } from './consent-logic';
export type RecordConsentsInput = {
    userId: string;
    acceptances: ConsentAcceptanceInput[];
    locale: string;
    applicationId?: string | null;
    channel: ConsentChannel;
    ipAddress?: string | null;
    userAgent?: string | null;
    sessionId?: string | null;
    deviceInfo?: Prisma.InputJsonValue | null;
    actorUserId?: string | null;
};
export type WithdrawConsentInput = {
    userId: string;
    code: string;
    reason?: string | null;
    actorUserId?: string | null;
    force?: boolean;
};
export declare class ConsentsService {
    private readonly prisma;
    private readonly activity;
    constructor(prisma: PrismaService, activity: ActivityService);
    statusFor(userId: string, applicationId?: string | null): Promise<ConsentStatusDto>;
    record(input: RecordConsentsInput): Promise<ConsentStatusDto>;
    withdraw(input: WithdrawConsentInput): Promise<ConsentStatusDto>;
    private openWithdrawalRequest;
    statusForApplication(user: User, applicationId: string): Promise<ConsentStatusDto>;
    private loadRecords;
    private assertOwnedApplication;
    private stampApplication;
}
