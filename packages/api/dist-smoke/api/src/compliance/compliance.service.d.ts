import { Prisma, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityService } from '../common/activity.service';
import { ComplianceProvider } from './compliance-provider.interface';
export declare class ComplianceService {
    private readonly prisma;
    private readonly activity;
    private readonly provider;
    constructor(prisma: PrismaService, activity: ActivityService, provider: ComplianceProvider);
    private assertOps;
    findLatestPassingCheck(applicationId: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        provider: string;
        applicantName: string;
        applicationId: string;
        identityStatus: import(".prisma/client").$Enums.ComplianceCheckStatus;
        sanctionsStatus: import(".prisma/client").$Enums.ComplianceCheckStatus;
        overallStatus: import(".prisma/client").$Enums.ComplianceCheckStatus;
        identityResult: Prisma.JsonValue | null;
        sanctionsResult: Prisma.JsonValue | null;
        verifiedByUserId: string | null;
        qidScreened: string;
    } | null>;
    assertPassedForApproval(applicationId: string): Promise<void>;
    runCheck(user: User, applicationId: string): Promise<{
        id: string;
        application_id: string;
        provider: string;
        identity_status: import(".prisma/client").$Enums.ComplianceCheckStatus;
        sanctions_status: import(".prisma/client").$Enums.ComplianceCheckStatus;
        overall_status: import(".prisma/client").$Enums.ComplianceCheckStatus;
        verified_by_user_id: string | null;
        qid_screened: string;
        applicant_name: string;
        created_at: Date;
    }>;
}
