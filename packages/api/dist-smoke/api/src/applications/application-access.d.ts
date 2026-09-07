import { ApplicationStatus, User } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
export declare const BLOCKING_APPLICATION_STATUSES: ApplicationStatus[];
export declare function assertApplicationCanView(prisma: PrismaService, user: User, app: {
    customerUserId: string;
    companyId: string;
}): Promise<void>;
