import { User, UserRole } from '@prisma/client';
export declare const SUPER_ADMIN_ONLY_ROLES: UserRole[];
export declare const GROUP_MANAGEABLE_ROLES: UserRole[];
export declare const PRIVILEGED_STAFF_ROLES: UserRole[];
export declare function isSuperAdminOnlyRole(role: UserRole): boolean;
export declare function assertCanProvisionRole(actor: User, targetRole: UserRole): void;
export declare function assertCanManageUserRole(actor: User, targetRole: UserRole, nextRole?: UserRole): void;
export declare function assertPartnerViewerAssignment(role: UserRole, financePartner: {
    id: string;
} | null, requested: string | null | undefined): string | null;
export declare function assertHomeBranchInCompany(branch: {
    id: string;
    companyId: string;
} | null, companyId: string | null | undefined): void;
