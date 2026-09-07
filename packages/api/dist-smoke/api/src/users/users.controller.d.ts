import { OfficerScope, User, UserRole } from '@prisma/client';
import { type AuthInstance } from '../auth/auth.constants';
import { MailService } from '../mail/mail.service';
import { AppConfigService } from '../config/app-config.service';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityService } from '../common/activity.service';
import { PaginationQueryDto } from '../common/pagination.dto';
declare class UpdateUserDto {
    name?: string;
    isActive?: boolean;
    role?: UserRole;
    companyId?: string | null;
    creditScope?: OfficerScope;
    financeScope?: OfficerScope;
    creditCompanyIds?: string[];
    financeCompanyIds?: string[];
    home_branch_id?: string | null;
    homeBranchId?: string | null;
    finance_partner_id?: string | null;
    financePartnerId?: string | null;
}
declare class CreateUserDto {
    email: string;
    name: string;
    role: UserRole;
    companyId?: string;
    creditScope?: OfficerScope;
    financeScope?: OfficerScope;
    creditCompanyIds?: string[];
    financeCompanyIds?: string[];
    home_branch_id?: string | null;
    homeBranchId?: string | null;
    finance_partner_id?: string | null;
    financePartnerId?: string | null;
}
declare class InviteDealerAgentDto {
    email: string;
    name: string;
    home_branch_id?: string | null;
    homeBranchId?: string | null;
}
declare class SetPasswordDto {
    password?: string;
    sendEmail?: boolean;
}
export declare class UsersController {
    private readonly prisma;
    private readonly activity;
    private readonly mail;
    private readonly appConfig;
    private readonly auth;
    constructor(prisma: PrismaService, activity: ActivityService, mail: MailService, appConfig: AppConfigService, auth: AuthInstance);
    list(actor: User, query: PaginationQueryDto): Promise<{
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
    }>;
    one(actor: User, id: string): Promise<{
        company_name: string | null;
        credit_scope: import(".prisma/client").$Enums.OfficerScope;
        finance_scope: import(".prisma/client").$Enums.OfficerScope;
        credit_company_ids: string[];
        finance_company_ids: string[];
        applications_count: number;
        agent_applications_count: number;
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
        email_verified: boolean;
        created_at: Date;
    }>;
    create(actor: User, dto: CreateUserDto): Promise<{
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
    }>;
    inviteDealerAgent(actor: User, dto: InviteDealerAgentDto): Promise<{
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
    }>;
    private provisionUser;
    update(actor: User, id: string, dto: UpdateUserDto): Promise<{
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
    }>;
    setPassword(actor: User, id: string, dto: SetPasswordDto): Promise<{
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
    }>;
    remove(actor: User, id: string): Promise<{
        ok: boolean;
    }>;
    private resolveHomeBranch;
    private resolveFinancePartner;
    private signInUrlFor;
    private loadManagedUser;
}
export {};
