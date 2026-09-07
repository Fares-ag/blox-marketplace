import { User } from '@prisma/client';
import { type AuthRequest } from '../auth/guards';
import { ConsentsService } from './consents.service';
export declare class ConsentAcceptanceDto {
    code: string;
    version: string;
}
declare class RecordConsentsDto {
    acceptances: ConsentAcceptanceDto[];
    locale: 'en' | 'ar';
    application_id?: string;
}
declare class WithdrawConsentDto {
    reason?: string;
}
export declare class ConsentsController {
    private readonly consents;
    constructor(consents: ConsentsService);
    status(user: User, applicationId?: string): Promise<import("@drivemarket/shared/src/types/customer-platform").ConsentStatusDto>;
    record(user: User, dto: RecordConsentsDto, req: AuthRequest): Promise<import("@drivemarket/shared/src/types/customer-platform").ConsentStatusDto>;
    withdraw(user: User, code: string, dto: WithdrawConsentDto): Promise<import("@drivemarket/shared/src/types/customer-platform").ConsentStatusDto>;
    opsStatus(user: User, id: string): Promise<import("@drivemarket/shared/src/types/customer-platform").ConsentStatusDto>;
}
export {};
