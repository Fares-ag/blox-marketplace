import { User } from '@prisma/client';
import type { Response } from 'express';
import { type TakafulCoverageType } from './takaful-dto';
import { TakafulService } from './takaful.service';
declare class UpdateTakafulDto {
    provider?: string;
    policy_number?: string;
    coverage_type?: TakafulCoverageType;
    coverage_amount?: number | null;
    premium_amount?: number | null;
    effective_from?: string | null;
    expires_at?: string | null;
    riders?: string[];
}
declare class DeclareTakafulDto extends UpdateTakafulDto {
    provider: string;
    policy_number: string;
    coverage_type: TakafulCoverageType;
    declaration_accepted: boolean;
}
export declare class TakafulController {
    private readonly takaful;
    constructor(takaful: TakafulService);
    list(user: User, id: string): Promise<import("@drivemarket/shared/src/types/customer-platform").TakafulPolicyDto[]>;
    declare(user: User, id: string, dto: DeclareTakafulDto): Promise<import("@drivemarket/shared/src/types/customer-platform").TakafulPolicyDto>;
    update(user: User, id: string, policyId: string, dto: UpdateTakafulDto): Promise<import("@drivemarket/shared/src/types/customer-platform").TakafulPolicyDto>;
    uploadDocument(user: User, id: string, policyId: string, file: Express.Multer.File | undefined): Promise<import("@drivemarket/shared/src/types/customer-platform").TakafulPolicyDto>;
    downloadDocument(user: User, id: string, policyId: string, res: Response): Promise<void>;
    opsList(user: User, id: string): Promise<import("@drivemarket/shared/src/types/customer-platform").TakafulPolicyDto[]>;
    opsDownloadDocument(user: User, id: string, policyId: string, res: Response): Promise<void>;
    opsVerify(user: User, id: string, policyId: string): Promise<import("@drivemarket/shared/src/types/customer-platform").TakafulPolicyDto>;
}
export {};
