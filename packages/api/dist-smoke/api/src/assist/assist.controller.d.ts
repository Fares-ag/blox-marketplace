import { User } from '@prisma/client';
import { type AuthRequest } from '../auth/guards';
import { ConsentAcceptanceDto } from '../consents/consents.controller';
import { AssistService } from './assist.service';
declare class CreateAssistedSessionDto {
    application_id: string;
    phone: string;
    email?: string;
}
declare class VerifyOtpDto {
    code: string;
}
declare class AssistConsentsDto {
    acceptances: ConsentAcceptanceDto[];
    locale: 'en' | 'ar';
}
export declare const ASSIST_PROOF_HEADER = "x-assist-proof";
export declare class AssistController {
    private readonly assist;
    constructor(assist: AssistService);
    create(user: User, dto: CreateAssistedSessionDto): Promise<import("@drivemarket/shared/src/types/customer-platform").AssistedSessionDto>;
    list(user: User, applicationId?: string): Promise<import("@drivemarket/shared/src/types/customer-platform").AssistedSessionDto[]>;
    resend(user: User, id: string): Promise<import("@drivemarket/shared/src/types/customer-platform").AssistedSessionDto>;
    cancel(user: User, id: string): Promise<import("@drivemarket/shared/src/types/customer-platform").AssistedSessionDto>;
    view(token: string): Promise<import("@drivemarket/shared/src/types/customer-platform").AssistedSessionPublicDto>;
    verifyOtp(token: string, dto: VerifyOtpDto): Promise<{
        proof: string;
        status: import(".prisma/client").AssistedSessionStatus;
    }>;
    resendOtp(token: string): Promise<{
        status: import(".prisma/client").AssistedSessionStatus;
        otp_expires_in_sec: number;
    }>;
    consents(token: string, proof: string | undefined, dto: AssistConsentsDto, req: AuthRequest): Promise<import("@drivemarket/shared/src/types/customer-platform").ConsentStatusDto>;
    startIdentity(token: string, proof: string | undefined): Promise<{
        kyc_url: string;
        status: import(".prisma/client").AssistedSessionStatus;
    }>;
    complete(token: string, proof: string | undefined): Promise<{
        status: import(".prisma/client").AssistedSessionStatus;
    }>;
}
export {};
