import { ConfigService } from '@nestjs/config';
import { AssistedSessionStatus, Prisma, User } from '@prisma/client';
import type { AssistedSessionDto, AssistedSessionPublicDto, CompanyBrandingDto, ConsentStatusDto } from '../../../shared/src/types/customer-platform';
import { ActivityService } from '../common/activity.service';
import { AppConfigService } from '../config/app-config.service';
import type { ConsentAcceptanceInput } from '../consents/consent-logic';
import { ConsentsService } from '../consents/consents.service';
import { KycBridgeService } from '../kyc/kyc-bridge.service';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { SmsService } from '../sms/sms.service';
export type CreateAssistedSessionInput = {
    applicationId: string;
    phone: string;
    email?: string | null;
};
export type AssistConsentsInput = {
    acceptances: ConsentAcceptanceInput[];
    locale: string;
};
export type AssistRequestMeta = {
    ipAddress: string | null;
    userAgent: string | null;
};
export declare function brandingFromCompany(company: {
    name: string;
    logoUrl: string | null;
    branding: Prisma.JsonValue | null;
}): CompanyBrandingDto;
export declare class AssistService {
    private readonly prisma;
    private readonly activity;
    private readonly consents;
    private readonly kycBridge;
    private readonly sms;
    private readonly mail;
    private readonly appConfig;
    private readonly logger;
    private readonly secret;
    constructor(prisma: PrismaService, activity: ActivityService, consents: ConsentsService, kycBridge: KycBridgeService, sms: SmsService, mail: MailService, appConfig: AppConfigService, config: ConfigService);
    create(user: User, input: CreateAssistedSessionInput): Promise<AssistedSessionDto>;
    list(user: User, applicationId: string): Promise<AssistedSessionDto[]>;
    resend(user: User, id: string): Promise<AssistedSessionDto>;
    cancel(user: User, id: string): Promise<AssistedSessionDto>;
    publicView(token: string): Promise<AssistedSessionPublicDto>;
    verifyOtp(token: string, code: string): Promise<{
        proof: string;
        status: AssistedSessionStatus;
    }>;
    resendPublic(token: string): Promise<{
        status: AssistedSessionStatus;
        otp_expires_in_sec: number;
    }>;
    recordConsents(token: string, proof: string | string[] | undefined, input: AssistConsentsInput, meta: AssistRequestMeta): Promise<ConsentStatusDto>;
    startIdentity(token: string, proof: string | string[] | undefined): Promise<{
        kyc_url: string;
        status: AssistedSessionStatus;
    }>;
    complete(token: string, proof: string | string[] | undefined): Promise<{
        status: AssistedSessionStatus;
    }>;
    private issueNewCode;
    private byToken;
    private openSession;
    private assertOpen;
    private provenSession;
    private staffSession;
    private assertStaffScope;
    private linkFor;
    private deliverSms;
    private toDto;
    private toPublicDto;
}
