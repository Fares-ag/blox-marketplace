import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { IdentityService } from '../../common/identity.service';
import type { DmAuth } from '../auth';
export declare class MobileAuthService {
    private readonly prisma;
    private readonly config;
    private readonly identity;
    private readonly auth;
    constructor(prisma: PrismaService, config: ConfigService, identity: IdentityService, auth: DmAuth);
    private secret;
    signIn(email: string, password: string): Promise<{
        access_token: string;
        refresh_token: string;
        expires_at: string;
        user: {
            user_id: string;
            role: string;
            email: string;
            phone: string;
            first_name: string;
            last_name: string;
        };
    }>;
    signUp(input: {
        email: string;
        password: string;
        firstName: string;
        lastName: string;
        phone?: string;
        qid?: string;
    }): Promise<{
        access_token: string;
        refresh_token: string;
        expires_at: string;
        user: {
            user_id: string;
            role: string;
            email: string;
            phone: string;
            first_name: string;
            last_name: string;
        };
    }>;
    refresh(rawToken: string): Promise<{
        access_token: string;
        refresh_token: string;
        expires_at: string;
        user: {
            user_id: string;
            role: string;
            email: string;
            phone: string;
            first_name: string;
            last_name: string;
        };
    }>;
    signOut(rawToken: string | undefined, userId: string): Promise<{
        ok: boolean;
    }>;
    requestPasswordReset(email: string): Promise<{
        ok: boolean;
    }>;
    confirmPasswordReset(token: string, newPassword: string): Promise<{
        ok: boolean;
    }>;
    changePassword(userId: string, currentPassword: string, newPassword: string): Promise<{
        ok: boolean;
    }>;
    issueSession(user: {
        id: string;
        email: string;
        role: string;
        name: string;
        phone: string | null;
    }): Promise<{
        access_token: string;
        refresh_token: string;
        expires_at: string;
        user: {
            user_id: string;
            role: string;
            email: string;
            phone: string;
            first_name: string;
            last_name: string;
        };
    }>;
}
