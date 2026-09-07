import { DataRightsRequestKind, DataRightsRequestStatus, User } from '@prisma/client';
import type { ConsentStatusDto, CustomerDocumentDto, CustomerProfileDto, DataRightsRequestDto } from '../../../shared/src/types/customer-platform';
import { ActivityService } from '../common/activity.service';
import { IdentityService } from '../common/identity.service';
import { ConsentsService } from '../consents/consents.service';
import { financingFromPricing } from '../partner/partner-logic';
import { PrismaService } from '../prisma/prisma.service';
import { CustomerDocumentsService } from './customer-documents.service';
export type CreateDataRightsInput = {
    kind: DataRightsRequestKind;
    details?: string | null;
    consent_code?: string | null;
};
export type TransitionDataRightsInput = {
    status: DataRightsRequestStatus;
    resolution_note?: string | null;
};
export type CustomerDataExport = {
    generated_at: string;
    profile: CustomerProfileDto & {
        qid: string | null;
        email_verified: boolean;
        created_at: string;
    };
    applications: Array<{
        id: string;
        status: string;
        created_at: string;
        submitted_at: string | null;
        activated_at: string | null;
        completed_at: string | null;
        consents_completed_at: string | null;
        company_name: string;
        finance_partner_name: string | null;
        vehicle: {
            make: string;
            model: string;
            model_year: number;
        };
        financing: ReturnType<typeof financingFromPricing>;
        customer_snapshot: unknown;
    }>;
    consents: ConsentStatusDto;
    documents: CustomerDocumentDto[];
    notifications: Array<{
        id: string;
        title: string;
        body: string | null;
        link_path: string | null;
        read_at: string | null;
        created_at: string;
    }>;
    data_rights_requests: DataRightsRequestDto[];
};
export declare class DataRightsService {
    private readonly prisma;
    private readonly activity;
    private readonly identity;
    private readonly consents;
    private readonly documents;
    constructor(prisma: PrismaService, activity: ActivityService, identity: IdentityService, consents: ConsentsService, documents: CustomerDocumentsService);
    listMine(userId: string): Promise<DataRightsRequestDto[]>;
    create(user: User, input: CreateDataRightsInput): Promise<DataRightsRequestDto>;
    exportFor(user: User): Promise<CustomerDataExport>;
    listForOps(status?: DataRightsRequestStatus | null): Promise<DataRightsRequestDto[]>;
    transition(actor: User, id: string, input: TransitionDataRightsInput): Promise<DataRightsRequestDto>;
    private anonymiseUser;
    private notifyPrivacyTeam;
    private notifyCustomer;
}
