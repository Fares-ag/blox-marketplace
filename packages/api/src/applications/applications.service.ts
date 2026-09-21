import {
  BadRequestException,
  ConflictException,
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
import { IdentityService } from '../common/identity.service';
import { isUniqueConstraintError } from '../common/prisma-errors';
import { PaginationQueryDto, resolvePagination, toPaginatedResponse } from '../common/pagination.dto';
import { submittedStatusForPartner } from './partner-finance';
import { AnalyticsService } from '../analytics/analytics.service';
import { StorageService } from '../storage/storage.service';
import { ZohoCrmService } from '../integrations/zoho/zoho-crm.service';
import { shouldSyncStatusToCrm } from '../integrations/zoho/zoho-sync-policy';
import {
  buildApplicationPricingSnapshot,
  assertOfferMatchesProduct,
} from './application-pricing';
import {
  documentSlotsForApplication,
  resolveStoredDocumentCategory,
  type ApplicationDocCategory,
} from './application-documents';
import {
  assertApplicationCanView,
  BLOCKING_APPLICATION_STATUSES,
} from './application-access';
import { ApplicationsLifecycleService } from './applications-lifecycle.service';
import { ApplicationIntakeService } from './application-intake.service';
import { KycBridgeService } from '../kyc/kyc-bridge.service';
import type { KycVerificationSummaryDto } from '../kyc/kyc-verification-summary';
import {
  opsCompanyFilter,
} from './company-scope';
import { assertRowsUpdated, transitionApplication } from './guarded-transitions';
import {
  resolveCreditApproverId,
  separationOfDutiesEnabled,
  violatesSeparationOfDuties,
} from './separation-of-duties';
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
import { parseApplicationRef } from './application-reference';
import { decideDuplicateApplication, summarizeBlocking } from './application-dedup';
import { assertNoHardViolations, evaluateProductRules, withRuleFlags } from './application-rules';
import {
  normalizeCustomerSnapshot,
  readCustomerSnapshot,
  stripUndefinedDeep,
  type CustomerSnapshotInput,
} from './customer-snapshot';
import { assertSubmitGates, identityHoldActive, VEHICLE_IDENTITY_REQUIRED_FOR_RESERVE } from './submit-gates';
import { AppConfigService } from '../config/app-config.service';
import type { IdentityPolicy } from './application-documents';
import {
  assessApplicationCredit,
  creditAssessedLogMetadata,
  creditAssessmentData,
  toCreditAssessmentDto,
  type CreditAssessmentDto,
} from './credit-assessment';

function asJson(value: Record<string, unknown>): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

export type CreateApplicationInput = {
  productId: string;
  offerId: string;
  /**
   * Shared customer snapshot (see customer-snapshot.ts). Stored verbatim after
   * normalisation and read by zoho-lead.mapper and the contract generator, so
   * the partner CRM receives the same lead whichever way the application
   * arrived (web stepper, dealer wizard, mobile app).
   */
  customerSnapshot: CustomerSnapshotInput;
  pricingSnapshot: Record<string, unknown>;
  quoteToken?: string;
};

export type UpdateDraftInput = {
  customerSnapshot?: CustomerSnapshotInput;
  pricingSnapshot?: Record<string, unknown>;
  offerId?: string;
};

export type UnmaskField = 'qid' | 'phone';

@Injectable()
export class ApplicationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityService,
    private readonly analytics: AnalyticsService,
    private readonly storage: StorageService,
    private readonly lifecycle: ApplicationsLifecycleService,
    private readonly zoho: ZohoCrmService,
    private readonly kycBridge: KycBridgeService,
    private readonly intake: ApplicationIntakeService,
    private readonly identity: IdentityService,
    private readonly appConfig: AppConfigService,
  ) {}

  /** Identity-slot policy for submit gates and slot DTOs (BRD e-KYC BR-3). */
  private identityPolicy(): IdentityPolicy {
    return {
      ekycRequired: this.appConfig.kycEkycRequired,
      allowStaffManualIdentity: this.appConfig.kycAllowStaffManualIdentity,
      allowCustomerManualIdentity: this.appConfig.kycAllowCustomerManualIdentity,
    };
  }

  /** Truthful answer for `GET /applications/blocking` — mirrors the create-time dedup decision. */
  async hasBlocking(userId: string, productId?: string) {
    const existing = await this.loadDedupCandidates(userId);
    return toApplicationBlockingDto(summarizeBlocking(existing, productId));
  }

  private async loadDedupCandidates(userId: string) {
    return this.prisma.application.findMany({
      where: { customerUserId: userId, status: { in: BLOCKING_APPLICATION_STATUSES } },
      select: { id: true, status: true, productId: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(user: User, dto: CreateApplicationInput) {
    if (user.role !== UserRole.customer) throw new ForbiddenException('forbidden_role');

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

    // Residency/nationality are re-derived from the QID; a DOB that disagrees
    // with the QID birth year is refused (400 dob_qid_mismatch).
    const normalized = normalizeCustomerSnapshot(dto.customerSnapshot);

    // Duplicate handling: customers may always apply again, even with a pending
    // or active application. A draft for the same vehicle is resumed instead of
    // duplicated; anything else creates a fresh application.
    const decision = decideDuplicateApplication(await this.loadDedupCandidates(user.id), product.id);
    if (decision.kind === 'resume') {
      // When a quote token accompanies a resume, apply the negotiated price to the
      // existing draft and consume the quote — same atomicity guarantee as on create.
      if (dto.quoteToken) {
        const quote = await this.prisma.dealerQuote.findUnique({ where: { token: dto.quoteToken } });
        const quoteValid =
          quote &&
          quote.productId === product.id &&
          !quote.usedAt &&
          !quote.revokedAt &&
          quote.expiresAt.getTime() > Date.now() &&
          quote.customerEmail.toLowerCase() === user.email.toLowerCase();
        if (quoteValid) {
          const negotiatedListPrice = Number(quote!.negotiatedPrice);
          const existingApp = await this.prisma.application.findUnique({
            where: { id: decision.applicationId },
            select: { pricingSnapshot: true },
          });
          const currentPricing = (existingApp?.pricingSnapshot as Record<string, unknown>) ?? {};
          const quotedPricing = buildApplicationPricingSnapshot({
            listPrice: negotiatedListPrice,
            offer,
            pricingSnapshot: { ...currentPricing, ...(dto.pricingSnapshot ?? {}) },
          });
          const now = new Date();
          await this.prisma.$transaction(async (tx) => {
            await tx.application.update({
              where: { id: decision.applicationId },
              data: { pricingSnapshot: asJson(quotedPricing), leadSource: 'dealer_quote' },
            });
            await tx.dealerQuote.updateMany({
              where: {
                token: dto.quoteToken!,
                usedAt: null,
                revokedAt: null,
                expiresAt: { gt: now },
              },
              data: { usedAt: now, usedByApplicationId: decision.applicationId },
            });
          });
        }
      }
      return { id: decision.applicationId, resumed: true as const };
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
    const violations = evaluateProductRules({
      product,
      offer,
      pricingSnapshot,
      applicantType: normalized.snapshot.applicantType,
      residency: normalized.residency,
      enforcement: this.intake.ruleEnforcement(),
    });
    assertNoHardViolations(violations);
    const pricingWithFlags = withRuleFlags(pricingSnapshot, violations);

    const qidHash = this.intake.qidHash(normalized.snapshot.qid);
    const identity = await this.intake.evaluateIdentity({
      userId: user.id,
      qid: normalized.snapshot.qid,
      name: normalized.snapshot.full_name,
      birthYear: normalized.birthYear,
    });

    const app = await this.prisma.$transaction(async (tx) => {
      const created = await tx.application.create({
        data: {
          customerUserId: user.id,
          customerEmail: user.email,
          customerSnapshot: asJson(normalized.snapshot),
          productId: product.id,
          companyId: product.companyId,
          offerId: offer.id,
          financePartnerId: offer.financePartnerId,
          leadSource,
          pricingSnapshot: asJson(pricingWithFlags),
          status: ApplicationStatus.draft,
          qidHash,
          ...this.intake.holdColumns(identity),
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

      try {
        await tx.user.update({
          where: { id: user.id },
          data: this.intake.userProfileData(user, normalized, { omitQid: !!identity }),
        });
      } catch (err) {
        if (isUniqueConstraintError(err)) throw new ConflictException('user_already_exists');
        throw err;
      }

      return created;
    });

    await this.activity.log({
      actorUserId: user.id,
      entityType: 'application',
      entityId: app.id,
      action: 'application_created',
      toValue: 'draft',
    });
    if (identity) {
      await this.intake.recordHold({
        applicationId: app.id,
        companyId: app.companyId,
        actorUserId: user.id,
        decision: identity,
      });
    }

    this.analytics.track('application_started', {
      application_id: app.id,
      product_id: app.productId,
      company_id: app.companyId,
    });

    return toApplicationDto(app);
  }

  /** Save-and-resume for the stepper: re-validates exactly like create. */
  async updateDraft(user: User, id: string, body: UpdateDraftInput) {
    const app = await this.prisma.application.findUnique({
      where: { id },
      include: { product: true, offer: true },
    });
    if (!app || app.customerUserId !== user.id) throw new ForbiddenException('forbidden_role');
    if (app.status !== ApplicationStatus.draft) {
      throw new BadRequestException('invalid_status_transition');
    }

    let offer = app.offer;
    const offerChanged = !!body.offerId && body.offerId !== app.offerId;
    if (offerChanged) {
      const resolvedOfferId = app.product.defaultOfferId ?? body.offerId!;
      assertOfferMatchesProduct(body.offerId, resolvedOfferId);
      const next = await this.prisma.offer.findFirst({
        where: { id: resolvedOfferId, status: 'active' },
      });
      if (!next) throw new BadRequestException('validation_failed');
      offer = next;
    }

    const currentSnapshot = (app.customerSnapshot as Record<string, unknown>) ?? {};
    // A partial save must not erase what the customer already entered.
    // class-transformer defines every property declared on the DTO, so fields
    // the client omitted arrive as `undefined`; spreading those straight over
    // the stored snapshot blanked city, address, employment, date of birth and
    // the rest on every step-by-step save.
    const normalized = normalizeCustomerSnapshot({
      ...currentSnapshot,
      ...stripUndefinedDeep(body.customerSnapshot ?? {}),
    });

    const currentPricing = (app.pricingSnapshot as Record<string, unknown>) ?? {};
    // The stored list price is kept: it may be a dealer-quote negotiated price.
    const listPrice = Number(currentPricing.list_price ?? app.product.price);
    const pricingSnapshot = buildApplicationPricingSnapshot({
      listPrice,
      offer,
      pricingSnapshot: { ...currentPricing, ...(body.pricingSnapshot ?? {}) },
    });
    if (currentPricing.hide_interest !== undefined) {
      pricingSnapshot.hide_interest = currentPricing.hide_interest;
    }
    const violations = evaluateProductRules({
      product: app.product,
      offer,
      pricingSnapshot,
      applicantType: normalized.snapshot.applicantType,
      residency: normalized.residency,
      enforcement: this.intake.ruleEnforcement(),
    });
    assertNoHardViolations(violations);
    const pricingWithFlags = withRuleFlags(pricingSnapshot, violations);

    const qidHash = this.intake.qidHash(normalized.snapshot.qid);
    const qidChanged = qidHash !== app.qidHash;
    const holdActive = identityHoldActive(app);
    // A hold that credit already cleared is only re-evaluated when the QID changes.
    const identity =
      !holdActive && (qidChanged || !app.identityHoldAt)
        ? await this.intake.evaluateIdentity({
            userId: user.id,
            qid: normalized.snapshot.qid,
            name: normalized.snapshot.full_name,
            birthYear: normalized.birthYear,
          })
        : null;

    await this.prisma.$transaction(async (tx) => {
      await tx.application.update({
        where: { id },
        data: {
          customerSnapshot: asJson(normalized.snapshot),
          pricingSnapshot: asJson(pricingWithFlags),
          qidHash,
          ...(offerChanged
            ? {
                offer: { connect: { id: offer.id } },
                financePartner: offer.financePartnerId
                  ? { connect: { id: offer.financePartnerId } }
                  : { disconnect: true },
              }
            : {}),
          ...this.intake.holdColumns(identity),
        },
      });
      try {
        await tx.user.update({
          where: { id: user.id },
          data: this.intake.userProfileData(user, normalized, { omitQid: !!identity }),
        });
      } catch (err) {
        if (isUniqueConstraintError(err)) throw new ConflictException('user_already_exists');
        throw err;
      }
    });

    await this.activity.log({
      actorUserId: user.id,
      entityType: 'application',
      entityId: id,
      action: 'application_updated',
      metadata: { draft: true, offer_changed: offerChanged },
    });
    if (identity) {
      await this.intake.recordHold({
        applicationId: id,
        companyId: app.companyId,
        actorUserId: user.id,
        decision: identity,
      });
    }

    return this.getOne(user, id);
  }

  /** `{ slots, uploaded, missing }` for the owner (customer route) and for staff (ops route). */
  async documentSlots(user: User, id: string) {
    const app = await this.prisma.application.findUnique({
      where: { id },
      select: { id: true, customerUserId: true, companyId: true, customerSnapshot: true, kycCaseId: true },
    });
    if (!app) throw new NotFoundException();
    await assertApplicationCanView(this.prisma, user, app);
    const documents = await this.loadDocumentsForSubmit(id, app.kycCaseId);
    return documentSlotsForApplication(app.customerSnapshot, documents, new Date(), this.identityPolicy());
  }

  /** Live credit assessment (`GET /ops/applications/:id/credit-assessment`) with the approver block for the caller. */
  async creditAssessment(user: User, id: string): Promise<CreditAssessmentDto> {
    const allowed: UserRole[] = [
      UserRole.credit_officer,
      UserRole.finance_officer,
      UserRole.admin,
      UserRole.super_admin,
      UserRole.group_admin,
    ];
    if (!allowed.includes(user.role)) throw new ForbiddenException('forbidden_role');
    const app = await this.prisma.application.findUnique({
      where: { id },
      select: {
        id: true,
        customerUserId: true,
        companyId: true,
        customerSnapshot: true,
        pricingSnapshot: true,
        product: { select: { attributes: true, bodyType: true } },
      },
    });
    if (!app) throw new NotFoundException();
    await assertApplicationCanView(this.prisma, user, app);
    return toCreditAssessmentDto(assessApplicationCredit(app), user.role);
  }

  private async loadDocumentsForSubmit(applicationId: string, kycCaseId: string | null) {
    if (kycCaseId) {
      try {
        await this.kycBridge.syncDocumentsForApplication(applicationId);
      } catch {
        // Non-fatal — validate whatever was synced via webhook or prior uploads.
      }
    }
    const rows = await this.prisma.applicationDocument.findMany({
      where: { applicationId },
      orderBy: { createdAt: 'asc' },
      include: { uploadedBy: { select: { role: true } } },
    });
    return rows.map(({ uploadedBy, ...doc }) => ({ ...doc, uploadedByRole: uploadedBy?.role ?? null }));
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
    const documents = await this.loadDocumentsForSubmit(id, app.kycCaseId);
    // consents_required → documents_missing → documents_stale →
    // guarantor_consent_required → vehicle_identity_incomplete (only when
    // reserving) → vehicle_age_rule. An identity hold is non-blocking here.
    assertSubmitGates({
      application: app,
      documents,
      product: app.product,
      requireVehicleIdentity:
        VEHICLE_IDENTITY_REQUIRED_FOR_RESERVE && app.status === ApplicationStatus.draft,
      guarantorConsentCompleted: await this.intake.guarantorConsentCompleted(id),
      identityPolicy: this.identityPolicy(),
      now: new Date(),
    });

    if (app.product.listingStatus !== ListingStatus.published && app.status === 'draft') {
      throw new BadRequestException('listing_not_available');
    }

    const fromStatus = app.status;
    // Credit assessment captured at submission (DBR, exception tier, approval
    // authority) — recomputed live at decision time, stored here for the
    // partner view and the audit trail.
    const assessed = assessApplicationCredit({
      customerSnapshot: app.customerSnapshot,
      pricingSnapshot: app.pricingSnapshot,
      product: app.product,
    });
    // Routing follows the offer's own partner (or a lender ops tagged before
    // submit); the default lender only fills the lender-of-record gap.
    const nextStatus = submittedStatusForPartner(app.financePartner?.crmAdapter);
    const lenderId = app.financePartnerId ?? (await this.intake.defaultLenderId());
    const autoTagged = !app.financePartnerId && !!lenderId;
    const updated = await this.prisma.$transaction(async (tx) => {
      await transitionApplication(tx, id, fromStatus, {
        status: nextStatus,
        submittedAt: app.submittedAt ?? new Date(),
        ...creditAssessmentData(assessed),
      });
      if (autoTagged) {
        await tx.application.update({ where: { id }, data: { financePartnerId: lenderId } });
      }

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
    await this.activity.log({
      actorUserId: user.id,
      entityType: 'application',
      entityId: id,
      action: 'credit_assessed',
      toValue: assessed.assessment.path,
      metadata: creditAssessedLogMetadata(assessed, 'submit'),
    });
    if (autoTagged) {
      await this.activity.log({
        actorUserId: user.id,
        entityType: 'application',
        entityId: id,
        action: 'lender_tagged',
        toValue: lenderId,
        metadata: { source: 'default_lender' },
      });
    }

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
        company: {
          select: { id: true, name: true, allowDirectActivate: true, separationOfDutiesEnabled: true },
        },
        customer: { select: { name: true, email: true, phone: true } },
        offer: true,
        financePartner: { select: { id: true, name: true, code: true, crmAdapter: true } },
        branch: { select: { id: true, name: true, code: true } },
        takafulPolicies: { orderBy: { createdAt: 'desc' } },
        agent: { select: { id: true, name: true, email: true } },
        paymentSchedules: { orderBy: { sequence: 'asc' } },
        paymentTransactions: { orderBy: { createdAt: 'desc' }, take: 50 },
        complianceChecks: { orderBy: { createdAt: 'desc' }, take: 5 },
        ownershipRegister: { select: { totalUnits: true, customerUnits: true, bloxUnits: true } },
      },
    });
    if (!app) throw new NotFoundException();
    await assertApplicationCanView(this.prisma, user, app);
    const audience = this.audienceForUser(user, app);
    const identityHoldClearedByName = await this.identityHoldClearedByName(app.identityHoldClearedById);

    let kycVerification: KycVerificationSummaryDto | null = null;
    if ((audience === 'ops' || audience === 'dealer') && app.kycCaseId) {
      try {
        await this.kycBridge.syncDocumentsForApplication(id);
        app.documents = await this.prisma.applicationDocument.findMany({
          where: { applicationId: id },
          orderBy: { createdAt: 'asc' },
        });
        kycVerification = await this.kycBridge.getVerificationSummary(
          id,
          app.kycCaseId,
          app.kycStatus,
        );
      } catch {
        // Non-fatal: show whatever was synced via webhooks.
      }
    }

    const dto = mapApplicationDto({ ...app, identityHoldClearedByName }, audience) as Record<string, unknown>;

    if (audience === 'ops' || audience === 'dealer') {
      if (kycVerification) dto.kyc_verification = kycVerification;
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
      // Let the workspace disable mark-paid up front instead of failing on click
      // with `separation_of_duties` (the approver may not record payments).
      const sodEnabled = separationOfDutiesEnabled({
        companyFlag: app.company?.separationOfDutiesEnabled,
      });
      const creditApproverId = sodEnabled ? await resolveCreditApproverId(this.prisma, id) : null;
      dto.separation_of_duties_blocked = violatesSeparationOfDuties(user.id, creditApproverId);

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

    if (audience === 'customer') {
      const settlement = await this.prisma.applicationSettlement.findFirst({
        where: { applicationId: id },
        orderBy: { requestedAt: 'desc' },
      });
      if (settlement) {
        dto.settlement_request = {
          id: settlement.id,
          status: settlement.status,
          settlement_amount: Number(settlement.settlementAmount),
          requested_at: settlement.requestedAt.toISOString(),
          decided_at: settlement.decidedAt?.toISOString() ?? null,
        };
      }
    }

    return dto;
  }

  /** Who cleared the identity hold — the column has no relation, so resolve the name here. */
  private async identityHoldClearedByName(userId: string | null | undefined): Promise<string | null> {
    if (!userId) return null;
    const clearedBy = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true },
    });
    return clearedBy?.name?.trim() || clearedBy?.email || null;
  }

  async opsQueue(
    user: User,
    query: PaginationQueryDto & {
      status?: ApplicationStatus;
      statusIn?: string;
      q?: string;
      companyId?: string;
      /** Lender-of-record filter (admin applications list). */
      financePartnerId?: string;
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
    const financePartnerId = query.financePartnerId?.trim();
    const where: Prisma.ApplicationWhereInput = {
      ...(statusIn ? { status: { in: statusIn } } : {}),
      ...(scopedCompanyIds ? { companyId: { in: scopedCompanyIds } } : {}),
      ...(financePartnerId ? { financePartnerId } : {}),
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
              ...(parseApplicationRef(search) != null ? [{ referenceSeq: parseApplicationRef(search)! }] : []),
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
          financePartner: { select: { id: true, name: true, code: true, crmAdapter: true } },
          branch: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
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
              ...(parseApplicationRef(search) != null ? [{ referenceSeq: parseApplicationRef(search)! }] : []),
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
          financePartner: { select: { id: true, name: true } },
          branch: { select: { id: true, name: true } },
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
      // Same normalisation as intake so residency/nationality stay QID-derived
      // and the blind index follows a corrected QID.
      const normalized = normalizeCustomerSnapshot(
        {
          ...((app.customerSnapshot as Record<string, unknown>) ?? {}),
          ...body.customerSnapshot,
        },
        { requireContact: false },
      );
      data.customerSnapshot = asJson(normalized.snapshot);
      data.qidHash = this.intake.qidHash(normalized.snapshot.qid);
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

  /** Credit/admin release of the MISMATCHED_IDENTITY hold (audited). */
  async clearIdentityHold(user: User, id: string, note?: string) {
    const allowed: UserRole[] = [UserRole.credit_officer, UserRole.admin, UserRole.super_admin];
    if (!allowed.includes(user.role)) throw new ForbiddenException('forbidden_role');

    const app = await this.prisma.application.findUnique({ where: { id } });
    if (!app) throw new NotFoundException();
    await assertApplicationCanView(this.prisma, user, app);
    if (!identityHoldActive(app)) throw new BadRequestException('no_identity_hold');

    const now = new Date();
    await this.prisma.application.update({
      where: { id },
      data: { identityHoldClearedAt: now, identityHoldClearedById: user.id },
    });
    await this.activity.log({
      actorUserId: user.id,
      entityType: 'application',
      entityId: id,
      action: 'identity_hold_cleared',
      fromValue: app.identityHoldReason ?? null,
      metadata: { note: note?.trim() || null },
    });
    return this.getOne(user, id);
  }

  /** Audited reveal of a masked identity field (LOS FSD §11.1). */
  async unmask(user: User, id: string, field: UnmaskField, reason: string) {
    if (user.role === UserRole.customer) throw new ForbiddenException('forbidden_role');
    const app = await this.prisma.application.findUnique({
      where: { id },
      include: { customer: { select: { qid: true, qidEnc: true, phone: true } } },
    });
    if (!app) throw new NotFoundException();
    // Dealer agents are limited to their own company; ops to their scope.
    await assertApplicationCanView(this.prisma, user, app);

    const snapshot = readCustomerSnapshot(app.customerSnapshot);
    const value =
      field === 'qid'
        ? snapshot.qid || this.identity.readQid(app.customer) || null
        : snapshot.phone || app.customer?.phone || null;

    await this.activity.log({
      actorUserId: user.id,
      entityType: 'application',
      entityId: id,
      action: 'pii_unmask',
      toValue: field,
      metadata: { field, reason: reason.trim() },
    });
    return { field, value };
  }

  /** Lender of record — finance/admin only; the routing status is untouched. */
  async tagLender(
    user: User,
    id: string,
    body: { financePartnerId: string; financePartnerBranchId?: string | null },
  ) {
    const allowed: UserRole[] = [UserRole.admin, UserRole.super_admin, UserRole.finance_officer];
    if (!allowed.includes(user.role)) throw new ForbiddenException('forbidden_role');

    const app = await this.prisma.application.findUnique({ where: { id } });
    if (!app) throw new NotFoundException();
    await assertApplicationCanView(this.prisma, user, app);

    const partner = await this.prisma.financePartner.findUnique({
      where: { id: body.financePartnerId },
      select: { id: true, name: true, active: true },
    });
    if (!partner || !partner.active) throw new BadRequestException('finance_partner_not_found');

    let branchId: string | null = null;
    if (body.financePartnerBranchId) {
      const branch = await this.prisma.financePartnerBranch.findFirst({
        where: { id: body.financePartnerBranchId, partnerId: partner.id },
        select: { id: true },
      });
      if (!branch) throw new BadRequestException('finance_partner_branch_not_found');
      branchId = branch.id;
    }

    await this.prisma.application.update({
      where: { id },
      data: { financePartnerId: partner.id, financePartnerBranchId: branchId },
    });
    await this.activity.log({
      actorUserId: user.id,
      entityType: 'application',
      entityId: id,
      action: 'lender_tagged',
      fromValue: app.financePartnerId ?? null,
      toValue: partner.id,
      metadata: { finance_partner_name: partner.name, finance_partner_branch_id: branchId },
    });
    return this.getOne(user, id);
  }

  private parseStatusIn(
    status: ApplicationStatus | undefined,
    statusIn: string | undefined,
    _role: UserRole,
  ): ApplicationStatus[] | undefined {
    if (status) return [status];
    if (statusIn?.trim()) {
      return statusIn
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean) as ApplicationStatus[];
    }
    return undefined;
  }

  async transition(
    user: User,
    id: string,
    toStatus: ApplicationStatus,
    reason?: string,
    overrideReason?: string,
  ) {
    return this.lifecycle.opsTransition(user, id, toStatus, reason, overrideReason);
  }

  async resubmit(user: User, id: string) {
    const app = await this.prisma.application.findUnique({
      where: { id },
      include: { documents: true, product: true, financePartner: true },
    });
    if (!app || app.customerUserId !== user.id) throw new ForbiddenException('forbidden_role');
    if (app.status !== 'resubmission_required') {
      throw new BadRequestException('invalid_status_transition');
    }
    const documents = await this.loadDocumentsForSubmit(id, app.kycCaseId);
    assertSubmitGates({
      application: app,
      documents,
      product: app.product,
      requireVehicleIdentity: false,
      guarantorConsentCompleted: await this.intake.guarantorConsentCompleted(id),
      identityPolicy: this.identityPolicy(),
      now: new Date(),
    });

    // Re-assessed: the snapshot or documents may have changed since the first submit.
    const assessed = assessApplicationCredit({
      customerSnapshot: app.customerSnapshot,
      pricingSnapshot: app.pricingSnapshot,
      product: app.product,
    });
    const nextStatus = submittedStatusForPartner(app.financePartner?.crmAdapter);
    const updated = await this.prisma.$transaction(async (tx) => {
      await transitionApplication(tx, id, ApplicationStatus.resubmission_required, {
        status: nextStatus,
        ...creditAssessmentData(assessed),
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
    await this.activity.log({
      actorUserId: user.id,
      entityType: 'application',
      entityId: id,
      action: 'credit_assessed',
      toValue: assessed.assessment.path,
      metadata: creditAssessedLogMetadata(assessed, 'submit'),
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
    const stored = resolveStoredDocumentCategory(category);
    const key = await this.storage.uploadKyc(file, id, stored.category);
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
        uploadedById: user.id,
        kycDocumentType: stored.kycDocumentType ?? null,
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
    await this.syncToCrmIfNeeded(id, app.status, user.id, { updateLeadFields: false });

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

    if (doc.storagePath.startsWith('kyc://')) {
      const kycFile = await this.kycBridge.readApplicationDocumentBytes(appId, doc);
      return kycFile;
    }

    const file = await this.storage.readKyc(doc.storagePath);
    const ext = path.extname(doc.storagePath) || '.pdf';
    const filename = doc.originalName?.trim() || `${doc.category}${ext}`;
    return { ...file, filename };
  }

  /**
   * Staff who should hear about a new submission: credit/finance officers who
   * can see the company, the dealer's agents, and admins (see
   * ApplicationIntakeService.notifyOps for the scoping rules).
   */
  private async notifyOpsOnSubmit(companyId: string, appId: string) {
    await this.intake.notifyOps(
      companyId,
      [
        UserRole.credit_officer,
        UserRole.finance_officer,
        UserRole.dealer_agent,
        UserRole.admin,
        UserRole.super_admin,
      ],
      (role) => (role === UserRole.dealer_agent ? 'New lead on your stock' : 'New financing application'),
      'A customer submitted a financing application.',
      `/applications/${appId}`,
    );
  }

  /** Mirrors dealer/staff CRM sync — awaited, not fire-and-forget. */
  private async syncToCrmIfNeeded(
    applicationId: string,
    status: ApplicationStatus,
    actorUserId?: string,
    options?: { updateLeadFields?: boolean },
  ): Promise<void> {
    if (!shouldSyncStatusToCrm(status)) return;
    await this.zoho.syncApplicationToZoho(applicationId, actorUserId, options);
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
    app: { customerUserId: string | null; companyId: string },
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
