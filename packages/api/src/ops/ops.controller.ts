import { Controller, Get, Post, Query } from '@nestjs/common';
import { ApplicationStatus, User, UserRole } from '@prisma/client';
import { CurrentUser, Roles } from '../auth/guards';
import { opsCompanyFilter } from '../applications/company-scope';
import { seedFinancePartners } from '../../prisma/seed-finance-partners';
import { PrismaService } from '../prisma/prisma.service';

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
    ApplicationStatus.active,
  ];

  constructor(private readonly prisma: PrismaService) {}

  @Roles(UserRole.admin, UserRole.super_admin)
  @Get('metrics')
  async metrics() {
    const [
      users,
      customers,
      companies,
      publishedProducts,
      applicationsByStatus,
      schedulesPending,
      schedulesOverdue,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { role: UserRole.customer } }),
      this.prisma.company.count({ where: { status: 'active' } }),
      this.prisma.product.count({ where: { listingStatus: 'published' } }),
      this.prisma.application.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.paymentSchedule.count({ where: { status: 'pending' } }),
      this.prisma.paymentSchedule.count({ where: { status: 'overdue' } }),
    ]);
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
    };
  }

  @Roles(UserRole.admin, UserRole.super_admin)
  @Get('activity-logs')
  async activityLogs(
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
    @Query('entityType') entityType?: string,
  ) {
    const take = Math.min(Math.max(Number(limit ?? 50), 1), 200);
    const skip = Math.max(Number(offset ?? 0), 0);
    const where = entityType ? { entityType } : {};
    const [items, total] = await Promise.all([
      this.prisma.activityLog.findMany({
        where,
        include: { actor: { select: { email: true, name: true, role: true } } },
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      }),
      this.prisma.activityLog.count({ where }),
    ]);
    return {
      total,
      items: items.map((l) => ({
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
    };
  }

  @Roles(UserRole.admin, UserRole.super_admin)
  @Get('products')
  async products(@Query('limit') limit?: number, @Query('offset') offset?: number) {
    const take = Math.min(Math.max(Number(limit ?? 50), 1), 200);
    const skip = Math.max(Number(offset ?? 0), 0);
    const [items, total] = await Promise.all([
      this.prisma.product.findMany({
        include: { company: { select: { name: true, code: true } } },
        orderBy: { updatedAt: 'desc' },
        take,
        skip,
      }),
      this.prisma.product.count(),
    ]);
    return {
      total,
      items: items.map((p) => ({
        id: p.id,
        slug: p.slug,
        make: p.make,
        model: p.model,
        model_year: p.modelYear,
        price: Number(p.price),
        listing_status: p.listingStatus,
        company_name: p.company.name,
        company_code: p.company.code,
        updated_at: p.updatedAt.toISOString(),
      })),
    };
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
  async zohoFailures(@CurrentUser() user: User) {
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
        take: 100,
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
        take: 100,
      }),
    ]);

    const seen = new Set(failed.map((a) => a.id));
    const rows = [
      ...failed.map((a) => ({ row: a, reason: 'sync_error' as const })),
      ...neverSynced
        .filter((a) => !seen.has(a.id))
        .map((a) => ({ row: a, reason: 'never_synced' as const })),
    ];

    return rows.map(({ row, reason }) => ({
      application_id: row.id,
      reason,
      status: row.status,
      customer_email: row.customerEmail,
      partner: row.financePartner?.name ?? null,
      zoho_lead_id: row.zohoLeadId,
      error: row.zohoSyncError,
      last_synced_at: row.zohoSyncedAt?.toISOString() ?? null,
      updated_at: row.updatedAt.toISOString(),
    }));
  }

  @Roles(UserRole.super_admin)
  @Post('seed-finance-partners')
  seedFinancePartners() {
    return seedFinancePartners(this.prisma);
  }
}
