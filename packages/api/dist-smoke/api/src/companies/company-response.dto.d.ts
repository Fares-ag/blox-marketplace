import type { Company, Prisma } from '@prisma/client';
export declare function toAdminCompanyDto(company: Company & {
    parentCompany?: {
        id: string;
        name: string;
    } | null;
    _count?: {
        childCompanies?: number;
    };
}): {
    id: string;
    name: string;
    code: string | null;
    status: import(".prisma/client").$Enums.CompanyStatus;
    kind: import(".prisma/client").$Enums.CompanyKind;
    parent_company_id: string | null;
    parent_name: string | null;
    child_count: number;
    can_pay: boolean;
    allow_direct_activate: boolean;
    contact_email: string | null;
    contact_phone: string | null;
    logo_url: string | null;
    address: string | null;
    branding: import("./branding").CompanyBranding | null;
    created_at: Date;
    updated_at: Date;
};
export declare function toDealerCompanyDto(company: Company): {
    id: string;
    name: string;
    code: string | null;
    status: import(".prisma/client").$Enums.CompanyStatus;
    kind: import(".prisma/client").$Enums.CompanyKind;
    parent_company_id: string | null;
    logo_url: string | null;
    branding: import("./branding").CompanyBranding | null;
    contact_email: string | null;
    contact_phone: string | null;
    address: string | null;
    allow_direct_activate: boolean;
    can_pay: boolean;
};
export declare function toPublicCompanyListItemDto(company: {
    id: string;
    name: string;
    code: string | null;
    logoUrl: string | null;
    published_count: number;
}): {
    id: string;
    name: string;
    code: string | null;
    logo_url: string | null;
    published_count: number;
};
export declare function toPublicCompanyDetailDto(company: {
    id: string;
    name: string;
    code: string | null;
    logoUrl: string | null;
    address: string | null;
    contactPhone: string | null;
    branding?: Prisma.JsonValue | null;
    published_count: number;
}): {
    id: string;
    name: string;
    code: string | null;
    logo_url: string | null;
    branding: import("./branding").CompanyBranding | null;
    address: string | null;
    contact_phone: string | null;
    published_count: number;
};
