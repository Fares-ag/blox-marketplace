import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import path from 'node:path';
import {
  ApplicationStatus,
  DocumentCategory,
  ListingStatus,
  Prisma,
  User,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityService } from '../common/activity.service';
import { PaginationQueryDto, resolvePagination, toPaginatedResponse } from '../common/pagination.dto';
import { CREDIT_QUEUE_STATUSES } from './application-transitions';
import { submittedStatusForPartner } from './partner-finance';
import { AnalyticsService } from '../analytics/analytics.service';
import { StorageService } from '../storage/storage.service';
import { ZohoCrmService } from '../integrations/zoho/zoho-crm.service';
import { shouldSyncStatusToCrm } from '../integrations/zoho/zoho-sync-policy';
import {
  buildApplicationPricingSnapshot,
  assertOfferMatchesProduct,
} from './application-pricing';
import { hasAllRequiredDocuments, type ApplicationDocCategory } from './application-documents';
import {
  assertApplicationCanView,
  BLOCKING_APPLICATION_STATUSES,
} from './application-access';
import { ApplicationsLifecycleService } from './applications-lifecycle.service';
import {
  opsCompanyFilter,
} from './company-scope';
import { assertRowsUpdated, transitionApplication } from './guarded-transitions';
import {
  convertInstallmentPlanDailyToMonthly,
  syncPaymentSchedulesFromInstallmentPlan,
} from './installment-plan-sync';
import {
  buildPlanFromPricingSnapshot,
  type InstallmentPlan,
} from '@drivemarket/shared/installment-plan';
import {
  mapApplicationDto,
  toApplicationBlockingDto,
  toApplicationDocumentDto,
  toApplicationDto,
  toApplicationListItemDto,
  toDealerApplicationListItemDto,
  toOpsApplicationQueueItemDto,
  type ApplicationAudience,
} from './application-response.dto';

function asJson(value: Record<string, unknown>): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

