import { User } from '@prisma/client';
import type { Response } from 'express';
import { type AuthRequest } from '../auth/guards';
import { GuarantorsService } from './guarantors.service';
declare class GuarantorAcceptanceDto {
    code: string;
    version: string;
}
declare class VerifyGuarantorOtpDto {
    code: string;
}
declare class GuarantorConsentsDto {
    acceptances: GuarantorAcceptanceDto[];
    locale: 'en' | 'ar';
}
export declare class GuarantorsController {
    private readonly guarantors;
    constructor(guarantors: GuarantorsService);
    create(user: User, id: string): Promise<import("@drivemarket/shared/src/types/customer-platform").GuarantorSessionDto>;
    current(user: User, id: string, res: Response): Promise<void>;
    resend(user: User, id: string): Promise<import("@drivemarket/shared/src/types/customer-platform").GuarantorSessionDto>;
    cancel(user: User, id: string): Promise<import("@drivemarket/shared/src/types/customer-platform").GuarantorSessionDto>;
    view(token: string): Promise<import("@drivemarket/shared/src/types/customer-platform").GuarantorSessionPublicDto>;
    verifyOtp(token: string, dto: VerifyGuarantorOtpDto): Promise<{
        proof: string;
        status: import(".prisma/client").GuarantorSessionStatus;
    }>;
    resendOtp(token: string): Promise<{
        status: import(".prisma/client").GuarantorSessionStatus;
        otp_expires_in_sec: number;
    }>;
    consents(token: string, proof: string | undefined, dto: GuarantorConsentsDto, req: AuthRequest): Promise<{
        status: import(".prisma/client").GuarantorSessionStatus;
        consents_completed_at: string;
        accepted: import("./guarantor-logic").GuarantorConsentCode[];
    }>;
    startIdentity(token: string, proof: string | undefined): Promise<{
        kyc_url: string;
        status: import(".prisma/client").GuarantorSessionStatus;
    }>;
    complete(token: string, proof: string | undefined): Promise<{
        status: import(".prisma/client").GuarantorSessionStatus;
    }>;
}
export {};
