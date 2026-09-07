import { User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { type OriginationFunnelDto, type OriginationFunnelGroupBy } from './origination-funnel';
declare class OriginationFunnelQueryDto {
    group_by?: OriginationFunnelGroupBy;
    from?: string;
    to?: string;
    company_id?: string;
}
export declare class OriginationAnalyticsController {
    private readonly prisma;
    constructor(prisma: PrismaService);
    originationFunnel(user: User, query: OriginationFunnelQueryDto): Promise<OriginationFunnelDto>;
    private resolveScope;
}
export {};
