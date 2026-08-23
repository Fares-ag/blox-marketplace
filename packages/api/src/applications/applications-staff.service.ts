import { randomBytes } from 'node:crypto';
import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ApplicationStatus,
  DocumentCategory,
  ListingStatus,
  Prisma,
  User,
  UserRole,
} from '@prisma/client';
import type { AuthInstance } from '../auth/auth.constants';
import { AUTH_INSTANCE } from '../auth/auth.constants';
import { AppConfigService } from '../config/app-config.service';
import { ActivityService } from '../common/activity.service';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { BLOCKING_APPLICATION_STATUSES } from './application-access';
import { hasAllRequiredDocuments } from './application-documents';
import type { ApplicationDocCategory } from './application-documents';
import { buildApplicationPricingSnapshot } from './application-pricing';
import { buildPlanFromPricingSnapshot, planForVehicle, resolveDownPaymentPercent } from '@drivemarket/shared/installment-plan';
import type { InstallmentPlan } from '@drivemarket/shared/installment-plan';
import { toApplicationDto } from './application-response.dto';
import { assertRowsUpdated, transitionApplication } from './guarded-transitions';
import { submittedStatusForPartner } from './partner-finance';
import { ZohoCrmService } from '../integrations/zoho/zoho-crm.service';
import { shouldSyncStatusToCrm } from '../integrations/zoho/zoho-sync-policy';

function asJson(value: Record<string, unknown>): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

export type StaffCustomerSnapshot = Record<string, unknown>;

export type StaffCreateApplicationDto = {
  productId?: string;
  productIds?: string[];
  offerId: string;
  customerSnapshot: StaffCustomerSnapshot;
  pricingSnapshot: Record<string, unknown>;
  installmentPlan?: InstallmentPlan;
  agentUserId?: string;
  listPrice?: number;
  sellingPrice?: number;
  hideInterest?: boolean;
  companyId?: string;
  submit?: boolean;
};

