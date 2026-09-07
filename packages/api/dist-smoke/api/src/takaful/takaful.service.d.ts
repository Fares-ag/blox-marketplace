import { User } from '@prisma/client';
import type { TakafulPolicyDto } from '../../../shared/src/types/customer-platform';
import { ActivityService } from '../common/activity.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { type TakafulCoverageType } from './takaful-dto';
export type TakafulPolicyInput = {
    provider?: string;
    policy_number?: string;
    coverage_type?: TakafulCoverageType;
    coverage_amount?: number | null;
    premium_amount?: number | null;
    effective_from?: string | null;
    expires_at?: string | null;
    riders?: string[];
};
export type DeclareTakafulInput = TakafulPolicyInput & {
    provider: string;
    policy_number: string;
    coverage_type: TakafulCoverageType;
    declaration_accepted: boolean;
};
export type TakafulFile = {
    buffer: Buffer;
    contentType: string;
    filename: string;
};
export declare class TakafulService {
    private readonly prisma;
    private readonly storage;
    private readonly activity;
    constructor(prisma: PrismaService, storage: StorageService, activity: ActivityService);
    listForCustomer(user: User, applicationId: string): Promise<TakafulPolicyDto[]>;
    listForOps(user: User, applicationId: string): Promise<TakafulPolicyDto[]>;
    declare(user: User, applicationId: string, input: DeclareTakafulInput): Promise<TakafulPolicyDto>;
    update(user: User, applicationId: string, policyId: string, input: TakafulPolicyInput): Promise<TakafulPolicyDto>;
    uploadDocument(user: User, applicationId: string, policyId: string, file: Express.Multer.File | undefined): Promise<TakafulPolicyDto>;
    downloadDocument(user: User, applicationId: string, policyId: string): Promise<TakafulFile>;
    verify(user: User, applicationId: string, policyId: string): Promise<TakafulPolicyDto>;
    private listDto;
    private loadApplication;
    private ownedApplication;
    private viewableApplication;
    private policyOf;
    private parseDates;
    private notifyVerifiers;
}
