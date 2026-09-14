import {
  BadRequestException,
  ConflictException,
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
import type { ApplicationDocCategory } from './application-documents';
import { resolveStoredDocumentCategory } from './application-documents';
import { buildApplicationPricingSnapshot } from './application-pricing';
import { buildPlanFromPricingSnapshot, planForVehicle, resolveDownPaymentPercent } from '@drivemarket/shared/installment-plan';
import type { InstallmentPlan } from '@drivemarket/shared/installment-plan';
import { mapApplicationDto, type ApplicationAudience } from './application-response.dto';
import { assertRowsUpdated, transitionApplication } from './guarded-transitions';
import { submittedStatusForPartner } from './partner-finance';
import { ZohoCrmService } from '../integrations/zoho/zoho-crm.service';
import { shouldSyncStatusToCrm } from '../integrations/zoho/zoho-sync-policy';
import { ApplicationIntakeService } from './application-intake.service';
import { assertNoHardViolations, evaluateProductRules, withRuleFlags } from './application-rules';
import { normalizeCustomerSnapshot, type NormalizedCustomerSnapshot } from './customer-snapshot';
import { assertSubmitGates, VEHICLE_IDENTITY_REQUIRED_FOR_RESERVE } from './submit-gates';
import { assessApplicationCredit, creditAssessedLogMetadata, creditAssessmentData } from './credit-assessment';

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
    private readonly intake: ApplicationIntakeService,
  ) {}

  private audienceFor(actor: User): ApplicationAudience {
    return actor.role === UserRole.dealer_agent ? 'dealer' : 'ops';
  }

  /**
   * Branch attribution for staff-created applications: the creating user's
   * home branch, else the assigned sales executive's (admin creating on an
   * agent's behalf), else none.
   */
  private async resolveBranchId(actor: User, agentUserId?: string | null): Promise<string | null> {
    if (actor.homeBranchId) return actor.homeBranchId;
    if (agentUserId && agentUserId !== actor.id) {
      const agent = await this.prisma.user.findUnique({
        where: { id: agentUserId },
        select: { homeBranchId: true },
      });
      return agent?.homeBranchId ?? null;
    }
    return null;
  }

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
    // Same normalisation as the customer path: residency/nationality from the
    // QID, DOB cross-checked (400 dob_qid_mismatch), guarantor/employment tidied.
    const normalized = normalizeCustomerSnapshot({ ...snap, email, phone, qid, full_name });

    const walkIn = await this.resolveWalkInCustomer(actor, {
      email,
      name: full_name,
      phone,
      qid: normalized.snapshot.qid,
      normalized,
    });

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
    const branchId = await this.resolveBranchId(actor, agentUserId);
    // Lender of record: the offer's partner, else (when submitting now) the default lender.
    const defaultLenderId =
      !offer.financePartnerId && initialStatus !== ApplicationStatus.draft
        ? await this.intake.defaultLenderId()
        : null;
    const lenderId = offer.financePartnerId ?? defaultLenderId;

    const qidHash = this.intake.qidHash(normalized.snapshot.qid);
    const identity = await this.intake.evaluateIdentity({
      userId: walkIn.userId,
      qid: normalized.snapshot.qid,
      name: normalized.snapshot.full_name,
      birthYear: normalized.birthYear,
    });
    const enforcement = this.intake.ruleEnforcement();

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

      if (initialStatus !== ApplicationStatus.draft) {
        if (product.listingStatus === ListingStatus.reserved) {
          throw new ConflictException('vehicle_unavailable');
        }
        if (product.listingStatus !== ListingStatus.published) {
          throw new BadRequestException('listing_not_available');
        }
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
      const violations = evaluateProductRules({
        product,
        offer,
        pricingSnapshot,
        applicantType: normalized.snapshot.applicantType,
        residency: normalized.residency,
        enforcement,
      });
      assertNoHardViolations(violations);
      const pricingWithFlags = withRuleFlags(pricingSnapshot, violations);

      const installmentPlan =
        planForVehicle(templatePlan, sellingPriceForProduct, downPct) ?? templatePlan;

      const customerSnapshot: Record<string, unknown> = {
        ...normalized.snapshot,
        email,
        phone,
        qid: normalized.snapshot.qid,
        full_name,
        applicantType: normalized.snapshot.applicantType,
      };
      if (bulkBatchId) customerSnapshot.bulkBatchId = bulkBatchId;

      // Submitted straight away → the credit assessment is captured now, as it
      // is for a customer submit.
      const assessed =
        initialStatus !== ApplicationStatus.draft
          ? assessApplicationCredit({ customerSnapshot, pricingSnapshot: pricingWithFlags, product })
          : null;

      const now = new Date();
      const app = await this.prisma.$transaction(async (tx) => {
        const created = await tx.application.create({
          data: {
            customerUserId: walkIn.userId,
            customerEmail: walkIn.email,
            customerSnapshot: asJson(customerSnapshot),
            productId: product.id,
            companyId: product.companyId,
            offerId: offer.id,
            financePartnerId: lenderId,
            leadSource: walkIn.userId ? 'walk_in' : 'walk_in_pending',
            pricingSnapshot: asJson(pricingWithFlags),
            installmentPlan: asJson(installmentPlan as unknown as Record<string, unknown>),
            status: initialStatus,
            agentUserId: agentUserId ?? null,
            branchId,
            qidHash,
            submittedAt: initialStatus !== ApplicationStatus.draft ? now : null,
            ...this.intake.holdColumns(identity, now),
            ...(assessed ? creditAssessmentData(assessed) : {}),
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
        metadata: { staff: true, walk_in: true, branch_id: branchId },
      });
      if (assessed) {
        await this.activity.log({
          actorUserId: actor.id,
          entityType: 'application',
          entityId: app.id,
          action: 'credit_assessed',
          toValue: assessed.assessment.path,
          metadata: creditAssessedLogMetadata(assessed, 'submit'),
        });
      }
      if (identity) {
        await this.intake.recordHold({
          applicationId: app.id,
          companyId: app.companyId,
          actorUserId: actor.id,
          decision: identity,
        });
      }
      if (defaultLenderId) {
        await this.activity.log({
          actorUserId: actor.id,
          entityType: 'application',
          entityId: app.id,
          action: 'lender_tagged',
          toValue: defaultLenderId,
          metadata: { source: 'default_lender' },
        });
      }
      createdIds.push(app.id);
      if (initialStatus !== ApplicationStatus.draft && shouldSyncStatusToCrm(initialStatus)) {
        void this.zoho.syncApplicationToZoho(app.id, actor.id);
      }
    }

    const first = await this.prisma.application.findUniqueOrThrow({
      where: { id: createdIds[0] },
    });
    return {
      ...mapApplicationDto(first, this.audienceFor(actor)),
      created_ids: createdIds,
    };
  }

  async submitDraft(actor: User, id: string) {
    const isDealer = actor.role === UserRole.dealer_agent;
    const isAdmin = actor.role === UserRole.admin || actor.role === UserRole.super_admin;
    if (!isDealer && !isAdmin) throw new ForbiddenException('forbidden_role');

    const app = await this.prisma.application.findUnique({
      where: { id },
      include: {
        documents: { include: { uploadedBy: { select: { role: true } } } },
        product: true,
        financePartner: true,
      },
    });
    if (!app) throw new NotFoundException();
    if (isDealer && app.companyId !== actor.companyId) throw new ForbiddenException('forbidden_role');
    if (app.status !== ApplicationStatus.draft && app.status !== ApplicationStatus.resubmission_required) {
      throw new BadRequestException('invalid_status_transition');
    }
    const fromStatus = app.status;
    // identity_hold → consents_required → documents_missing → documents_stale →
    // guarantor_consent_required → vehicle_identity_incomplete (only when
    // reserving) → vehicle_age_rule
    assertSubmitGates({
      application: app,
      documents: app.documents.map(({ uploadedBy, ...doc }) => ({ ...doc, uploadedByRole: uploadedBy?.role ?? null })),
      product: app.product,
      requireVehicleIdentity:
        VEHICLE_IDENTITY_REQUIRED_FOR_RESERVE && fromStatus === ApplicationStatus.draft,
      guarantorConsentCompleted: await this.intake.guarantorConsentCompleted(id),
      identityPolicy: {
        ekycRequired: this.appConfig.kycEkycRequired,
        allowStaffManualIdentity: this.appConfig.kycAllowStaffManualIdentity,
        allowCustomerManualIdentity: this.appConfig.kycAllowCustomerManualIdentity,
      },
      now: new Date(),
    });

    const assessed = assessApplicationCredit({
      customerSnapshot: app.customerSnapshot,
      pricingSnapshot: app.pricingSnapshot,
      product: app.product,
    });
    const nextStatus = submittedStatusForPartner(app.financePartner?.crmAdapter);
    const lenderId = app.financePartnerId ?? (await this.intake.defaultLenderId());
    const autoTagged = !app.financePartnerId && !!lenderId;
    const branchId = app.branchId ?? (await this.resolveBranchId(actor, app.agentUserId));
    const updated = await this.prisma.$transaction(async (tx) => {
      await transitionApplication(tx, id, fromStatus, {
        status: nextStatus,
        submittedAt: app.submittedAt ?? new Date(),
        ...creditAssessmentData(assessed),
      });
      if (autoTagged || (branchId && branchId !== app.branchId)) {
        await tx.application.update({
          where: { id },
          data: {
            ...(autoTagged ? { financePartnerId: lenderId } : {}),
            ...(branchId && branchId !== app.branchId ? { branchId } : {}),
          },
        });
      }
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
    await this.activity.log({
      actorUserId: actor.id,
      entityType: 'application',
      entityId: id,
      action: 'credit_assessed',
      toValue: assessed.assessment.path,
      metadata: creditAssessedLogMetadata(assessed, 'submit'),
    });
    if (autoTagged) {
      await this.activity.log({
        actorUserId: actor.id,
        entityType: 'application',
        entityId: id,
        action: 'lender_tagged',
        toValue: lenderId,
        metadata: { source: 'default_lender' },
      });
    }
    if (shouldSyncStatusToCrm(nextStatus)) {
      void this.zoho.syncApplicationToZoho(id, actor.id);
    }
    return mapApplicationDto(updated, this.audienceFor(actor));
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
    // `partner_processing` MUST be here. An application financed by a partner
    // (Al Jazeera) enters that status the moment it is submitted — see
    // submittedStatusForPartner — and the Add Application wizard creates with
    // submit: true and only THEN uploads the documents. Without this status the
    // wizard's own uploads were rejected with 400 validation_failed, so a
    // partner-financed application could never carry a single document and the
    // partner's CRM lead was permanently empty.
    //
    // It is also the state in which the partner asks for more paperwork, which
    // is exactly when a dealer needs to attach it.
    if (
      !['draft', 'under_review', 'partner_processing', 'resubmission_required', 'contract_signing_required'].includes(
        app.status,
      )
    ) {
      throw new BadRequestException('validation_failed');
    }

    storage.assertKycFile(file);
    const stored = resolveStoredDocumentCategory(category);
    const key = await storage.uploadKyc(file, id, stored.category);
    const doc = await this.prisma.applicationDocument.create({
      data: {
        applicationId: id,
        category: stored.category as DocumentCategory,
        storagePath: key,
        mimeType: file.mimetype,
        // Stored so the partner CRM can attach the file under the name the
        // customer actually uploaded; without it the attachment is named from
        // the generated storage key and arrives as an opaque uuid.
        originalName: file.originalname,
        uploadedById: actor.id,
        kycDocumentType: stored.kycDocumentType ?? null,
      },
    });

    // The walk-in path creates the application and syncs it to the partner CRM
    // immediately, BEFORE the wizard uploads any documents — so the lead was
    // created with nothing attached and nothing ever re-sent it. Awaited rather
    // than fire-and-forget: parallel syncs would each read the attachment list
    // before the other had written, and upload the same file twice.
    if (shouldSyncStatusToCrm(app.status)) {
      await this.zoho.syncApplicationToZoho(id, actor.id);
    }

    return {
      id: doc.id,
      category: doc.category,
      mime_type: doc.mimeType,
      created_at: doc.createdAt,
    };
  }

  /**
   * Links to an existing customer account when the email is registered; otherwise
   * stores the application without creating an account (linked on self-sign-up).
   */
  private async resolveWalkInCustomer(
    _actor: User,
    input: { email: string; name: string; phone: string; qid: string; normalized: NormalizedCustomerSnapshot },
  ): Promise<{ userId: string | null; email: string }> {
    const existing = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (existing) {
      if (existing.role !== UserRole.customer) {
        throw new BadRequestException('email_not_customer');
      }
      await this.prisma.user.update({
        where: { id: existing.id },
        data: this.intake.userProfileData(existing, input.normalized),
      });
      return { userId: existing.id, email: input.email };
    }

    return { userId: null, email: input.email };
  }
}
