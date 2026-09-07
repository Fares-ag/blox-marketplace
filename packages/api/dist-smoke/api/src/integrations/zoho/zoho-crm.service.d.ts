import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../storage/storage.service';
import { KycBridgeService } from '../../kyc/kyc-bridge.service';
import { ActivityService } from '../../common/activity.service';
import { IdentityService } from '../../common/identity.service';
import { ZohoAuthService } from './zoho-auth.service';
import { ZohoConfig } from './zoho-config';
export declare class ZohoCrmService {
    private readonly prisma;
    private readonly auth;
    private readonly config;
    private readonly activity;
    private readonly storage;
    private readonly kycBridge;
    private readonly identity;
    private readonly logger;
    constructor(prisma: PrismaService, auth: ZohoAuthService, config: ZohoConfig, activity: ActivityService, storage: StorageService, kycBridge: KycBridgeService, identity: IdentityService);
    syncApplicationToZoho(applicationId: string, actorUserId?: string): Promise<{
        zohoLeadId: string | null;
        error?: string;
        documentsUploaded?: number;
    }>;
    private recordFailure;
    private zohoFetch;
    private createLead;
    private updateLead;
    private findLeadIdByEmail;
    private syncDocuments;
    private listAttachmentNames;
    private uploadAttachment;
}
