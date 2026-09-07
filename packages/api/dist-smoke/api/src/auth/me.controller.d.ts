import { ConfigService } from '@nestjs/config';
import type { User } from '@prisma/client';
import { IdentityService } from '../common/identity.service';
import { PrismaService } from '../prisma/prisma.service';
declare class UpdateProfileDto {
    name?: string;
    phone?: string;
    qid?: string;
}
export declare class MeController {
    private readonly prisma;
    private readonly config;
    private readonly identity;
    constructor(prisma: PrismaService, config: ConfigService, identity: IdentityService);
    me(user: User): Promise<{
        id: string;
        email: string;
        name: string;
        role: import(".prisma/client").$Enums.UserRole;
        company_id: string | null;
        credit_scope: import(".prisma/client").$Enums.OfficerScope;
        finance_scope: import(".prisma/client").$Enums.OfficerScope;
        phone: string | null;
        qid: string | null;
        email_verified: boolean;
        is_active: boolean;
        two_factor_enabled: boolean;
        mfa_required: boolean;
        mfa_setup_required: boolean;
        session_policy: {
            idle_timeout_sec: number;
            absolute_timeout_sec: number;
            warning_sec: number;
            single_session: boolean;
        };
        finance_partner_id: string | null;
        finance_partner_name: string | null;
    }>;
    update(user: User, dto: UpdateProfileDto): Promise<{
        id: string;
        email: string;
        name: string;
        role: import(".prisma/client").$Enums.UserRole;
        company_id: string | null;
        credit_scope: import(".prisma/client").$Enums.OfficerScope;
        finance_scope: import(".prisma/client").$Enums.OfficerScope;
        phone: string | null;
        qid: string | null;
        email_verified: boolean;
        is_active: boolean;
        two_factor_enabled: boolean;
        mfa_required: boolean;
        mfa_setup_required: boolean;
        session_policy: {
            idle_timeout_sec: number;
            absolute_timeout_sec: number;
            warning_sec: number;
            single_session: boolean;
        };
        finance_partner_id: string | null;
        finance_partner_name: string | null;
    }>;
    revokeAllSessions(user: User): Promise<{
        status: boolean;
    }>;
    private toPublic;
}
export {};
