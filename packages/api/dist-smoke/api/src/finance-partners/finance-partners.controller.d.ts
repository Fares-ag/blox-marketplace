import { BreOwnership, CrmAdapter, FinancePartnerEngagementMode, User } from '@prisma/client';
import { ActivityService } from '../common/activity.service';
import { PrismaService } from '../prisma/prisma.service';
declare class CreateFinancePartnerDto {
    code: string;
    name: string;
    engagement_mode: FinancePartnerEngagementMode;
    bre_ownership: BreOwnership;
    is_default_lender?: boolean;
    contact_name?: string | null;
    contact_email?: string | null;
    contact_phone?: string | null;
    notes?: string | null;
    active?: boolean;
    crm_adapter?: CrmAdapter;
}
declare class UpdateFinancePartnerDto {
    code?: string;
    name?: string;
    engagement_mode?: FinancePartnerEngagementMode;
    bre_ownership?: BreOwnership;
    is_default_lender?: boolean;
    contact_name?: string | null;
    contact_email?: string | null;
    contact_phone?: string | null;
    notes?: string | null;
    active?: boolean;
    crm_adapter?: CrmAdapter;
}
declare class CreateFinancePartnerBranchDto {
    code: string;
    name: string;
    city?: string | null;
}
declare class UpdateFinancePartnerBranchDto {
    name?: string;
    city?: string | null;
    active?: boolean;
}
export declare class FinancePartnersController {
    private readonly prisma;
    private readonly activity;
    constructor(prisma: PrismaService, activity: ActivityService);
    list(): Promise<{
        id: string;
        code: string;
        name: string;
        active: boolean;
        crm_adapter: import(".prisma/client").$Enums.CrmAdapter;
        engagement_mode: import(".prisma/client").$Enums.FinancePartnerEngagementMode;
        bre_ownership: import(".prisma/client").$Enums.BreOwnership;
        is_default_lender: boolean;
        contact_name: string | null;
        contact_email: string | null;
        contact_phone: string | null;
        notes: string | null;
        branches: {
            id: string;
            partner_id: string;
            code: string;
            name: string;
            city: string | null;
            active: boolean;
        }[];
        application_count: number;
    }[]>;
    create(user: User, dto: CreateFinancePartnerDto): Promise<{
        id: string;
        code: string;
        name: string;
        active: boolean;
        crm_adapter: import(".prisma/client").$Enums.CrmAdapter;
        engagement_mode: import(".prisma/client").$Enums.FinancePartnerEngagementMode;
        bre_ownership: import(".prisma/client").$Enums.BreOwnership;
        is_default_lender: boolean;
        contact_name: string | null;
        contact_email: string | null;
        contact_phone: string | null;
        notes: string | null;
        branches: {
            id: string;
            partner_id: string;
            code: string;
            name: string;
            city: string | null;
            active: boolean;
        }[];
        application_count: number;
    }>;
    update(user: User, id: string, dto: UpdateFinancePartnerDto): Promise<{
        id: string;
        code: string;
        name: string;
        active: boolean;
        crm_adapter: import(".prisma/client").$Enums.CrmAdapter;
        engagement_mode: import(".prisma/client").$Enums.FinancePartnerEngagementMode;
        bre_ownership: import(".prisma/client").$Enums.BreOwnership;
        is_default_lender: boolean;
        contact_name: string | null;
        contact_email: string | null;
        contact_phone: string | null;
        notes: string | null;
        branches: {
            id: string;
            partner_id: string;
            code: string;
            name: string;
            city: string | null;
            active: boolean;
        }[];
        application_count: number;
    }>;
    createBranch(user: User, id: string, dto: CreateFinancePartnerBranchDto): Promise<{
        id: string;
        partner_id: string;
        code: string;
        name: string;
        city: string | null;
        active: boolean;
    }>;
    updateBranch(user: User, id: string, branchId: string, dto: UpdateFinancePartnerBranchDto): Promise<{
        id: string;
        partner_id: string;
        code: string;
        name: string;
        city: string | null;
        active: boolean;
    }>;
    private requirePartner;
}
export {};