@Injectable()
export class ApplicationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityService,
    private readonly analytics: AnalyticsService,
    private readonly storage: StorageService,
    private readonly lifecycle: ApplicationsLifecycleService,
    private readonly zoho: ZohoCrmService,
  ) {}

  async hasBlocking(userId: string, productId?: string) {
    const found = await this.prisma.application.findFirst({
      where: {
        customerUserId: userId,
        ...(productId ? { productId } : {}),
        status: { in: BLOCKING_APPLICATION_STATUSES },
      },
      select: { id: true },
    });
    return toApplicationBlockingDto({ blocking: !!found, applicationId: found?.id ?? null });
  }

  async create(
    user: User,
    dto: {
      productId: string;
      offerId: string;
      // Widened to the shape the dealer journey already produces, so the
      // partner CRM receives the same lead whichever way the application
      // arrived. The snapshot is stored verbatim and read by zoho-lead.mapper.
      customerSnapshot: {
        full_name: string;
        phone: string;
        qid: string;
        employment?:
          | string
          | {
              company?: string;
              position?: string;
              employmentType?: string;
              employmentDuration?: string;
              salary?: number;
            };
        income?: number;
        monthlyIncome?: number;
        nationality?: string;
        dateOfBirth?: string;
        applicantType?: string;
        firstName?: string;
        lastName?: string;
        city?: string;
        street?: string;
        country?: string;
        postalCode?: string;
        address?: { street?: string; city?: string; country?: string; postalCode?: string };
      };
      pricingSnapshot: Record<string, unknown>;
      quoteToken?: string;
    },
  ) {
    if (user.role !== UserRole.customer) throw new ForbiddenException('forbidden_role');

    const blocking = await this.hasBlocking(user.id, dto.productId);
    if (blocking.blocking) throw new BadRequestException('blocking_application_exists');

    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
      include: { defaultOffer: true },
    });
    if (
      !product ||
      product.listingStatus !== ListingStatus.published ||
      !product.financeEligible
    ) {
      throw new BadRequestException('listing_not_available');
    }

    const resolvedOfferId = product.defaultOfferId ?? dto.offerId;
    assertOfferMatchesProduct(dto.offerId, resolvedOfferId);

    const offer = await this.prisma.offer.findFirst({
      where: { id: resolvedOfferId, status: 'active' },
    });
    if (!offer) throw new BadRequestException('validation_failed');

    const snap = dto.customerSnapshot;
    if (!snap.full_name || !snap.phone || !snap.qid) {
      throw new BadRequestException('validation_failed');
    }

    let listPrice = Number(product.price);
    let leadSource: string | undefined;
    if (dto.quoteToken) {
      const quote = await this.prisma.dealerQuote.findUnique({
        where: { token: dto.quoteToken },
      });
      if (
        !quote ||
        quote.productId !== product.id ||
        quote.usedAt ||
        quote.revokedAt ||
        quote.expiresAt.getTime() <= Date.now() ||
        quote.customerEmail.toLowerCase() !== user.email.toLowerCase()
      ) {
        throw new BadRequestException('validation_failed');
      }
      listPrice = Number(quote.negotiatedPrice);
      leadSource = 'dealer_quote';
    }

    const pricingSnapshot = buildApplicationPricingSnapshot({
      listPrice,
      offer,
      pricingSnapshot: dto.pricingSnapshot,
    });

    const app = await this.prisma.$transaction(async (tx) => {
      const created = await tx.application.create({
        data: {
          customerUserId: user.id,
          customerEmail: user.email,
          customerSnapshot: asJson(snap),
          productId: product.id,
          companyId: product.companyId,
          offerId: offer.id,
          financePartnerId: offer.financePartnerId,
          leadSource,
          pricingSnapshot: asJson(pricingSnapshot),
          status: ApplicationStatus.draft,
        },
      });

      if (dto.quoteToken) {
        const now = new Date();
        const redeemed = await tx.dealerQuote.updateMany({
          where: {
            token: dto.quoteToken,
            usedAt: null,
            revokedAt: null,
            expiresAt: { gt: now },
          },
          data: { usedAt: now, usedByApplicationId: created.id },
        });
        assertRowsUpdated(redeemed.count, 'stale_transition');
      }

      await tx.user.update({
        where: { id: user.id },
        data: {
          name: user.name || String(snap.full_name),
          phone: user.phone || String(snap.phone),
          qid: user.qid || String(snap.qid),
        },
      });

      return created;
    });

    await this.activity.log({
      actorUserId: user.id,
      entityType: 'application',
      entityId: app.id,
      action: 'application_created',
      toValue: 'draft',
    });

    this.analytics.track('application_started', {
      application_id: app.id,
      product_id: app.productId,
      company_id: app.companyId,
    });

    return toApplicationDto(app);
  }

  async submit(user: User, id: string) {
    const app = await this.prisma.application.findUnique({
      where: { id },
      include: { documents: true, product: true, financePartner: true },
    });
    if (!app || app.customerUserId !== user.id) throw new ForbiddenException('forbidden_role');
    if (app.status !== 'draft' && app.status !== 'resubmission_required') {
      throw new BadRequestException('invalid_status_transition');
    }
    if (!hasAllRequiredDocuments(app.documents)) {
      throw new BadRequestException('documents_incomplete');
    }

    if (app.product.listingStatus !== ListingStatus.published && app.status === 'draft') {
      throw new BadRequestException('listing_not_available');
    }

    const fromStatus = app.status;
    const nextStatus = submittedStatusForPartner(app.financePartner?.crmAdapter);
    const updated = await this.prisma.$transaction(async (tx) => {
      await transitionApplication(tx, id, fromStatus, {
        status: nextStatus,
        submittedAt: app.submittedAt ?? new Date(),
      });

      if (fromStatus === ApplicationStatus.draft) {
        const reserved = await tx.product.updateMany({
          where: { id: app.productId, listingStatus: ListingStatus.published },
          data: { listingStatus: ListingStatus.reserved },
        });
        assertRowsUpdated(reserved.count, 'vehicle_unavailable');
      }

      return tx.application.findUniqueOrThrow({ where: { id } });
    });

    await this.activity.log({
      actorUserId: user.id,
      entityType: 'application',
      entityId: id,
      action: 'status_transition',
      fromValue: app.status,
      toValue: nextStatus,
    });

    if (nextStatus === ApplicationStatus.under_review) {
      await this.notifyOpsOnSubmit(app.companyId, id);
    }
    await this.syncToCrmIfNeeded(id, nextStatus, user.id);

    this.analytics.track('application_submitted', {
      application_id: id,
      product_id: app.productId,
      company_id: app.companyId,
      is_resubmit: fromStatus === ApplicationStatus.resubmission_required,
    });

    return toApplicationDto(updated);
  }

  async listMine(user: User, query: PaginationQueryDto = {}) {
    const { limit, offset } = resolvePagination(query, { defaultLimit: 50, maxLimit: 100 });
    const where = { customerUserId: user.id };
    const [items, total] = await Promise.all([
      this.prisma.application.findMany({
        where,
        include: {
          product: { select: { make: true, model: true, modelYear: true, slug: true, price: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.application.count({ where }),
    ]);
    return toPaginatedResponse(items.map((item) => toApplicationListItemDto(item)), total, limit, offset);
  }

  async getOne(user: User, id: string) {
    const app = await this.prisma.application.findUnique({
      where: { id },
      include: {
        product: true,
        documents: true,
        company: { select: { id: true, name: true, allowDirectActivate: true } },
        customer: { select: { name: true, email: true, phone: true } },
        offer: true,
        financePartner: { select: { name: true, code: true, crmAdapter: true } },
        agent: { select: { id: true, name: true, email: true } },
        paymentSchedules: { orderBy: { sequence: 'asc' } },
        paymentTransactions: { orderBy: { createdAt: 'desc' }, take: 50 },
        complianceChecks: { orderBy: { createdAt: 'desc' }, take: 5 },
      },
    });
    if (!app) throw new NotFoundException();
    await assertApplicationCanView(this.prisma, user, app);
    const audience = this.audienceForUser(user, app);
    const dto = mapApplicationDto(app, audience) as Record<string, unknown>;

    if (audience === 'ops' || audience === 'dealer') {
      dto.agent = app.agent
        ? { id: app.agent.id, name: app.agent.name, email: app.agent.email }
        : null;
      dto.allow_direct_activate = app.company?.allowDirectActivate ?? false;
      dto.payment_transactions = app.paymentTransactions.map((txn) => ({
        id: txn.id,
        gateway: txn.gateway,
        amount: Number(txn.amount),
        status: txn.status,
        created_at: txn.createdAt.toISOString(),
        receipt_url: txn.rawPayloadRef ?? null,
      }));
    }

    if (audience === 'ops') {
      const logs = await this.prisma.activityLog.findMany({
        where: { entityType: 'application', entityId: id },
        include: { actor: { select: { email: true, name: true, role: true } } },
        orderBy: { createdAt: 'desc' },
        take: 80,
      });
      const isSuper = user.role === UserRole.super_admin;
      dto.activity_logs = logs
        .filter((l) => (isSuper ? true : l.action !== 'comment'))
        .map((l) => ({
          id: l.id,
          action: l.action,
          from_value: l.fromValue,
          to_value: l.toValue,
          actor_email: l.actor?.email ?? null,
          actor_role: l.actor?.role ?? null,
          metadata: isSuper || user.role === UserRole.admin ? l.metadata : undefined,
          created_at: l.createdAt.toISOString(),
        }));
      dto.comments = logs
        .filter((l) => l.action === 'comment')
        .map((l) => ({
          id: l.id,
          body: l.toValue,
          actor_email: l.actor?.email ?? null,
          created_at: l.createdAt.toISOString(),
        }));
      dto.compliance_checks = app.complianceChecks.map((c) => ({
        id: c.id,
        overall_status: c.overallStatus,
        created_at: c.createdAt.toISOString(),
      }));
    }

    return dto;
  }

  async opsQueue(
    user: User,
    query: PaginationQueryDto & {
      status?: ApplicationStatus;
      statusIn?: string;
      q?: string;
      companyId?: string;
      scheduleHealth?: string;
      createdFrom?: string;
      createdTo?: string;
    } = {},
  ) {
    const allowed: UserRole[] = [
      UserRole.credit_officer,
      UserRole.admin,
      UserRole.super_admin,
      UserRole.finance_officer,
      UserRole.group_admin,
    ];
    if (!allowed.includes(user.role)) {
      throw new ForbiddenException('forbidden_role');
    }

    const { limit, offset } = resolvePagination(query, { defaultLimit: 50, maxLimit: 200 });
    const companyFilter = await opsCompanyFilter(this.prisma, user);
    const statusIn = this.parseStatusIn(query.status, query.statusIn, user.role);
    const search = query.q?.trim();
    const createdFrom = query.createdFrom ? new Date(query.createdFrom) : undefined;
    const createdTo = query.createdTo ? new Date(query.createdTo) : undefined;
    const requestedCompany = query.companyId?.trim();
    const scopedCompanyIds = companyFilter
      ? requestedCompany
        ? companyFilter.filter((id) => id === requestedCompany)
        : companyFilter
      : requestedCompany
        ? [requestedCompany]
        : undefined;
    const where: Prisma.ApplicationWhereInput = {
      ...(statusIn ? { status: { in: statusIn } } : {}),
      ...(scopedCompanyIds ? { companyId: { in: scopedCompanyIds } } : {}),
      ...(createdFrom && !Number.isNaN(createdFrom.getTime()) ? { createdAt: { gte: createdFrom } } : {}),
      ...(createdTo && !Number.isNaN(createdTo.getTime())
        ? { createdAt: { ...(createdFrom ? { gte: createdFrom } : {}), lte: createdTo } }
        : {}),
      ...(query.scheduleHealth === 'overdue'
        ? { paymentSchedules: { some: { status: 'overdue' } } }
        : query.scheduleHealth === 'on_track'
          ? { paymentSchedules: { some: {}, none: { status: 'overdue' } } }
          : query.scheduleHealth === 'none'
            ? { paymentSchedules: { none: {} } }
            : {}),
      ...(search
        ? {
            OR: [
              { customerEmail: { contains: search, mode: 'insensitive' } },
              { id: { contains: search, mode: 'insensitive' } },
              { customer: { name: { contains: search, mode: 'insensitive' } } },
              { company: { name: { contains: search, mode: 'insensitive' } } },
              { agent: { name: { contains: search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.application.findMany({
        where,
        include: {
          product: { select: { make: true, model: true, modelYear: true, slug: true, price: true } },
          company: { select: { name: true } },
          customer: { select: { name: true, email: true } },
          agent: { select: { id: true, name: true, email: true } },
          paymentSchedules: { select: { status: true, dueDate: true } },
          financePartner: { select: { name: true, code: true, crmAdapter: true } },
        },
        orderBy: { createdAt: 'asc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.application.count({ where }),
    ]);
    const metricsRows = await this.prisma.application.findMany({
      where,
      select: {
        pricingSnapshot: true,
        paymentSchedules: { select: { remainingAmount: true, amount: true } },
      },
      take: 500,
    });
    let loanValue = 0;
    let receivable = 0;
    let paymentCount = 0;
    let paymentSum = 0;
    for (const row of metricsRows) {
      const pricing = (row.pricingSnapshot as Record<string, unknown>) ?? {};
      loanValue += Number(pricing.financed_total ?? pricing.list_price ?? 0);
      for (const schedule of row.paymentSchedules) {
        receivable += Number(schedule.remainingAmount);
        paymentSum += Number(schedule.amount);
        paymentCount += 1;
      }
    }
    return {
      ...toPaginatedResponse(items.map((item) => toOpsApplicationQueueItemDto(item)), total, limit, offset),
      metrics: {
        loan_value: Math.round(loanValue),
        receivable: Math.round(receivable),
        avg_payment: paymentCount ? Math.round(paymentSum / paymentCount) : 0,
      },
    };
  }

  async dealerLeads(
    user: User,
    query: PaginationQueryDto & { status?: ApplicationStatus; q?: string; tab?: string } = {},
  ) {
    if (user.role !== UserRole.dealer_agent || !user.companyId) {
      throw new ForbiddenException('forbidden_role');
    }
    const { limit, offset } = resolvePagination(query, { defaultLimit: 50, maxLimit: 100 });
    const search = query.q?.trim();
    const tab = query.tab?.trim();
    const where: Prisma.ApplicationWhereInput = {
      companyId: user.companyId,
      ...(query.status ? { status: query.status } : {}),
      ...(tab === 'mine' ? { agentUserId: user.id } : {}),
      ...(tab === 'resubmission' ? { status: ApplicationStatus.resubmission_required } : {}),
      ...(search
        ? {
            OR: [
              { customerEmail: { contains: search, mode: 'insensitive' } },
              { customer: { name: { contains: search, mode: 'insensitive' } } },
              { id: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.application.findMany({
        where,
        include: {
          product: { select: { make: true, model: true, modelYear: true, slug: true } },
          customer: { select: { name: true, email: true, phone: true } },
          agent: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.application.count({ where }),
    ]);
    return toPaginatedResponse(items.map((item) => toDealerApplicationListItemDto(item)), total, limit, offset);
  }

  async patchOps(
    user: User,
    id: string,
    body: {
      agentUserId?: string | null;
      companyId?: string;
      comment?: string;
      customerSnapshot?: Record<string, unknown>;
      hideInterest?: boolean;
    },
  ) {
    const isAdmin = user.role === UserRole.admin || user.role === UserRole.super_admin;
    const isCredit = user.role === UserRole.credit_officer;
    if (!isAdmin && !isCredit) throw new ForbiddenException('forbidden_role');

    const app = await this.prisma.application.findUnique({ where: { id } });
    if (!app) throw new NotFoundException();
    await assertApplicationCanView(this.prisma, user, app);

    if (body.comment?.trim()) {
      await this.activity.log({
        actorUserId: user.id,
        entityType: 'application',
        entityId: id,
        action: 'comment',
        toValue: body.comment.trim(),
      });
    }

    const data: Prisma.ApplicationUpdateInput = {};
    if (isAdmin && body.agentUserId !== undefined) {
      data.agent = body.agentUserId ? { connect: { id: body.agentUserId } } : { disconnect: true };
    }
    if (isAdmin && body.companyId) {
      data.company = { connect: { id: body.companyId } };
    }
    if (body.customerSnapshot && typeof body.customerSnapshot === 'object') {
      data.customerSnapshot = asJson({
        ...((app.customerSnapshot as Record<string, unknown>) ?? {}),
        ...body.customerSnapshot,
      });
    }
    if (body.hideInterest !== undefined) {
      const pricing = (app.pricingSnapshot as Record<string, unknown>) ?? {};
      data.pricingSnapshot = asJson({ ...pricing, hide_interest: body.hideInterest });
    }

    if (Object.keys(data).length > 0) {
      await this.prisma.application.update({ where: { id }, data });
      await this.activity.log({
        actorUserId: user.id,
        entityType: 'application',
        entityId: id,
        action: 'application_updated',
      });
    }

    return this.getOne(user, id);
  }

  private parseStatusIn(
    status: ApplicationStatus | undefined,
    statusIn: string | undefined,
    role: UserRole,
  ): ApplicationStatus[] | undefined {
    if (status) return [status];
    if (statusIn?.trim()) {
      return statusIn
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean) as ApplicationStatus[];
    }
    if (role === UserRole.credit_officer) return [...CREDIT_QUEUE_STATUSES];
    if (role === UserRole.finance_officer) {
      return [
        ApplicationStatus.down_payment_required,
        ApplicationStatus.down_payment_submitted,
        ApplicationStatus.pending_finance_activation,
        ApplicationStatus.active,
      ];
    }
    return undefined;
  }

  async transition(user: User, id: string, toStatus: ApplicationStatus, reason?: string) {
    return this.lifecycle.opsTransition(user, id, toStatus, reason);
  }

  async resubmit(user: User, id: string) {
    const app = await this.prisma.application.findUnique({
      where: { id },
      include: { documents: true, financePartner: true },
    });
    if (!app || app.customerUserId !== user.id) throw new ForbiddenException('forbidden_role');
    if (app.status !== 'resubmission_required') {
      throw new BadRequestException('invalid_status_transition');
    }
    if (!hasAllRequiredDocuments(app.documents)) {
      throw new BadRequestException('documents_incomplete');
    }

    const nextStatus = submittedStatusForPartner(app.financePartner?.crmAdapter);
    const updated = await this.prisma.$transaction(async (tx) => {
      await transitionApplication(tx, id, ApplicationStatus.resubmission_required, {
        status: nextStatus,
      });
      return tx.application.findUniqueOrThrow({ where: { id } });
    });

    await this.activity.log({
      actorUserId: user.id,
      entityType: 'application',
      entityId: id,
      action: 'status_transition',
      fromValue: 'resubmission_required',
      toValue: nextStatus,
    });

    await this.syncToCrmIfNeeded(id, nextStatus, user.id);

    this.analytics.track('application_submitted', {
      application_id: id,
      product_id: app.productId,
      company_id: app.companyId,
      is_resubmit: true,
    });

    return toApplicationDto(updated);
  }

  async cancel(user: User, id: string, reason?: string) {
    const app = await this.prisma.application.findUnique({ where: { id } });
    if (!app || app.customerUserId !== user.id) throw new ForbiddenException('forbidden_role');
    if (!['draft', 'under_review', 'resubmission_required'].includes(app.status)) {
      throw new BadRequestException('invalid_status_transition');
    }

    const fromStatus = app.status as ApplicationStatus;
    const updated = await this.prisma.$transaction(async (tx) => {
      await transitionApplication(tx, id, fromStatus, {
        status: ApplicationStatus.submission_cancelled,
        statusReason: reason,
      });

      if (fromStatus !== ApplicationStatus.draft) {
        const stillBlocking = await tx.application.findFirst({
          where: {
            productId: app.productId,
            id: { not: id },
            status: { in: BLOCKING_APPLICATION_STATUSES },
          },
        });
        if (!stillBlocking) {
          await tx.product.update({
            where: { id: app.productId },
            data: { listingStatus: ListingStatus.published },
          });
        }
      }

      return tx.application.findUniqueOrThrow({ where: { id } });
    });

    await this.activity.log({
      actorUserId: user.id,
      entityType: 'application',
      entityId: id,
      action: 'status_transition',
      toValue: 'submission_cancelled',
    });
    return toApplicationDto(updated);
  }

  async uploadDoc(
    user: User,
    id: string,
    category: ApplicationDocCategory,
    file: Express.Multer.File,
  ) {
    const app = await this.prisma.application.findUnique({ where: { id } });
    if (!app || app.customerUserId !== user.id) throw new ForbiddenException('forbidden_role');
    // `partner_processing` for the same reason it is on the staff guard: a
    // customer who submits to an Al Jazeera offer lands in that status
    // immediately (submittedStatusForPartner). Without it, when the partner
    // comes back asking for an updated payslip the customer has no way to send
    // it — the request fails with a bare 400 and only a dealer or admin can
    // attach it on their behalf.
    if (!['draft', 'partner_processing', 'resubmission_required'].includes(app.status)) {
      throw new BadRequestException('validation_failed');
    }

    this.storage.assertKycFile(file);
    const key = await this.storage.uploadKyc(file, id, category);
    const doc = await this.prisma.applicationDocument.create({
      data: {
        applicationId: id,
        category: category as DocumentCategory,
        storagePath: key,
        mimeType: file.mimetype,
        // Stored so the partner CRM can attach the file under the name the
        // customer actually uploaded; without it the attachment is named from
        // the generated storage key and arrives as an opaque uuid.
        originalName: file.originalname,
        uploadedById: user.id,
      },
    });

    this.analytics.track('document_uploaded', {
      application_id: id,
      category,
      mime_type: file.mimetype,
    });

    // Push the new file to the partner CRM. Without this a document uploaded
    // after the lead already exists — the whole point of
    // `resubmission_required` — never reaches them: the lead was created and
    // synced earlier, and nothing re-sent it. Draft uploads still skip sync —
    // the submit/resubmit path sends every document in one awaited sync, same
    // as the dealer wizard's per-file sync after the application is submitted.
    await this.syncToCrmIfNeeded(id, app.status, user.id);

    return toApplicationDocumentDto(doc);
  }

  async downloadDocument(user: User, appId: string, docId: string) {
    const app = await this.prisma.application.findUnique({ where: { id: appId } });
    if (!app) throw new NotFoundException();
    await assertApplicationCanView(this.prisma, user, app);

    const doc = await this.prisma.applicationDocument.findFirst({
      where: { id: docId, applicationId: appId },
    });
    if (!doc) throw new NotFoundException();

    const file = await this.storage.readKyc(doc.storagePath);
    const ext = path.extname(doc.storagePath) || '.pdf';
    const filename = `${doc.category}${ext}`;
    return { ...file, filename };
  }

  private async notifyOpsOnSubmit(companyId: string, appId: string) {
    const notifyTargets = await this.prisma.user.findMany({
      where: {
        isActive: true,
        OR: [
          { role: UserRole.credit_officer, creditScope: 'all' },
          { role: UserRole.dealer_agent, companyId },
          { role: { in: [UserRole.admin, UserRole.super_admin] } },
        ],
      },
    });
    for (const t of notifyTargets) {
      await this.activity.notify(
        t.id,
        t.role === UserRole.dealer_agent ? 'New lead on your stock' : 'New financing application',
        'A customer submitted a financing application.',
        t.role === UserRole.dealer_agent ? `/applications/${appId}` : `/applications/${appId}`,
      );
    }
  }

  /** Mirrors dealer/staff CRM sync — awaited, not fire-and-forget. */
  private async syncToCrmIfNeeded(
    applicationId: string,
    status: ApplicationStatus,
    actorUserId?: string,
  ): Promise<void> {
    if (!shouldSyncStatusToCrm(status)) return;
    await this.zoho.syncApplicationToZoho(applicationId, actorUserId);
  }

  async deleteOps(user: User, id: string) {
    if (user.role !== UserRole.admin && user.role !== UserRole.super_admin) {
      throw new ForbiddenException('forbidden_role');
    }
    const app = await this.prisma.application.findUnique({
      where: { id },
      include: { paymentSchedules: true },
    });
    if (!app) throw new NotFoundException();
    if (!['draft', 'rejected', 'submission_cancelled'].includes(app.status)) {
      throw new BadRequestException('cannot_delete_application');
    }
    if (app.paymentSchedules.some((s) => Number(s.paidAmount) > 0)) {
      throw new BadRequestException('cannot_delete_paid_application');
    }
    await this.prisma.paymentSchedule.deleteMany({ where: { applicationId: id } });
    await this.prisma.application.delete({ where: { id } });
    await this.activity.log({
      actorUserId: user.id,
      entityType: 'application',
      entityId: id,
      action: 'application_deleted',
    });
    return { ok: true };
  }

  async rebuildSchedule(
    user: User,
    id: string,
    dto: { tenureMonths?: number; downPaymentPct?: number; sellingPrice?: number; installmentPlan?: InstallmentPlan },
  ) {
    if (user.role !== UserRole.admin && user.role !== UserRole.super_admin) {
      throw new ForbiddenException('forbidden_role');
    }
    const app = await this.prisma.application.findUnique({
      where: { id },
      include: { offer: true, paymentSchedules: true, product: true },
    });
    if (!app) throw new NotFoundException();
    if (app.status === ApplicationStatus.partner_processing) {
      throw new BadRequestException('partner_application_readonly');
    }
    if (app.paymentSchedules.some((s) => Number(s.paidAmount) > 0)) {
      throw new BadRequestException('cannot_rebuild_paid_schedule');
    }
    const pricing = (app.pricingSnapshot as Record<string, unknown>) ?? {};
    const next = buildApplicationPricingSnapshot({
      listPrice: dto.sellingPrice ?? Number(pricing.list_price ?? pricing.selling_price ?? 0),
      offer: app.offer,
      pricingSnapshot: {
        ...pricing,
        tenor: dto.tenureMonths ?? pricing.tenor ?? pricing.tenure,
        tenure: dto.tenureMonths ?? pricing.tenure ?? pricing.tenor,
        down_payment_pct: dto.downPaymentPct ?? pricing.down_payment_pct,
      },
    });
    const installmentPlan =
      dto.installmentPlan ??
      buildPlanFromPricingSnapshot({
        pricingSnapshot: next,
        vehiclePrice: Number(next.list_price ?? app.product.price),
      });

    await this.prisma.$transaction(async (tx) => {
      await tx.application.update({
        where: { id },
        data: {
          pricingSnapshot: next as Prisma.InputJsonValue,
          installmentPlan: installmentPlan as unknown as Prisma.InputJsonValue,
        },
      });
      if (app.status === ApplicationStatus.active) {
        await syncPaymentSchedulesFromInstallmentPlan(tx, id, next, installmentPlan);
      }
    });
    return this.getOne(user, id);
  }

  async convertDailyToMonthly(user: User, id: string) {
    const allowed: UserRole[] = [
      UserRole.credit_officer,
      UserRole.admin,
      UserRole.super_admin,
    ];
    if (!allowed.includes(user.role)) {
      throw new ForbiddenException('forbidden_role');
    }

    const app = await this.prisma.application.findUnique({
      where: { id },
      include: { paymentSchedules: { orderBy: { dueDate: 'asc' } } },
    });
    if (!app) throw new NotFoundException();

    const plan = app.installmentPlan as InstallmentPlan | null;
    if (plan?.schedule?.length) {
      const monthlyPlan = convertInstallmentPlanDailyToMonthly(plan);
      await this.prisma.$transaction(async (tx) => {
        await tx.application.update({
          where: { id },
          data: {
            installmentPlan: monthlyPlan as unknown as Prisma.InputJsonValue,
          },
        });
        if (app.paymentSchedules.length > 0) {
          await syncPaymentSchedulesFromInstallmentPlan(
            tx,
            id,
            app.pricingSnapshot as Record<string, unknown>,
            monthlyPlan,
          );
        }
      });
      return this.getOne(user, id);
    }

    const rows = app.paymentSchedules;
    if (rows.length < 2) throw new BadRequestException('not_daily_schedule');
    const firstGap = (rows[1].dueDate.getTime() - rows[0].dueDate.getTime()) / 86400000;
    if (firstGap > 7) throw new BadRequestException('not_daily_schedule');
    const unpaid = rows.filter((r) => Number(r.paidAmount) === 0);
    const groups = new Map<string, typeof unpaid>();
    for (const row of unpaid) {
      const key = `${row.dueDate.getUTCFullYear()}-${row.dueDate.getUTCMonth()}`;
      const list = groups.get(key) ?? [];
      list.push(row);
      groups.set(key, list);
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.paymentSchedule.deleteMany({ where: { id: { in: unpaid.map((r) => r.id) } } });
      let sequence = rows.filter((r) => Number(r.paidAmount) > 0).length;
      for (const group of groups.values()) {
        sequence += 1;
        const amount = group.reduce((sum, r) => sum + Number(r.amount), 0);
        await tx.paymentSchedule.create({
          data: {
            applicationId: id,
            sequence,
            dueDate: group[0].dueDate,
            amount,
            paidAmount: 0,
            remainingAmount: amount,
            status: 'pending',
          },
        });
      }
    });
    return this.getOne(user, id);
  }

  async syncSchedulesFromPlan(user: User, id: string) {
    const allowed: UserRole[] = [
      UserRole.credit_officer,
      UserRole.finance_officer,
      UserRole.admin,
      UserRole.super_admin,
    ];
    if (!allowed.includes(user.role)) {
      throw new ForbiddenException('forbidden_role');
    }
    const app = await this.prisma.application.findUnique({ where: { id } });
    if (!app) throw new NotFoundException();
    if (app.status === ApplicationStatus.partner_processing) {
      throw new BadRequestException('partner_application_readonly');
    }
    const plan = app.installmentPlan as InstallmentPlan | null;
    if (!plan?.schedule?.length) {
      throw new BadRequestException('empty_installment_plan');
    }
    await this.prisma.$transaction(async (tx) => {
      await syncPaymentSchedulesFromInstallmentPlan(
        tx,
        id,
        app.pricingSnapshot as Record<string, unknown>,
        plan,
      );
    });
    return this.getOne(user, id);
  }

  private audienceForUser(
    user: User,
    app: { customerUserId: string; companyId: string },
  ): ApplicationAudience {
    const ops: UserRole[] = [
      UserRole.credit_officer,
      UserRole.finance_officer,
      UserRole.admin,
      UserRole.super_admin,
      UserRole.group_admin,
    ];
    if (ops.includes(user.role)) return 'ops';
    if (user.role === UserRole.dealer_agent && user.companyId === app.companyId) return 'dealer';
    return 'customer';
  }
}
