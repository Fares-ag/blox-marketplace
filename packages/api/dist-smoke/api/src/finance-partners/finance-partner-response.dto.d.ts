import type { FinancePartner, FinancePartnerBranch } from '@prisma/client';
export declare const FINANCE_PARTNER_INCLUDE: {
    branches: {
        orderBy: ({
            active: "desc";
            name?: undefined;
        } | {
            name: "asc";
            active?: undefined;
        })[];
    };
    _count: {
        select: {
            applications: true;
        };
    };
};
export type FinancePartnerRow = FinancePartner & {
    branches?: FinancePartnerBranch[];
    _count?: {
        applications?: number;
    };
};
export declare function toFinancePartnerDto(partner: Pick<FinancePartner, 'id' | 'code' | 'name' | 'crmAdapter'>): {
    id: string;
    code: string;
    name: string;
    crm_adapter: import(".prisma/client").$Enums.CrmAdapter;
};
export declare function toFinancePartnerBranchDto(branch: FinancePartnerBranch): {
    id: string;
    partner_id: string;
    code: string;
    name: string;
    city: string | null;
    active: boolean;
};
export declare function toFinancePartnerAdminDto(partner: FinancePartnerRow): {
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
};
