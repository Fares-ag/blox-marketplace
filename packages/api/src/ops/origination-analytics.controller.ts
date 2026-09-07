import { Controller, ForbiddenException, Get, Query } from '@nestjs/common';
import { ApplicationStatus, User, UserRole } from '@prisma/client';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { CurrentUser, Roles } from '../auth/guards';
import { resolveDescendantCompanyIds } from '../companies/company-hierarchy';
import { PrismaService } from '../prisma/prisma.service';
import {
  aggregateOriginationFunnel,
  APPROVAL_TARGET_STATUSES,
  FUNNEL_APPLICATION_CAP,
  ORIGINATION_FUNNEL_GROUPS,
  resolveFunnelRange,
  type FunnelLabels,
  type OriginationFunnelDto,
  type OriginationFunnelGroupBy,
} from './origination-funnel';

class OriginationFunnelQueryDto {
  @IsOptional() @IsIn(ORIGINATION_FUNNEL_GROUPS) group_by?: OriginationFunnelGroupBy;
  @IsOptional() @IsString() from?: string;
  @IsOptional() @IsString() to?: string;
  @IsOptional() @IsString() company_id?: string;
}

function unique(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((v): v is string => !!v))];
}

/**
 * `GET /api/ops/analytics/origination-funnel` — dealer / branch / sales
 * executive performance. Admins see everything (optionally narrowed by
 * `company_id`, holdings expand to their dealerships), group admins their
 * tree, dealer agents only their own company.
 */
@Controller('ops/analytics')
export class OriginationAnalyticsController {
  constructor(private readonly prisma: PrismaService) {}

  @Roles(UserRole.admin, UserRole.super_admin, UserRole.group_admin, UserRole.dealer_agent)
  @Get('origination-funnel')
  async originationFunnel(
    @CurrentUser() user: User,
    @Query() query: OriginationFunnelQueryDto,
  ): Promise<OriginationFunnelDto> {
    const groupBy: OriginationFunnelGroupBy = query.group_by ?? 'company';
    const { from, to } = resolveFunnelRange(query.from, query.to);
    const scopeIds = await this.resolveScope(user, query.company_id);

    // `updatedAt >= from` bounds the scan: every stage timestamp (submitted,
    // approved, activated, rejected) is followed by an update, so anything
    // that moved inside the window is caught; `createdAt <= to` drops the future.
    const applications = await this.prisma.application.findMany({
      where: {
        ...(scopeIds ? { companyId: { in: scopeIds } } : {}),
        createdAt: { lte: to },
        updatedAt: { gte: from },
      },
      select: {
        id: true,
        companyId: true,
        branchId: true,
        agentUserId: true,
        status: true,
        createdAt: true,
        submittedAt: true,
        activatedAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: FUNNEL_APPLICATION_CAP,
    });

    const appIds = applications.map((a) => a.id);
    const logs = appIds.length
      ? await this.prisma.activityLog.findMany({
          where: {
            entityType: 'application',
            action: 'status_transition',
            entityId: { in: appIds },
            toValue: { in: [...APPROVAL_TARGET_STATUSES, ApplicationStatus.rejected] },
          },
          select: { entityId: true, fromValue: true, toValue: true, createdAt: true },
          orderBy: { createdAt: 'asc' },
        })
      : [];

    const companyIds = unique(applications.map((a) => a.companyId));
    const agentIds = unique(applications.map((a) => a.agentUserId));
    const [companies, agents] = await Promise.all([
      companyIds.length
        ? this.prisma.company.findMany({
            where: { id: { in: companyIds } },
            select: { id: true, name: true },
          })
        : [],
      agentIds.length
        ? this.prisma.user.findMany({
            where: { id: { in: agentIds } },
            select: { id: true, name: true, homeBranchId: true },
          })
        : [],
    ]);
    const branchIds = unique([
      ...applications.map((a) => a.branchId),
      ...agents.map((a) => a.homeBranchId),
    ]);
    const branches = branchIds.length
      ? await this.prisma.branch.findMany({
          where: { id: { in: branchIds } },
          select: { id: true, name: true, companyId: true },
        })
      : [];

    const labels: FunnelLabels = {
      companies: new Map(companies.map((c) => [c.id, { name: c.name }])),
      branches: new Map(branches.map((b) => [b.id, { name: b.name, companyId: b.companyId }])),
      agents: new Map(agents.map((a) => [a.id, { name: a.name, homeBranchId: a.homeBranchId }])),
    };

    return aggregateOriginationFunnel({
      applications,
      transitions: logs.map((l) => ({
        applicationId: l.entityId,
        fromValue: l.fromValue,
        toValue: l.toValue,
        createdAt: l.createdAt,
      })),
      groupBy,
      from,
      to,
      labels,
    });
  }

  /** Dealers are pinned to their company; group admins to their tree; admins may narrow by company_id. */
  private async resolveScope(user: User, companyId?: string): Promise<string[] | null> {
    if (user.role === UserRole.dealer_agent) {
      return user.companyId ? [user.companyId] : [];
    }
    if (user.role === UserRole.group_admin) {
      const tree = user.companyId ? await resolveDescendantCompanyIds(this.prisma, user.companyId) : [];
      if (!companyId) return tree;
      if (!tree.includes(companyId)) throw new ForbiddenException('out_of_scope');
      return resolveDescendantCompanyIds(this.prisma, companyId);
    }
    return companyId ? resolveDescendantCompanyIds(this.prisma, companyId) : null;
  }
}
