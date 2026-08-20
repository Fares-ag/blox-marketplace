import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import path from 'node:path';
import {
  ApplicationStatus,
  ListingStatus,
  Prisma,
  User,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityService } from '../common/activity.service';
import { PaginationQueryDto, resolvePagination, toPaginatedResponse } from '../common/pagination.dto';
import { AnalyticsService } from '../analytics/analytics.service';
import { StorageService } from '../storage/storage.service';
import { ZohoCrmService } from '../integrations/zoho/zoho-crm.service';
import { shouldSyncStatusToCrm } from '../integrations/zoho/zoho-sync-policy';
import {
  buildApplicationPricingSnapshot,
  assertOfferMatchesProduct,
} from './application-pricing';
import { hasAllRequiredDocuments } from './application-documents';
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

  async hasBlocking(userId: string) {
    const found = await this.prisma.application.findFirst({
      where: { customerUserId: userId, status: { in: BLOCKING_APPLICATION_STATUSES } },
      select: { id: true },
    });
    return toApplicationBlockingDto({ blocking: !!found, applicationId: found?.id ?? null });
  }

  async create(
    user: User,
    dto: {
      productId: string;
      offerId: string;
      customerSnapshot: {
        full_name: string;
        phone: string;
        qid: string;
        employment?: string;
        income?: number;
      };
      pricingSnapshot: Record<string, unknown>;
      quoteToken?: string;
    },
  ) {
    if (user.role !== UserRole.customer) throw new ForbiddenException('forbidden_role');

    const blocking = await this.hasBlocking(user.id);
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
      include: { documents: true, product: true },
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
    const updated = await this.prisma.$transaction(async (tx) => {
      await transitionApplication(tx, id, fromStatus, {
        status: ApplicationStatus.under_review,
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
      toValue: 'under_review',
    });

    await this.notifyOpsOnSubmit(app.companyId, id);
    void this.maybeSyncZoho(id, user.id);

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
        company: { select: { id: true, name: true } },
        customer: { select: { name: true, email: true, phone: true } },
        offer: true,
        paymentSchedules: { orderBy: { sequence: 'asc' } },
      },
    });
    if (!app) throw new NotFoundException();
    await assertApplicationCanView(this.prisma, user, app);
    return mapApplicationDto(app, this.audienceForUser(user, app));
  }

  async opsQueue(user: User, query: PaginationQueryDto = {}) {
    const allowed: UserRole[] = [
      UserRole.credit_officer,
      UserRole.admin,
      UserRole.super_admin,
      UserRole.finance_officer,
    ];
    if (!allowed.includes(user.role)) {
      throw new ForbiddenException('forbidden_role');
    }

    const { limit, offset } = resolvePagination(query, { defaultLimit: 50, maxLimit: 200 });
    const companyFilter = await opsCompanyFilter(this.prisma, user);
    const where = {
      status: {
        in: [
          'under_review',
          'resubmission_required',
          'contract_signing_required',
          'contracts_submitted',
          'contract_under_review',
          'down_payment_required',
          'down_payment_submitted',
          'pending_finance_activation',
        ] as ApplicationStatus[],
      },
      ...(companyFilter ? { companyId: { in: companyFilter } } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.application.findMany({
        where,
        include: {
          product: { select: { make: true, model: true, modelYear: true, slug: true } },
          company: { select: { name: true } },
          customer: { select: { name: true, email: true } },
        },
        orderBy: { createdAt: 'asc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.application.count({ where }),
    ]);
    return toPaginatedResponse(items.map((item) => toOpsApplicationQueueItemDto(item)), total, limit, offset);
  }

  async dealerLeads(user: User, query: PaginationQueryDto = {}) {
    if (user.role !== UserRole.dealer_agent || !user.companyId) {
      throw new ForbiddenException('forbidden_role');
    }
    const { limit, offset } = resolvePagination(query, { defaultLimit: 50, maxLimit: 100 });
    const where = { companyId: user.companyId };
    const [items, total] = await Promise.all([
      this.prisma.application.findMany({
        where,
        include: {
          product: { select: { make: true, model: true, modelYear: true, slug: true } },
          customer: { select: { name: true, email: true, phone: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.application.count({ where }),
    ]);
    return toPaginatedResponse(items.map((item) => toDealerApplicationListItemDto(item)), total, limit, offset);
  }

  async transition(user: User, id: string, toStatus: ApplicationStatus, reason?: string) {
    return this.lifecycle.opsTransition(user, id, toStatus, reason);
  }

  async resubmit(user: User, id: string) {
    const app = await this.prisma.application.findUnique({
      where: { id },
      include: { documents: true },
    });
    if (!app || app.customerUserId !== user.id) throw new ForbiddenException('forbidden_role');
    if (app.status !== 'resubmission_required') {
      throw new BadRequestException('invalid_status_transition');
    }
    if (!hasAllRequiredDocuments(app.documents)) {
      throw new BadRequestException('documents_incomplete');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await transitionApplication(tx, id, ApplicationStatus.resubmission_required, {
        status: ApplicationStatus.under_review,
      });
      return tx.application.findUniqueOrThrow({ where: { id } });
    });

    await this.activity.log({
      actorUserId: user.id,
      entityType: 'application',
      entityId: id,
      action: 'status_transition',
      fromValue: 'resubmission_required',
      toValue: 'under_review',
    });

    void this.maybeSyncZoho(id, user.id);

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
    category: 'qid' | 'salary' | 'bank' | 'other',
    file: Express.Multer.File,
  ) {
    const app = await this.prisma.application.findUnique({ where: { id } });
    if (!app || app.customerUserId !== user.id) throw new ForbiddenException('forbidden_role');
    if (!['draft', 'resubmission_required'].includes(app.status)) {
      throw new BadRequestException('validation_failed');
    }

    this.storage.assertKycFile(file);
    const key = await this.storage.uploadKyc(file, id, category);
    const doc = await this.prisma.applicationDocument.create({
      data: {
        applicationId: id,
        category,
        storagePath: key,
        mimeType: file.mimetype,
        uploadedById: user.id,
      },
    });

    this.analytics.track('document_uploaded', {
      application_id: id,
      category,
      mime_type: file.mimetype,
    });

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

  private async maybeSyncZoho(applicationId: string, actorUserId?: string) {
    const app = await this.prisma.application.findUnique({
      where: { id: applicationId },
      select: { status: true },
    });
    if (!app || !shouldSyncStatusToCrm(app.status)) return;
    try {
      await this.zoho.syncApplicationToZoho(applicationId, actorUserId);
    } catch {
      /* logged inside zoho service */
    }
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
    ];
    if (ops.includes(user.role)) return 'ops';
    if (user.role === UserRole.dealer_agent && user.companyId === app.companyId) return 'dealer';
    return 'customer';
  }
}
