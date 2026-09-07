import { CompanyKind } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
type CompanyClient = Pick<PrismaService, 'company'>;
export declare function resolveDescendantCompanyIds(prisma: CompanyClient, companyId: string): Promise<string[]>;
export declare function expandCompanyIds(prisma: CompanyClient, ids: string[]): Promise<string[]>;
export declare function assertValidCompanyHierarchy(prisma: CompanyClient, opts: {
    kind?: CompanyKind | string;
    parentCompanyId?: string | null;
}): Promise<void>;
export declare function assertDealershipCompany(prisma: CompanyClient, companyId: string): Promise<{
    id: string;
    kind: import(".prisma/client").$Enums.CompanyKind;
}>;
export {};
