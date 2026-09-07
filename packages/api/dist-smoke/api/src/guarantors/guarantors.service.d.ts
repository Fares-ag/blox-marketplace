import { ConfigService } from '@nestjs/config';
import { GuarantorSessionStatus, User } from '@prisma/client';
import type { GuarantorSessionDto, GuarantorSessionPublicDto } from '../../../shared/src/types/customer-platform';
import { ActivityService } from '../common/activity.service';
import { EncryptionService } from '../common/encryption.service';
import { AppConfigService } from '../config/app-config.service';
import { KycPlatformClient } from '../kyc/kyc-platform.client';
import { PrismaService } from '../prisma/prisma.service';
import { SmsService } from '../sms/sms.service';
import { type GuarantorAcceptanceInput, type GuarantorConsentCode } from './guarantor-logic';
export type GuarantorConsentsInput = {
    acceptances: GuarantorAcceptanceInput[];
    locale: string;
};
export type GuarantorRequestMeta = {
    ipAddress: string | null;
    userAgent: string | null;
};
export declare class GuarantorsService {
    private readonly prisma;
    private readonly activity;
    private readonly encryption;
    private readonly kyc;
    private readonly sms;
    private readonly appConfig;
    private readonly logger;
    private readonly secret;
    constructor(prisma: PrismaService, activity: ActivityService, encryption: EncryptionService, kyc: KycPlatformClient, sms: SmsService, appConfig: AppConfigService, config: ConfigService);
    create(user: User, applicationId: string): Promise<GuarantorSessionDto>;
    current(user: User, applicationId: string): Promise<GuarantorSessionDto | null>;
    resend(user: User, applicationId: string): Promise<GuarantorSessionDto>;
    cancel(user: User, applicationId: string): Promise<GuarantorSessionDto>;
    publicView(token: string): Promise<GuarantorSessionPublicDto>;
    verifyOtp(token: string, code: string): Promise<{
        proof: string;
        status: GuarantorSessionStatus;
    }>;
    resendPublic(token: string): Promise<{
        status: GuarantorSessionStatus;
        otp_expires_in_sec: number;
    }>;
    recordConsents(token: string, proof: string | string[] | undefined, input: GuarantorConsentsInput, meta: GuarantorRequestMeta): Promise<{
        status: GuarantorSessionStatus;
        consents_completed_at: string;
        accepted: GuarantorConsentCode[];
    }>;
    startIdentity(token: string, proof: string | string[] | undefined): Promise<{
        kyc_url: string;
        status: GuarantorSessionStatus;
    }>;
    complete(token: string, proof: string | string[] | undefined): Promise<{
        status: GuarantorSessionStatus;
    }>;
    private issueNewCode;
    private latest;
    private byToken;
    private openSession;
    private assertOpen;
    private provenSession;
    private scopedApplication;
    private linkFor;
    private deliverSms;
    private toPublicDto;
}
