import type { Branch } from '@prisma/client';
export declare const BRANCH_INCLUDE: {
    _count: {
        select: {
            staff: {
                where: {
                    isActive: true;
                };
            };
        };
    };
};
export type BranchRow = Branch & {
    _count?: {
        staff?: number;
    };
};
export declare function toBranchDto(branch: BranchRow): {
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
};
export declare function toBranchRefDto(branch: Pick<Branch, 'id' | 'code' | 'name'> | null | undefined): {
    id: string;
    code: string;
    name: string;
} | null;
