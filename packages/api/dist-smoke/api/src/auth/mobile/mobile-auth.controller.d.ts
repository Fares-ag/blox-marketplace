import type { User } from '@prisma/client';
import { MobileAuthService } from './mobile-auth.service';
declare class MobileSignInDto {
    email: string;
    password: string;
}
declare class MobileSignUpDto {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phone?: string;
    qid?: string;
}
declare class MobileRefreshDto {
    refresh_token: string;
}
declare class MobileSignOutDto {
    refresh_token?: string;
}
declare class PasswordResetRequestDto {
    email: string;
}
declare class PasswordResetConfirmDto {
    token: string;
    password: string;
}
declare class ChangePasswordDto {
    currentPassword: string;
    newPassword: string;
}
export declare class MobileAuthController {
    private readonly auth;
    constructor(auth: MobileAuthService);
    signIn(dto: MobileSignInDto): Promise<{
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
    signUp(dto: MobileSignUpDto): Promise<{
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
    refresh(dto: MobileRefreshDto): Promise<{
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
    signOut(user: User, dto: MobileSignOutDto): Promise<{
        ok: boolean;
    }>;
    requestReset(dto: PasswordResetRequestDto): Promise<{
        ok: boolean;
    }>;
    confirmReset(dto: PasswordResetConfirmDto): Promise<{
        ok: boolean;
    }>;
    changePassword(user: User, dto: ChangePasswordDto): Promise<{
        ok: boolean;
    }>;
}
export {};
