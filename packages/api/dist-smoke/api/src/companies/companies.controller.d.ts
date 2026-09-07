import { CompanyKind, User } from '@prisma/client';
import { ActivityService } from '../common/activity.service';
import { PaginationQueryDto } from '../common/pagination.dto';
import { PrismaService } from '../prisma/prisma.service';
declare class CreateCompanyDto {
    name: string;
    code?: string;
    contactEmail?: string;
    dealerUserId?: string;
    kind?: CompanyKind;
    parentCompanyId?: string;
}
declare class CompanyBrandingDto {
    primary?: string | null;
    accent?: string | null;
    logo_url?: string | null;
    display_name?: string | null;
    tagline?: string | null;
}
declare class UpdateCompanyDto {
    name?: string;
    code?: string;
    description?: string;
    status?: 'active' | 'inactive';
    allowDirectActivate?: boolean;
    canPay?: boolean;
    kind?: CompanyKind;
    parentCompanyId?: string | null;
    branding?: CompanyBrandingDto;
}
declare class CreateBranchDto {
    code: string;
    name: string;
    city?: string;
    address?: string;
    phone?: string;
}
declare class UpdateBranchDto {
    name?: string;
    city?: string | null;
    address?: string | null;
    phone?: string | null;
    active?: boolean;
}
export declare class CompaniesController {
    private readonly prisma;
    private readonly activity;
    constructor(prisma: PrismaService, activity: ActivityService);
    listPublic(query: PaginationQueryDto): Promise<{
        total: number;
        limit: number;
        offset: number;
        items: {
            id: string;
            name: string;
            code: string | null;
            logo_url: string | null;
            published_count: number;
        }[];
    }>;
    byCode(code: string): Promise<{
        id: string;
        name: string;
        code: string | null;
        logo_url: string | null;
        branding: import("./branding").CompanyBranding | null;
        address: string | null;
        contact_phone: string | null;
        published_count: number;
    } | null>;
    listAll(user: User, query: PaginationQueryDto): Promise<{
        total: number;
        limit: number;
        offset: number;
        items: {
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
        }[];
    }>;
    create(user: User, dto: CreateCompanyDto): Promise<{
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
    }>;
    update(user: User, id: string, dto: UpdateCompanyDto): Promise<{
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
    }>;
    children(user: User, id: string): Promise<{
        items: {
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
        }[];
    }>;
    agents(user: User, id: string): Promise<{
        items: {
            home_branch: {
                id: string;
                code: string;
                name: string;
            } | null;
            name: string;
            id: string;
            email: string;
            role: import(".prisma/client").$Enums.UserRole;
        }[];
    }>;
    branches(user: User, id: string): Promise<{
        id: string;
        company_id: string;
        code: string;
        name: string;
        city: string | null;
        address: string | null;
        phone: string | null;
        active: boolean;
        staff_count: number;
        created_at: string;
    }[]>;
    createBranch(user: User, id: string, dto: CreateBranchDto): Promise<{
        id: string;
        company_id: string;
        code: string;
        name: string;
        city: string | null;
        address: string | null;
        phone: string | null;
        active: boolean;
        staff_count: number;
        created_at: string;
    }>;
    updateBranch(user: User, id: string, branchId: string, dto: UpdateBranchDto): Promise<{
        id: string;
        company_id: string;
        code: string;
        name: string;
        city: string | null;
        address: string | null;
        phone: string | null;
        active: boolean;
        staff_count: number;
        created_at: string;
    }>;
    mine(user: User): Promise<{
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
    } | null>;
    private assertBranchScope;
}
export {};
