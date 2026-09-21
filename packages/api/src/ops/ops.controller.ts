import { Controller, Get, Post, Query } from '@nestjs/common';
import { ApplicationStatus, User, UserRole } from '@prisma/client';
import { IsOptional, IsString } from 'class-validator';
import { CurrentUser, Roles } from '../auth/guards';
import { opsCompanyFilter } from '../applications/company-scope';
import {
  PaginationQueryDto,
  resolvePagination,
  toPaginatedResponse,
} from '../common/pagination.dto';
import { seedFinancePartners } from '../../prisma/seed-finance-partners';
import { seedBranches } from '../../prisma/seed-branches';
import { seedCheryInventory } from '../../prisma/seed-chery';
import { seedQautoInventory } from '../../prisma/seed-qauto-inventory';
import { uploadQautoListingImages } from '../../prisma/upload-qauto-listing-images';
import { backfillListingImageUrls } from '../../prisma/backfill-listing-image-urls';
import { bootstrapQauto } from '../../prisma/bootstrap-qauto';
import { backfillInstallmentPlans } from '../applications/backfill-installment-plan';
import { resolveDescendantCompanyIds } from '../companies/company-hierarchy';
import { splitDisplayName } from '../customers/customer-profile';
import { PrismaService } from '../prisma/prisma.service';
import { vehicleIdentityComplete } from '../products/vehicle-identity';
import { countInRange, weekBuckets } from './ops-metrics.helpers';

class ActivityLogsQueryDto extends PaginationQueryDto {
  @IsOptional() @IsString() entityType?: string;
  @IsOptional() @IsString() actorEmail?: string;
  @IsOptional() @IsString() from?: string;
  @IsOptional() @IsString() to?: string;
}

/**
 * Read-model endpoints backing the admin / super-admin / finance consoles
 * (P0-5): platform metrics, the audit log, the full product list, and CRM
 * sync failures (P1-5 operator visibility).
 */
@Controller('ops')
export class OpsController {
  /**
   * Statuses by which a Zoho-partner application should already have a lead.
   * Excludes `draft` (not submitted — see zoho-sync-policy) and the terminal
   * states, where a missing lead is no longer actionable.
   */
  private static readonly EXPECTED_CRM_SYNC_STATUSES: ApplicationStatus[] = [
    ApplicationStatus.under_review,
    ApplicationStatus.resubmission_required,
    ApplicationStatus.contract_signing_required,
    ApplicationStatus.contracts_submitted,
    ApplicationStatus.contract_under_review,
    ApplicationStatus.down_payment_required,
    ApplicationStatus.down_payment_submitted,
    ApplicationStatus.pending_finance_activation,
    ApplicationStatus.lpo_issued,
    ApplicationStatus.acquisition_pending,
    ApplicationStatus.active,
    ApplicationStatus.partner_processing,
  ];

  constructor(private readonly prisma: PrismaService) {}

  @Roles(UserRole.admin, UserRole.super_admin, UserRole.group_admin)
  @Get('metrics')
  async metrics(@CurrentUser() user: User, @Query('company_id') companyId?: string) {
    let scopedIds: string[] | null = null;
    if (user.role === UserRole.group_admin) {
      if (!user.companyId) scopedIds = [];
      else scopedIds = await resolveDescendantCompanyIds(this.prisma, user.companyId);
    } else if (companyId) {
      scopedIds = await resolveDescendantCompanyIds(this.prisma, companyId);
    }
    const appWhere = scopedIds ? { companyId: { in: scopedIds } } : {};
    const productWhere = scopedIds
      ? { listingStatus: 'published' as const, companyId: { in: scopedIds } }
      : { listingStatus: 'published' as const };
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);

