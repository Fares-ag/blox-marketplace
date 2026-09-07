import type { User } from '@prisma/client';
type AdminUserRow = Pick<User, 'id' | 'email' | 'name' | 'role' | 'companyId' | 'isActive' | 'emailVerified' | 'createdAt'>;
export type HomeBranchRef = {
    id: string;
    code: string;
    name: string;
} | null;
type WithHomeBranch = {
    homeBranch?: HomeBranchRef | null;
};
export type FinancePartnerRef = {
    id: string;
    name: string;
} | null;
type WithFinancePartner = {
    financePartner?: FinancePartnerRef | null;
};
export declare function toFinancePartnerRefDto(partner: FinancePartnerRef | undefined): {
    id: string;
    name: string;
} | null;
export declare function toAdminUserDto(user: AdminUserRow & {
    company?: {
        name: string;
    } | null;
} & WithHomeBranch & WithFinancePartner): {
    id: string;
    email: string;
    name: string;
    role: import(".prisma/client").$Enums.UserRole;
    company_id: string | null;
    company_name: string | null;
    home_branch: {
        id: string;
        code: string;
        name: string;
    } | null;
    finance_partner: {
        id: string;
        name: string;
    } | null;
    is_active: boolean;
    email_verified: boolean;
    created_at: Date;
};
export declare function toAdminUserUpdateDto(user: Pick<User, 'id' | 'email' | 'name' | 'role' | 'companyId' | 'isActive'> & WithHomeBranch & WithFinancePartner): {
    id: string;
    email: string;
    name: string;
    role: import(".prisma/client").$Enums.UserRole;
    company_id: string | null;
    home_branch: {
        id: string;
        code: string;
        name: string;
    } | null;
    finance_partner: {
        id: string;
        name: string;
    } | null;
    is_active: boolean;
};
export declare function toAdminUserProvisionDto(user: Pick<User, 'id' | 'email' | 'name' | 'role' | 'companyId' | 'isActive'> & WithHomeBranch & WithFinancePartner, extras: {
    temporaryPassword: string;
    loginUrl: string;
    companyName?: string | null;
}): {
    temporary_password: string;
    login_url: string;
    company_name: string | null;
    id: string;
    email: string;
    name: string;
    role: import(".prisma/client").$Enums.UserRole;
    company_id: string | null;
    home_branch: {
        id: string;
        code: string;
        name: string;
    } | null;
    finance_partner: {
        id: string;
        name: string;
    } | null;
    is_active: boolean;
};
export declare function toAdminUserListResponse(items: Array<AdminUserRow & {
    company?: {
        name: string;
    } | null;
} & WithHomeBranch & WithFinancePartner>, total: number, limit: number, offset: number): {
    total: number;
    limit: number;
    offset: number;
    items: {
        id: string;
        email: string;
        name: string;
        role: import(".prisma/client").$Enums.UserRole;
        company_id: string | null;
        company_name: string | null;
        home_branch: {
            id: string;
            code: string;
            name: string;
        } | null;
        finance_partner: {
            id: string;
            name: string;
        } | null;
        is_active: boolean;
        email_verified: boolean;
        created_at: Date;
    }[];
};
export {};
