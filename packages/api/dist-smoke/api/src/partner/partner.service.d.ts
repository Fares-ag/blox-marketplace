import { ApplicationStatus, User } from '@prisma/client';
import type { PartnerApplicationDto } from '../../../shared/src/types/customer-platform';
import { ActivityService } from '../common/activity.service';
import { KycBridgeService } from '../kyc/kyc-bridge.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { type PartnerSummary } from './partner-logic';
export type PartnerListQuery = {
    status?: ApplicationStatus | null;
    limit: number;
    offset: number;
};
export type PartnerListResponse = {
    total: number;
    limit: number;
    offset: number;
    items: PartnerApplicationDto[];
};
export type PartnerFile = {
    buffer: Buffer;
    contentType: string;
    filename: string;
};
export declare class PartnerService {
    private readonly prisma;
    private readonly activity;
    private readonly storage;
    private readonly kycBridge;
    constructor(prisma: PrismaService, activity: ActivityService, storage: StorageService, kycBridge: KycBridgeService);
    list(user: User, query: PartnerListQuery): Promise<PartnerListResponse>;
    detail(user: User, id: string): Promise<PartnerApplicationDto>;
    documentFile(user: User, id: string, docId: string): Promise<PartnerFile>;
    summary(user: User): Promise<PartnerSummary>;
    private partnerIdOf;
    private readStored;
}