    const [
      users,
      customers,
      companies,
      publishedProducts,
      applicationsByStatus,
      schedulesPending,
      schedulesOverdue,
      applicationsThisMonth,
      newCustomers30d,
      recentApplications,
      recentUsers,
      recentActivity,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { role: UserRole.customer } }),
      this.prisma.company.count({
        where: { status: 'active', ...(scopedIds ? { id: { in: scopedIds } } : {}) },
      }),
      this.prisma.product.count({ where: productWhere }),
      this.prisma.application.groupBy({ by: ['status'], where: appWhere, _count: { _all: true } }),
      this.prisma.paymentSchedule.count({
        where: { status: 'pending', ...(scopedIds ? { application: { companyId: { in: scopedIds } } } : {}) },
      }),
      this.prisma.paymentSchedule.count({
        where: { status: 'overdue', ...(scopedIds ? { application: { companyId: { in: scopedIds } } } : {}) },
      }),
      this.prisma.application.count({ where: { createdAt: { gte: monthStart }, ...appWhere } }),
      this.prisma.user.count({
        where: { role: UserRole.customer, createdAt: { gte: thirtyDaysAgo } },
      }),
      this.prisma.application.findMany({
        where: { createdAt: { gte: weekBuckets(12)[0]?.start ?? monthStart }, ...appWhere },
        select: { createdAt: true, companyId: true },
      }),
      this.prisma.user.findMany({
        where: { createdAt: { gte: weekBuckets(12)[0]?.start ?? monthStart } },
        select: { createdAt: true },
      }),
      this.prisma.activityLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: { actor: { select: { email: true } } },
      }),
    ]);

    const topDealerGroups = await this.prisma.application.groupBy({
      by: ['companyId'],
      where: appWhere,
      _count: { _all: true },
      orderBy: { _count: { companyId: 'desc' } },
      take: 5,
    });
    const companyIds = topDealerGroups.map((g) => g.companyId);
    const companyNames = companyIds.length
      ? await this.prisma.company.findMany({
          where: { id: { in: companyIds } },
          select: { id: true, name: true },
        })
      : [];
    const nameById = Object.fromEntries(companyNames.map((c) => [c.id, c.name]));

    const submissionWeeks = weekBuckets(12);
    const submissions_by_week = submissionWeeks.map((w) => ({
      label: w.label,
      count: countInRange(recentApplications, w.start, w.end),
    }));

    const growthWeeks = weekBuckets(12);
    const platform_growth = growthWeeks.map((w) => ({
      label: w.label,
      users: countInRange(recentUsers, w.start, w.end),
      applications: countInRange(recentApplications, w.start, w.end),
    }));

    return {
      users_total: users,
      customers_total: customers,
      companies_active: companies,
      products_published: publishedProducts,
      applications_by_status: Object.fromEntries(
        applicationsByStatus.map((row) => [row.status, row._count._all]),
      ),
      schedules_pending: schedulesPending,
      schedules_overdue: schedulesOverdue,
      applications_this_month: applicationsThisMonth,
      new_customers_30d: newCustomers30d,
      top_dealers_by_apps: topDealerGroups.map((g) => ({
        company_id: g.companyId,
        company_name: nameById[g.companyId] ?? g.companyId,
        count: g._count._all,
      })),
      submissions_by_week,
      platform_growth,
      recent_activity: recentActivity.map((l) => ({
        id: l.id,
        action: l.action,
        entity_type: l.entityType,
        actor_email: l.actor?.email ?? null,
        created_at: l.createdAt.toISOString(),
      })),
      funnel: {
        draft: applicationsByStatus.find((r) => r.status === 'draft')?._count._all ?? 0,
        under_review: applicationsByStatus.find((r) => r.status === 'under_review')?._count._all ?? 0,
        active: applicationsByStatus.find((r) => r.status === 'active')?._count._all ?? 0,
        completed: applicationsByStatus.find((r) => r.status === 'completed')?._count._all ?? 0,
        rejected: applicationsByStatus.find((r) => r.status === 'rejected')?._count._all ?? 0,
      },
      conversion_rate:
        (applicationsByStatus.find((r) => r.status === 'completed')?._count._all ?? 0) /
        Math.max(
          1,
          applicationsByStatus.reduce((sum, row) => sum + row._count._all, 0),
        ),
    };
  }

  @Roles(UserRole.admin, UserRole.super_admin, UserRole.group_admin)
  @Get('dashboard-stats')
  dashboardStats(@CurrentUser() user: User, @Query('company_id') companyId?: string) {
    return this.metrics(user, companyId);
  }

  @Roles(UserRole.admin, UserRole.super_admin)
  @Get('analytics/revenue-forecast')
  async revenueForecast() {
    const apps = await this.prisma.application.findMany({
      where: { status: { in: ['active', 'completed'] } },
      select: { pricingSnapshot: true, paymentSchedules: { select: { amount: true, status: true } } },
      take: 500,
    });
    let projected = 0;
    let collected = 0;
    for (const app of apps) {
      const pricing = (app.pricingSnapshot as Record<string, unknown>) ?? {};
      projected += Number(pricing.financed_total ?? 0);
      for (const s of app.paymentSchedules) {
        if (s.status === 'paid') collected += Number(s.amount);
      }
    }
    return { projected_revenue: Math.round(projected), real_revenue: Math.round(collected) };
  }

  @Roles(UserRole.admin, UserRole.super_admin)
  @Get('analytics/conversion-funnel')
  async conversionFunnel() {
    const rows = await this.prisma.application.groupBy({ by: ['status'], _count: { _all: true } });
    const byStatus = Object.fromEntries(rows.map((r) => [r.status, r._count._all]));
    return {
      draft: byStatus.draft ?? 0,
      under_review: byStatus.under_review ?? 0,
      contract: (byStatus.contract_signing_required ?? 0) + (byStatus.contracts_submitted ?? 0),
      active: byStatus.active ?? 0,
      completed: byStatus.completed ?? 0,
      rejected: byStatus.rejected ?? 0,
    };
  }

  @Roles(UserRole.admin, UserRole.super_admin)
  @Get('analytics/payment-collection-rates')
  async paymentCollectionRates() {
    const [paid, pending, overdue] = await Promise.all([
      this.prisma.paymentSchedule.count({ where: { status: 'paid' } }),
      this.prisma.paymentSchedule.count({ where: { status: 'pending' } }),
      this.prisma.paymentSchedule.count({ where: { status: 'overdue' } }),
    ]);
    const total = paid + pending + overdue;
    return {
      paid,
      pending,
      overdue,
      collection_rate: total ? paid / total : 0,
    };
  }

  @Roles(UserRole.admin, UserRole.super_admin)
  @Get('analytics/customer-lifetime-value')
  async customerLifetimeValue() {
    const rows = await this.prisma.application.groupBy({
      by: ['customerUserId'],
      _count: { _all: true },
      orderBy: { _count: { customerUserId: 'desc' } },
      take: 10,
    });
    const customerIds = rows.map((r) => r.customerUserId).filter((id): id is string => id != null);
    const customers = customerIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: customerIds } },
          select: { id: true, name: true, email: true },
        })
      : [];
    const byId = Object.fromEntries(customers.map((c) => [c.id, c]));
    const apps = await this.prisma.application.findMany({
      where: { customerUserId: { in: customerIds } },
      select: { customerUserId: true, pricingSnapshot: true },
    });
    const valueByCustomer = new Map<string, number>();
    for (const app of apps) {
      if (!app.customerUserId) continue;
      const pricing = (app.pricingSnapshot as Record<string, unknown>) ?? {};
      valueByCustomer.set(
        app.customerUserId,
        (valueByCustomer.get(app.customerUserId) ?? 0) + Number(pricing.financed_total ?? pricing.list_price ?? 0),
      );
    }
    return {
      top_customers: rows
        .filter((r) => r.customerUserId != null)
        .map((r) => ({
          customer_id: r.customerUserId!,
          name: byId[r.customerUserId!]?.name ?? null,
          email: byId[r.customerUserId!]?.email ?? null,
          applications: r._count._all,
          lifetime_value: Math.round(valueByCustomer.get(r.customerUserId!) ?? 0),
        })),
    };
  }

  @Roles(UserRole.dealer_agent)
  @Get('metrics/dealer')
  async dealerMetrics(@CurrentUser() user: User) {
    if (!user.companyId) {
      return {
        inventory: { draft: 0, published: 0, reserved: 0, sold: 0 },
        applications_by_status: {},
        quotes_active: 0,
        quotes_expired: 0,
        submissions_this_month: 0,
        submissions_by_week: weekBuckets(8).map((w) => ({ label: w.label, count: 0 })),
        open_applications: 0,
      };
    }
    const companyId = user.companyId;
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const now = new Date();

    const [products, appsByStatus, quotes, monthApps, weekApps] = await Promise.all([
      this.prisma.product.findMany({
        where: { companyId },
        select: { listingStatus: true },
      }),
      this.prisma.application.groupBy({
        by: ['status'],
        where: { companyId },
        _count: { _all: true },
      }),
      this.prisma.dealerQuote.findMany({
        where: { companyId },
        select: { expiresAt: true, revokedAt: true, usedAt: true },
      }),
      this.prisma.application.count({
        where: { companyId, createdAt: { gte: monthStart } },
      }),
      this.prisma.application.findMany({
        where: { companyId, createdAt: { gte: weekBuckets(8)[0]?.start ?? monthStart } },
        select: { createdAt: true },
      }),
    ]);

    const inventory = {
      draft: products.filter((p) => p.listingStatus === 'draft').length,
      published: products.filter((p) => p.listingStatus === 'published').length,
      reserved: products.filter((p) => p.listingStatus === 'reserved').length,
      sold: products.filter((p) => p.listingStatus === 'sold').length,
    };

    const applications_by_status = Object.fromEntries(
      appsByStatus.map((r) => [r.status, r._count._all]),
    );

    const openStatuses: ApplicationStatus[] = [
      ApplicationStatus.draft,
      ApplicationStatus.under_review,
      ApplicationStatus.resubmission_required,
      ApplicationStatus.contract_signing_required,
      ApplicationStatus.contracts_submitted,
      ApplicationStatus.contract_under_review,
    ];
    const open_applications = appsByStatus
      .filter((r) => openStatuses.includes(r.status))
      .reduce((sum, r) => sum + r._count._all, 0);

    let quotes_active = 0;
    let quotes_expired = 0;
    for (const q of quotes) {
      if (q.usedAt || q.revokedAt) continue;
      if (q.expiresAt < now) quotes_expired += 1;
      else quotes_active += 1;
    }

    return {
      inventory,
      applications_by_status,
      quotes_active,
      quotes_expired,
      submissions_this_month: monthApps,
      submissions_by_week: weekBuckets(8).map((w) => ({
        label: w.label,
        count: countInRange(weekApps, w.start, w.end),
      })),
      open_applications,
    };
  }

  @Roles(UserRole.credit_officer, UserRole.admin, UserRole.super_admin)
  @Get('metrics/credit')
  async creditMetrics(@CurrentUser() user: User) {
    const companyIds = await opsCompanyFilter(this.prisma, user);
    const companyWhere = companyIds ? { companyId: { in: companyIds } } : {};
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const reviewStatuses: ApplicationStatus[] = [
      ApplicationStatus.under_review,
      ApplicationStatus.resubmission_required,
      ApplicationStatus.contracts_submitted,
      ApplicationStatus.contract_under_review,
    ];

    const [
      appsByStatus,
      resubmissions,
      approvedToday,
      rejected30d,
      zohoFailures,
      queueApps,
      weekApps,
    ] = await Promise.all([
      this.prisma.application.groupBy({
        by: ['status'],
        where: companyWhere,
        _count: { _all: true },
      }),
      this.prisma.application.count({
        where: { ...companyWhere, status: ApplicationStatus.resubmission_required },
      }),
      this.prisma.activityLog.count({
        where: {
          action: { in: ['approve', 'application_approved', 'credit_approved'] },
          createdAt: { gte: todayStart },
        },
      }),
      this.prisma.application.count({
        where: { ...companyWhere, status: ApplicationStatus.rejected, updatedAt: { gte: thirtyDaysAgo } },
      }),
      this.prisma.application.count({
        where: {
          ...companyWhere,
          OR: [{ zohoSyncError: { not: null } }, { zohoLeadId: null, status: { in: OpsController.EXPECTED_CRM_SYNC_STATUSES } }],
        },
      }),
      this.prisma.application.findMany({
        where: { ...companyWhere, status: { in: reviewStatuses } },
        orderBy: { updatedAt: 'asc' },
        take: 5,
        select: { id: true, customerEmail: true, status: true, updatedAt: true },
      }),
      this.prisma.application.findMany({
        where: { ...companyWhere, createdAt: { gte: weekBuckets(8)[0]?.start ?? thirtyDaysAgo } },
        select: { createdAt: true },
      }),
    ]);

    const in_review =
      (appsByStatus.find((r) => r.status === ApplicationStatus.under_review)?._count._all ?? 0) +
      (appsByStatus.find((r) => r.status === ApplicationStatus.contract_under_review)?._count._all ?? 0);

    return {
      in_review,
      resubmissions_pending: resubmissions,
      approved_today: approvedToday,
      rejected_30d: rejected30d,
      zoho_failures: zohoFailures,
      queue_by_status: Object.fromEntries(appsByStatus.map((r) => [r.status, r._count._all])),
      priority_queue: queueApps.map((a) => ({
        id: a.id,
        customer_email: a.customerEmail,
        status: a.status,
        updated_at: a.updatedAt.toISOString(),
      })),
      review_volume_by_week: weekBuckets(8).map((w) => ({
        label: w.label,
        count: countInRange(weekApps, w.start, w.end),
      })),
    };
  }

  @Roles(UserRole.finance_officer, UserRole.admin, UserRole.super_admin)
  @Get('metrics/finance')
  async financeMetrics(@CurrentUser() user: User) {
    const companyIds = await opsCompanyFilter(this.prisma, user);
    const appWhere = companyIds ? { companyId: { in: companyIds } } : {};
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const weekFromNow = new Date(Date.now() + 7 * 86400000);

    const appIds = companyIds
      ? (
          await this.prisma.application.findMany({
            where: appWhere,
            select: { id: true },
          })
        ).map((a) => a.id)
      : null;

    const scheduleWhere = appIds ? { applicationId: { in: appIds } } : {};

    const [
      pending,
      overdue,
      paid,
      pendingTransfers,
      activeFinancings,
      upcoming,
      paidEvents,
      overdueByWeek,
    ] = await Promise.all([
      this.prisma.paymentSchedule.count({ where: { ...scheduleWhere, status: 'pending' } }),
      this.prisma.paymentSchedule.count({ where: { ...scheduleWhere, status: 'overdue' } }),
      this.prisma.paymentSchedule.count({ where: { ...scheduleWhere, status: 'paid' } }),
      this.prisma.paymentTransaction.count({
        where: { gateway: 'bank_transfer', status: 'pending' },
      }),
      this.prisma.application.count({
        where: { ...appWhere, status: ApplicationStatus.active },
      }),
      this.prisma.paymentSchedule.findMany({
        where: {
          ...scheduleWhere,
          status: 'pending',
          dueDate: { lte: weekFromNow, gte: new Date() },
        },
        orderBy: { dueDate: 'asc' },
        take: 5,
        select: {
          id: true,
          sequence: true,
          dueDate: true,
          amount: true,
          applicationId: true,
        },
      }),
      this.prisma.paymentEvent.findMany({
        where: {
          type: { in: ['installment', 'down_payment'] },
          createdAt: { gte: weekBuckets(8)[0]?.start ?? monthStart },
        },
        select: { createdAt: true, amount: true },
      }),
      this.prisma.paymentSchedule.findMany({
        where: { ...scheduleWhere, status: 'overdue' },
        select: { dueDate: true },
      }),
    ]);

    const collected_this_month = await this.prisma.paymentEvent.aggregate({
      where: {
        type: { in: ['installment', 'down_payment'] },
        createdAt: { gte: monthStart },
      },
      _sum: { amount: true },
    });

    return {
      schedules_pending: pending,
      schedules_overdue: overdue,
      schedules_paid: paid,
      pending_bank_transfers: pendingTransfers,
      active_financings: activeFinancings,
      collected_this_month: Number(collected_this_month._sum.amount ?? 0),
      schedule_status: { pending, overdue, paid },
      collections_by_week: weekBuckets(8).map((w) => ({
        label: w.label,
        count: paidEvents.filter((e) => e.createdAt >= w.start && e.createdAt <= w.end).length,
        amount: paidEvents
          .filter((e) => e.createdAt >= w.start && e.createdAt <= w.end)
          .reduce((sum, e) => sum + Number(e.amount), 0),
      })),
      overdue_trend: weekBuckets(8).map((w) => ({
        label: w.label,
        count: overdueByWeek.filter((s) => s.dueDate >= w.start && s.dueDate <= w.end).length,
      })),
      upcoming_due: upcoming.map((s) => ({
        id: s.id,
        application_id: s.applicationId,
        sequence: s.sequence,
        due_date: s.dueDate.toISOString().slice(0, 10),
        amount: Number(s.amount),
      })),
    };
  }

  @Roles(UserRole.admin, UserRole.super_admin)
  @Get('activity-stats')
  async activityStats(@Query('range') range?: string) {
    const now = new Date();
    let start: Date | undefined;
    if (range === '7d') start = new Date(now.getTime() - 7 * 86400000);
    else if (range === '30d') start = new Date(now.getTime() - 30 * 86400000);
    else if (range === '90d') start = new Date(now.getTime() - 90 * 86400000);
    const where = start ? { createdAt: { gte: start } } : {};
    const logs = await this.prisma.activityLog.findMany({
      where,
      include: { actor: { select: { email: true } } },
    });
    const actionsByType: Record<string, number> = {};
    const actionsByResource: Record<string, number> = {};
    const userCounts = new Map<string, number>();
    for (const log of logs) {
      actionsByType[log.action] = (actionsByType[log.action] ?? 0) + 1;
      actionsByResource[log.entityType] = (actionsByResource[log.entityType] ?? 0) + 1;
      const email = log.actor?.email ?? 'system';
      userCounts.set(email, (userCounts.get(email) ?? 0) + 1);
    }
    return {
      total_actions: logs.length,
      actions_by_type: actionsByType,
      actions_by_resource: actionsByResource,
      actions_by_user: [...userCounts.entries()]
        .map(([userEmail, count]) => ({ user_email: userEmail, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 20),
    };
  }

  @Roles(UserRole.admin, UserRole.super_admin)
  @Get('activity-logs')
  async activityLogs(@Query() query: ActivityLogsQueryDto) {
    const { limit, offset } = resolvePagination(query, { defaultLimit: 50, maxLimit: 200 });
    const fromDate = query.from ? new Date(query.from) : undefined;
    const toDate = query.to ? new Date(query.to) : undefined;
    const hasFrom = fromDate && !Number.isNaN(fromDate.getTime());
    const hasTo = toDate && !Number.isNaN(toDate.getTime());
    const where = {
      ...(query.entityType ? { entityType: query.entityType } : {}),
      ...(query.actorEmail
        ? { actor: { email: { contains: query.actorEmail, mode: 'insensitive' as const } } }
        : {}),
      ...(hasFrom || hasTo
        ? {
            createdAt: {
              ...(hasFrom ? { gte: fromDate } : {}),
              ...(hasTo ? { lte: toDate } : {}),
            },
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.activityLog.findMany({
        where,
        include: { actor: { select: { email: true, name: true, role: true } } },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.activityLog.count({ where }),
    ]);
    return toPaginatedResponse(
      items.map((l) => ({
        id: l.id,
        actor_email: l.actor?.email ?? null,
        actor_role: l.actor?.role ?? null,
        entity_type: l.entityType,
        entity_id: l.entityId,
        action: l.action,
        from_value: l.fromValue,
        to_value: l.toValue,
        metadata: l.metadata,
        created_at: l.createdAt.toISOString(),
      })),
      total,
      limit,
      offset,
    );
  }

  @Roles(UserRole.admin, UserRole.super_admin)
  @Get('products')
  async products(@Query() query: PaginationQueryDto) {
    const { limit, offset } = resolvePagination(query, { defaultLimit: 50, maxLimit: 200 });
    const [items, total] = await Promise.all([
      this.prisma.product.findMany({
        include: {
          company: { select: { name: true, code: true } },
          images: { orderBy: { sortOrder: 'asc' }, take: 1 },
        },
        orderBy: { updatedAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.product.count(),
    ]);
    return toPaginatedResponse(
      items.map((p) => ({
        id: p.id,
        slug: p.slug,
        make: p.make,
        model: p.model,
        model_year: p.modelYear,
        price: Number(p.price),
        listing_status: p.listingStatus,
        vin: p.vin,
        chassis_number: p.chassisNumber,
        engine_number: p.engineNumber,
        identity_complete: vehicleIdentityComplete(p),
        company_id: p.companyId,
        company_name: p.company.name,
        company_code: p.company.code,
        primary_image: p.images[0]?.storagePath ?? null,
        updated_at: p.updatedAt.toISOString(),
      })),
      total,
      limit,
      offset,
    );
  }

  /**
   * CRM sync health. Two distinct problems, both of which mean the finance
   * partner is not seeing a lead:
   *  - `sync_error`  — a sync ran and failed (recorded on the application).
   *  - `never_synced` — a submitted application on a Zoho partner has no lead id
   *    at all (Z6). This is what a missing/disabled Zoho config looks like, and
   *    it produces no error row, so it would otherwise be invisible.
   */
  @Roles(UserRole.admin, UserRole.super_admin, UserRole.credit_officer)
  @Get('zoho/failures')
  async zohoFailures(@CurrentUser() user: User, @Query() query: PaginationQueryDto) {
    const { limit, offset } = resolvePagination(query, { defaultLimit: 50, maxLimit: 200 });
    const companyIds = await opsCompanyFilter(this.prisma, user);
    const companyWhere = companyIds ? { companyId: { in: companyIds } } : {};

    const selection = {
      id: true,
      status: true,
      customerEmail: true,
      zohoLeadId: true,
      zohoSyncError: true,
      zohoSyncedAt: true,
      updatedAt: true,
      financePartner: { select: { name: true, code: true } },
    } as const;

    const [failed, neverSynced] = await Promise.all([
      this.prisma.application.findMany({
        where: { zohoSyncError: { not: null }, ...companyWhere },
        select: selection,
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.application.findMany({
        where: {
          zohoLeadId: null,
          status: { in: OpsController.EXPECTED_CRM_SYNC_STATUSES },
          financePartner: { crmAdapter: 'zoho' },
          ...companyWhere,
        },
        select: selection,
        orderBy: { updatedAt: 'desc' },
      }),
    ]);

    const seen = new Set(failed.map((a) => a.id));
    const rows = [
      ...failed.map((a) => ({ row: a, reason: 'sync_error' as const })),
      ...neverSynced
        .filter((a) => !seen.has(a.id))
        .map((a) => ({ row: a, reason: 'never_synced' as const })),
    ].sort((a, b) => b.row.updatedAt.getTime() - a.row.updatedAt.getTime());

    const total = rows.length;
    const page = rows.slice(offset, offset + limit);
    return toPaginatedResponse(
      page.map(({ row, reason }) => ({
        application_id: row.id,
        reason,
        status: row.status,
        customer_email: row.customerEmail,
        partner: row.financePartner?.name ?? null,
        zoho_lead_id: row.zohoLeadId,
        error: row.zohoSyncError,
        last_synced_at: row.zohoSyncedAt?.toISOString() ?? null,
        updated_at: row.updatedAt.toISOString(),
      })),
      total,
      limit,
      offset,
    );
  }

  @Roles(
    UserRole.dealer_agent,
    UserRole.admin,
    UserRole.super_admin,
    UserRole.credit_officer,
    UserRole.finance_officer,
  )
  @Get('customers/search')
  async searchCustomers(@Query('q') q?: string, @Query('limit') limitRaw?: string) {
    const limit = Math.min(Math.max(Number(limitRaw) || 30, 1), 100);
    const term = q?.trim();
    const users = await this.prisma.user.findMany({
      where: {
        role: UserRole.customer,
        ...(term
          ? {
              OR: [
                { email: { contains: term, mode: 'insensitive' } },
                { name: { contains: term, mode: 'insensitive' } },
                { phone: { contains: term, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      select: { id: true, email: true, name: true, firstName: true, lastName: true, phone: true, qid: true },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    const items = await Promise.all(
      users.map(async (user) => {
        const latest = await this.prisma.application.findFirst({
          where: { customerUserId: user.id },
          orderBy: { createdAt: 'desc' },
          select: { customerSnapshot: true },
        });
        const derived = splitDisplayName(user.name);
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          first_name: user.firstName ?? (derived.firstName || null),
          last_name: user.lastName ?? (derived.lastName || null),
          phone: user.phone,
          qid: user.qid,
          latest_snapshot: latest?.customerSnapshot ?? null,
        };
      }),
    );

    return { items, total: items.length, limit, offset: 0 };
  }

  @Roles(UserRole.super_admin)
  @Post('seed-finance-partners')
  seedFinancePartners() {
    return seedFinancePartners(this.prisma);
  }

  /** One MAIN branch per seeded dealership + home branches for their dealer agents. */
  @Roles(UserRole.super_admin)
  @Post('seed-branches')
  seedBranches() {
    return seedBranches(this.prisma);
  }

  @Roles(UserRole.super_admin)
  @Post('seed-chery')
  async seedChery() {
    await seedFinancePartners(this.prisma);
    return seedCheryInventory(this.prisma);
  }

  @Roles(UserRole.super_admin)
  @Post('seed-qauto-inventory')
  async seedQautoInventory() {
    await seedFinancePartners(this.prisma);
    return seedQautoInventory(this.prisma);
  }

  @Roles(UserRole.super_admin)
  @Post('upload-qauto-listing-images')
  async uploadQautoListingImages() {
    return uploadQautoListingImages(this.prisma);
  }

  @Roles(UserRole.super_admin)
  @Post('backfill-listing-image-urls')
  backfillListingImageUrls() {
    return backfillListingImageUrls(this.prisma);
  }

  @Roles(UserRole.super_admin)
  @Post('backfill-installment-plan')
  backfillInstallmentPlan() {
    return backfillInstallmentPlans(this.prisma);
  }

  @Roles(UserRole.super_admin)
  @Post('bootstrap-qauto')
  bootstrapQauto() {
    return bootstrapQauto(this.prisma);
  }
}