@Injectable()
export class ApplicationsStaffService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityService,
    private readonly mail: MailService,
    private readonly appConfig: AppConfigService,
    @Inject(AUTH_INSTANCE) private readonly auth: AuthInstance,
    private readonly zoho: ZohoCrmService,
  ) {}

  async create(actor: User, dto: StaffCreateApplicationDto) {
    const isDealer = actor.role === UserRole.dealer_agent;
    const isAdmin = actor.role === UserRole.admin || actor.role === UserRole.super_admin;
    if (!isDealer && !isAdmin) throw new ForbiddenException('forbidden_role');
    if (isDealer && !actor.companyId) throw new ForbiddenException('forbidden_role');

    const productIds = (dto.productIds?.length ? dto.productIds : dto.productId ? [dto.productId] : [])
      .map((id) => id.trim())
      .filter(Boolean);
    if (productIds.length === 0) throw new BadRequestException('validation_failed');

    const snap = dto.customerSnapshot as Record<string, unknown>;
    const email = String(snap.email ?? '').trim().toLowerCase();
    const phone = String(snap.phone ?? '').trim();
    const qid = String(snap.qid ?? '').trim();
    const full_name = String(snap.full_name ?? '').trim();
    if (!email || !phone || !qid || !full_name) {
      throw new BadRequestException('validation_failed');
    }

    const customer = await this.findOrCreateWalkInCustomer(actor, {
      email,
      name: full_name,
      phone,
      qid,
    });

    const blocking = await this.prisma.application.findFirst({
      where: { customerUserId: customer.id, status: { in: BLOCKING_APPLICATION_STATUSES } },
      select: { id: true },
    });
    if (blocking) throw new BadRequestException('blocking_application_exists');

    const offer = await this.prisma.offer.findFirst({
      where: { id: dto.offerId, status: 'active' },
      include: { financePartner: { select: { crmAdapter: true } } },
    });
    if (!offer) throw new BadRequestException('validation_failed');

    const bulkBatchId =
      productIds.length > 1
        ? typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `bulk-${Date.now()}`
        : undefined;

    const initialStatus =
      isDealer || dto.submit
        ? submittedStatusForPartner(offer.financePartner?.crmAdapter)
        : ApplicationStatus.draft;
    const agentUserId = dto.agentUserId || (isDealer ? actor.id : undefined);

    const firstProduct = await this.prisma.product.findUnique({ where: { id: productIds[0]! } });
    if (!firstProduct) throw new BadRequestException('listing_not_available');
    const templateSellingPrice = Number(dto.sellingPrice ?? dto.listPrice ?? firstProduct.price);

    const templatePlan =
      dto.installmentPlan ??
      buildPlanFromPricingSnapshot({
        pricingSnapshot: dto.pricingSnapshot,
        vehiclePrice: templateSellingPrice,
      });
    const downPct = resolveDownPaymentPercent(templatePlan, templateSellingPrice);

    const createdIds: string[] = [];
    for (const productId of productIds) {
      const product = await this.prisma.product.findUnique({ where: { id: productId } });
      if (!product) throw new BadRequestException('listing_not_available');
      if (isDealer && product.companyId !== actor.companyId) {
        throw new ForbiddenException('forbidden_role');
      }
      if (isAdmin && dto.companyId && dto.companyId !== product.companyId) {
        throw new BadRequestException('company_mismatch');
      }
      if (
        product.listingStatus === ListingStatus.sold ||
        product.listingStatus === ListingStatus.archived
      ) {
        throw new BadRequestException('listing_not_available');
      }

      const listPrice = Number(dto.listPrice ?? product.price);
      const sellingPriceForProduct = Number(
        productIds.length === 1 ? templateSellingPrice : product.price,
      );
      const pricingSnapshot = {
        ...buildApplicationPricingSnapshot({
          listPrice: sellingPriceForProduct,
          offer,
          pricingSnapshot: dto.pricingSnapshot,
        }),
        list_price: listPrice,
        selling_price: sellingPriceForProduct,
        hide_interest: !!dto.hideInterest,
      };

      const installmentPlan =
        planForVehicle(templatePlan, sellingPriceForProduct, downPct) ?? templatePlan;

      const customerSnapshot: Record<string, unknown> = {
        ...snap,
        email,
        phone,
        qid,
        full_name,
        applicantType: snap.applicantType ?? 'individual',
      };
      if (bulkBatchId) customerSnapshot.bulkBatchId = bulkBatchId;

      const now = new Date();
      const app = await this.prisma.$transaction(async (tx) => {
        const created = await tx.application.create({
          data: {
            customerUserId: customer.id,
            customerEmail: customer.email,
            customerSnapshot: asJson(customerSnapshot),
            productId: product.id,
            companyId: product.companyId,
            offerId: offer.id,
            financePartnerId: offer.financePartnerId,
            leadSource: 'walk_in',
            pricingSnapshot: asJson(pricingSnapshot),
            installmentPlan: asJson(installmentPlan as unknown as Record<string, unknown>),
            status: initialStatus,
            agentUserId: agentUserId ?? null,
            submittedAt: initialStatus !== ApplicationStatus.draft ? now : null,
          },
        });

        if (initialStatus !== ApplicationStatus.draft) {
          const reserved = await tx.product.updateMany({
            where: { id: product.id, listingStatus: ListingStatus.published },
            data: { listingStatus: ListingStatus.reserved },
          });
          if (reserved.count === 0 && product.listingStatus === ListingStatus.published) {
            assertRowsUpdated(reserved.count, 'vehicle_unavailable');
          }
        }

        return created;
      });

      await this.activity.log({
        actorUserId: actor.id,
        entityType: 'application',
        entityId: app.id,
        action: 'application_created',
        toValue: initialStatus,
        metadata: { staff: true, walk_in: true },
      });
      createdIds.push(app.id);
      if (initialStatus !== ApplicationStatus.draft && shouldSyncStatusToCrm(initialStatus)) {
        void this.zoho.syncApplicationToZoho(app.id, actor.id);
      }
    }

    const first = await this.prisma.application.findUniqueOrThrow({
      where: { id: createdIds[0] },
    });
    return {
      ...toApplicationDto(first),
      created_ids: createdIds,
    };
  }

  async submitDraft(actor: User, id: string) {
    const isDealer = actor.role === UserRole.dealer_agent;
    const isAdmin = actor.role === UserRole.admin || actor.role === UserRole.super_admin;
    if (!isDealer && !isAdmin) throw new ForbiddenException('forbidden_role');

    const app = await this.prisma.application.findUnique({
      where: { id },
      include: { documents: true, product: true, financePartner: true },
    });
    if (!app) throw new NotFoundException();
    if (isDealer && app.companyId !== actor.companyId) throw new ForbiddenException('forbidden_role');
    if (app.status !== ApplicationStatus.draft && app.status !== ApplicationStatus.resubmission_required) {
      throw new BadRequestException('invalid_status_transition');
    }
    if (!hasAllRequiredDocuments(app.documents)) {
      throw new BadRequestException('documents_incomplete');
    }

    const fromStatus = app.status;
    const nextStatus = submittedStatusForPartner(app.financePartner?.crmAdapter);
    const updated = await this.prisma.$transaction(async (tx) => {
      await transitionApplication(tx, id, fromStatus, {
        status: nextStatus,
        submittedAt: app.submittedAt ?? new Date(),
      });
      if (fromStatus === ApplicationStatus.draft) {
        await tx.product.updateMany({
          where: { id: app.productId, listingStatus: ListingStatus.published },
          data: { listingStatus: ListingStatus.reserved },
        });
      }
      return tx.application.findUniqueOrThrow({ where: { id } });
    });

    await this.activity.log({
      actorUserId: actor.id,
      entityType: 'application',
      entityId: id,
      action: 'status_transition',
      fromValue: fromStatus,
      toValue: nextStatus,
    });
    if (shouldSyncStatusToCrm(nextStatus)) {
      void this.zoho.syncApplicationToZoho(id, actor.id);
    }
    return toApplicationDto(updated);
  }

  async uploadDoc(
    actor: User,
    id: string,
    category: ApplicationDocCategory,
    file: Express.Multer.File,
    storage: { assertKycFile: (f: Express.Multer.File) => void; uploadKyc: (f: Express.Multer.File, appId: string, cat: string) => Promise<string> },
  ) {
    const app = await this.prisma.application.findUnique({ where: { id } });
    if (!app) throw new NotFoundException();
    const isDealer = actor.role === UserRole.dealer_agent && actor.companyId === app.companyId;
    const isOps =
      actor.role === UserRole.admin ||
      actor.role === UserRole.super_admin ||
      actor.role === UserRole.credit_officer;
    if (!isDealer && !isOps) throw new ForbiddenException('forbidden_role');
    if (!['draft', 'under_review', 'resubmission_required', 'contract_signing_required'].includes(app.status)) {
      throw new BadRequestException('validation_failed');
    }

    storage.assertKycFile(file);
    const key = await storage.uploadKyc(file, id, category);
    const doc = await this.prisma.applicationDocument.create({
      data: {
        applicationId: id,
        category: category as DocumentCategory,
        storagePath: key,
        mimeType: file.mimetype,
        uploadedById: actor.id,
      },
    });
    return {
      id: doc.id,
      category: doc.category,
      mime_type: doc.mimeType,
      created_at: doc.createdAt,
    };
  }

  private async findOrCreateWalkInCustomer(
    actor: User,
    input: { email: string; name: string; phone: string; qid: string },
  ) {
    const existing = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (existing) {
      if (existing.role !== UserRole.customer) {
        throw new BadRequestException('email_not_customer');
      }
      await this.prisma.user.update({
        where: { id: existing.id },
        data: {
          name: existing.name || input.name,
          phone: existing.phone || input.phone,
          qid: existing.qid || input.qid,
        },
      });
      return this.prisma.user.findUniqueOrThrow({ where: { id: existing.id } });
    }

    const password = `Tmp!${randomBytes(18).toString('base64url')}`;
    try {
      await this.auth.api.signUpEmail({
        body: { email: input.email, password, name: input.name },
      });
    } catch {
      const raced = await this.prisma.user.findUnique({ where: { email: input.email } });
      if (raced) return raced;
      throw new BadRequestException('walk_in_create_failed');
    }

    const created = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (!created) throw new BadRequestException('walk_in_create_failed');

    await this.prisma.user.update({
      where: { id: created.id },
      data: {
        role: UserRole.customer,
        emailVerified: false,
        phone: input.phone,
        qid: input.qid,
        name: input.name,
      },
    });

    const dealerName =
      actor.role === UserRole.dealer_agent && actor.companyId
        ? ((await this.prisma.company.findUnique({ where: { id: actor.companyId } }))?.name ?? actor.name)
        : actor.name;

    const resetUrl = this.appConfig.marketplacePath('/auth/forgot-password');
    try {
      await this.auth.api.requestPasswordReset({
        body: { email: input.email, redirectTo: this.appConfig.marketplacePath('/auth/reset-password') },
      });
    } catch {
      /* invite email below is the customer-facing path */
    }
    await this.mail.sendWalkInInviteEmail(input.email, resetUrl, dealerName);

    return this.prisma.user.findUniqueOrThrow({ where: { id: created.id } });
  }
}
