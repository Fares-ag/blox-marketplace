import { ConfigService } from '@nestjs/config';
import { Prisma, UserRole } from '@prisma/client';
import { ActivityService } from '../common/activity.service';
import { EncryptionService } from '../common/encryption.service';
import { IdentityService } from '../common/identity.service';
import { PrismaService } from '../prisma/prisma.service';
import { type IdentityHoldDecision } from './application-dedup';
import { type ProductRuleEnforcement } from './application-rules';
import { type NormalizedCustomerSnapshot } from './customer-snapshot';
export declare class ApplicationIntakeService {
    private readonly prisma;
    private readonly activity;
    private readonly encryption;
    private readonly identity;
    private readonly config;
    constructor(prisma: PrismaService, activity: ActivityService, encryption: EncryptionService, identity: IdentityService, config: ConfigService);
    ruleEnforcement(): ProductRuleEnforcement;
    qidHash(qid: string | null | undefined): string | null;
    evaluateIdentity(input: {
        userId: string;
        qid: string | null | undefined;
        name: string | null | undefined;
        birthYear: number | null | undefined;
    }): Promise<IdentityHoldDecision>;
    holdColumns(decision: IdentityHoldDecision, now?: Date): {
        identityHoldReason?: undefined;
        identityHoldAt?: undefined;
        identityHoldClearedAt?: undefined;
        identityHoldClearedById?: undefined;
    } | {
        identityHoldReason: "qid_identity_mismatch";
        identityHoldAt: Date;
        identityHoldClearedAt: null;
        identityHoldClearedById: null;
    };
    recordHold(input: {
        applicationId: string;
        companyId: string;
        actorUserId: string | null;
        decision: NonNullable<IdentityHoldDecision>;
    }): Promise<void>;
    guarantorConsentCompleted(applicationId: string): Promise<boolean>;
    defaultLenderId(): Promise<string | null>;
    userProfileData(user: {
        name: string | null;
        phone: string | null;
        qid: string | null;
        qidEnc?: string | null;
    }, normalized: NormalizedCustomerSnapshot): Prisma.UserUpdateInput;
    notifyOps(companyId: string, roles: UserRole[], title: string | ((role: UserRole) => string), body: string, linkPath: string): Promise<void>;
}
