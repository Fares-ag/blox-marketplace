import { User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
export declare function opsCompanyFilter(prisma: PrismaService, user: User): Promise<string[] | null>;
export declare function assertCompanyScope(prisma: PrismaService, user: User, companyId: string): Promise<void>;
export declare function assertCompanyScopeForRead(prisma: PrismaService, user: User, companyId: string): Promise<void>;
