import { UserRole } from '@prisma/client';
export declare const MFA_REQUIRED_ROLES: UserRole[];
export declare function isMfaRequiredRole(role: UserRole): boolean;
