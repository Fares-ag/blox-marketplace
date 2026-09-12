import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApplicationStatus,
  ListingStatus,
  PaymentEventType,
  Prisma,
  User,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityService } from '../common/activity.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { ComplianceService } from '../compliance/compliance.service';
import { StorageService } from '../storage/storage.service';
import {
  ACTIVATE_FROM_STATUSES,
  ADMIN_ACTIVATE_FROM_STATUSES,
  assertOpsTransitionAllowed,
  opsTransitionRequiresReason,
  roleToActor,
} from './application-transitions';
import {
  buildContractAmortizationSchedule,
  buildContractPdf,
  resolveFinancedTotal,
  verifySignedContractReferencesOriginal,
} from './contract-pdf';
import {
  assertDownPaymentRecordedForDirectActivation,
  assertDownPaymentSatisfied,
  requiredDownPaymentAmount,
  sumDownPaymentRecorded,
} from './down-payment';
import { buildScheduleDrafts } from './payment-schedules';
import { syncPaymentSchedulesFromInstallmentPlan } from './installment-plan-sync';
import type { InstallmentPlan } from '@drivemarket/shared/installment-plan';
import { resolveLenderOfRecord } from '../finance-partners/lender-of-record';
import { assertCompanyScope } from './company-scope';
import { assertApplicationCanView, BLOCKING_APPLICATION_STATUSES } from './application-access';
import { transitionApplication } from './guarded-transitions';
import { toApplicationDto, toOpsApplicationDto } from './application-response.dto';
import {
  assessApplicationCredit,
  creditAssessedLogMetadata,
  creditAssessmentData,
  type AssessedApplicationCredit,
} from './credit-assessment';
import { assertApprovalAuthorized, type ApprovalDecisionOutcome } from './credit-decision';
import { customerNotificationBody } from './customer-notifications';
import { MusharakahService } from '../musharakah/musharakah.service';
import { AppConfigService } from '../config/app-config.service';
import { ContractDocumentsService } from './documents/contract-documents.service';
import { KycPlatformClient } from '../kyc/kyc-platform.client';
import type { ContractFieldContext } from './documents/field-maps';

const OPS_ROLES: UserRole[] = [UserRole.credit_officer, UserRole.admin, UserRole.super_admin];

/** What an approval out of review carries once the matrix let the officer through. */
type CreditApproval = {
  assessed: AssessedApplicationCredit;
  decision: Extract<ApprovalDecisionOutcome, { ok: true }>;
  columns: ReturnType<typeof creditAssessmentData>;
};

type CreditApprovalSource = {
  customerSnapshot: unknown;
  pricingSnapshot: unknown;
  product?: { attributes?: unknown; bodyType?: string | null } | null;
};

/**
 * Review decisions (generate contract, contract review, reject, resubmit,
 * reopen, approve for finance). Finance has credit parity here — blox-vercel
 * FINANCE_PORTAL.md — but is still refused by `activate()`.
 */
const DECISION_ROLES: UserRole[] = [
  UserRole.credit_officer,
  UserRole.finance_officer,
  UserRole.admin,
  UserRole.super_admin,
];

const DOWN_PAYMENT_ROLES: UserRole[] = [
  UserRole.credit_officer,
  UserRole.finance_officer,
  UserRole.admin,
  UserRole.super_admin,
];

function asJson(value: Record<string, unknown>): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function expectedContractContentSha256(contractData: unknown): string | null {
  if (!contractData || typeof contractData !== 'object' || Array.isArray(contractData)) {
    return null;
  }
  const hash = (contractData as Record<string, unknown>).generatedContentSha256;
  return typeof hash === 'string' && /^[a-f0-9]{64}$/.test(hash) ? hash : null;
}

@Injectable()
export class ApplicationsLifecycleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityService,
    private readonly analytics: AnalyticsService,
    private readonly storage: StorageService,
    private readonly compliance: ComplianceService,
    private readonly config: ConfigService,
    private readonly musharakah: MusharakahService,
    private readonly appConfig: AppConfigService,
    private readonly contractDocuments?: ContractDocumentsService,
    private readonly kyc?: KycPlatformClient,
  ) {}

  private assertOps(user: User) {
    if (!OPS_ROLES.includes(user.role)) {
      throw new ForbiddenException('forbidden_role');
    }
  }

  private assertDecisionRole(user: User) {
    if (!DECISION_ROLES.includes(user.role)) {
      throw new ForbiddenException('forbidden_role');
    }
  }

  private assertDownPaymentRole(user: User) {
    if (!DOWN_PAYMENT_ROLES.includes(user.role)) {
      throw new ForbiddenException('forbidden_role');
    }
  }

  /**
   * Approval matrix gate on every approval out of review (LOS FSD §1.5
   * authority, EXC001 DBR tiers, §9.2 hard cap). Recomputed live from the
   * stored snapshots so a snapshot corrected during review is judged as it
   * stands; throws 403 `approval_authority_required` /
   * `dbr_exception_escalation_required` or 409 `dbr_above_hard_cap`.
   */
  private evaluateCreditApproval(
    user: User,
    app: CreditApprovalSource,
    overrideReason?: string | null,
  ): CreditApproval {
    const assessed = assessApplicationCredit(app);
    const decision = assertApprovalAuthorized({
      role: user.role,
      assessment: assessed.assessment,
      overrideReason,
    });
    return { assessed, decision, columns: creditAssessmentData(assessed) };
  }

  private async logCreditDecision(
    user: User,
    applicationId: string,
    credit: CreditApproval,
    overrideReason?: string | null,
  ) {
    await this.activity.log({
      actorUserId: user.id,
      entityType: 'application',
      entityId: applicationId,
      action: 'credit_assessed',
      toValue: credit.assessed.assessment.path,
      metadata: {
        ...creditAssessedLogMetadata(credit.assessed, 'approval'),
        approver_role: user.role,
        tier: credit.decision.tier,
      },
    });
    if (credit.decision.overridden) {
      await this.activity.log({
        actorUserId: user.id,
        entityType: 'application',
        entityId: applicationId,
        action: 'credit_override',
        fromValue: 'dbr_above_hard_cap',
        toValue: 'approved',
        metadata: {
          reason: overrideReason?.trim() ?? null,
          authority: credit.decision.authority,
          tier: credit.decision.tier,
          approver_role: user.role,
        },
      });
    }
  }

  async approveWithContract(user: User, id: string, opts?: { overrideReason?: string | null }) {
    this.assertDecisionRole(user);
    const app = await this.prisma.application.findUnique({
      where: { id },
      include: {
        product: {
          select: {
            make: true,
            model: true,
            modelYear: true,
            trim: true,
            color: true,
            vin: true,
            chassisNumber: true,
            engineNumber: true,
            condition: true,
            attributes: true,
            bodyType: true,
          },
        },
        company: { select: { name: true } },
        financePartner: { select: { name: true } },
        offer: { include: { financePartner: { select: { name: true } } } },
      },
    });
    if (!app) throw new NotFoundException();
    await assertCompanyScope(this.prisma, user, app.companyId);
    if (app.status !== 'under_review') {
      throw new BadRequestException('invalid_status_transition');
    }
    await this.compliance.assertPassedForApproval(id);
    const credit = this.evaluateCreditApproval(user, app, opts?.overrideReason);

    const snap = app.customerSnapshot as Record<string, unknown>;
    const pricing = app.pricingSnapshot as Record<string, unknown>;
    const approvedAt = new Date();
    // Lender of record: tagged partner → offer partner → default lender
    // (Finance Provider Master) → CONTRACT_LENDER_NAME → "Blox Finance".
    const defaultLender =
      app.financePartner || app.offer?.financePartner
        ? null
        : await this.prisma.financePartner.findFirst({
            where: { isDefaultLender: true, active: true },
            select: { name: true },
          });
    const lenderName = resolveLenderOfRecord({
      taggedPartnerName: app.financePartner?.name,
      offerPartnerName: app.offer?.financePartner?.name,
      defaultLenderName: defaultLender?.name,
      configuredName: this.config.get<string>('CONTRACT_LENDER_NAME'),
    });
    const schedule = buildContractAmortizationSchedule(pricing, approvedAt);
    const contractData = {
      applicationId: app.id,
      customer: snap,
      pricing,
      vehicle: {
        make: app.product.make,
        model: app.product.model,
        year: app.product.modelYear,
      },
      dealer: app.company.name,
      approvedAt: approvedAt.toISOString(),
      lenderName,
      schedule,
    };

    const { buffer: pdf, contentSha256 } = await buildContractPdf({
      applicationId: app.id,
      approvedAt: approvedAt.toISOString(),
      customerName: String(snap.full_name ?? ''),
      customerEmail: app.customerEmail,
      customerPhone: String(snap.phone ?? ''),
      customerQid: String(snap.qid ?? ''),
      vehicleLabel: `${app.product.make} ${app.product.model} ${app.product.modelYear ?? ''}`.trim(),
      dealerName: app.company.name,
      listPrice: Number(pricing.list_price ?? 0),
      downPayment: Number(pricing.down_payment ?? 0),
      downPaymentPct: Number(pricing.down_payment_pct ?? 0),
      monthly: Number(pricing.monthly ?? 0),
      tenor: Number(pricing.tenor ?? pricing.tenure ?? 0),
      annualRate: Number(pricing.rate ?? 0),
      financedTotal: resolveFinancedTotal(pricing),
      lenderName,
      schedule,
    });

    const contractPdfPath = await this.storage.storeContractPdf(app.id, pdf);

    let kycCase = null;
    if (app.kycCaseId && this.kyc?.configured()) {
      try {
        kycCase = await this.kyc.getCaseDetail(app.kycCaseId);
      } catch {
        kycCase = null;
      }
    }
    const fieldCtx: ContractFieldContext = {
      applicationId: app.id,
      approvedAt,
      lenderName,
      lenderAddress:
        this.config.get<string>('CONTRACT_LENDER_ADDRESS')?.trim() || 'Qatar Financial Centre, Doha, Qatar',
      signatoryName: this.config.get<string>('CONTRACT_SIGNATORY_NAME')?.trim() || lenderName,
      signatoryTitle: this.config.get<string>('CONTRACT_SIGNATORY_TITLE')?.trim() || 'Authorised signatory',
      customerEmail: app.customerEmail,
      customerSnapshot: snap,
      pricing,
      vehicle: {
        make: app.product.make,
        model: app.product.model,
        year: app.product.modelYear,
        trim: app.product.trim,
        color: app.product.color,
        vin: app.product.vin,
        chassisNumber: app.product.chassisNumber,
        engineNumber: app.product.engineNumber,
        condition: app.product.condition,
        bodyType: app.product.bodyType,
      },
      dealerName: app.company.name,
      listPrice: Number(pricing.list_price ?? 0),
      downPayment: Number(pricing.down_payment ?? 0),
      downPaymentPct: Number(pricing.down_payment_pct ?? 0),
      monthly: Number(pricing.monthly ?? 0),
      tenor: Number(pricing.tenor ?? pricing.tenure ?? 0),
      annualRate: Number(pricing.rate ?? 0),
      financedTotal: resolveFinancedTotal(pricing),
      schedule,
      credit: credit.assessed,
      approverName: user.name ?? user.email,
      approverRole: user.role,
      overrideReason: opts?.overrideReason,
      kyc: kycCase,
      kycStatus: app.kycStatus,
    };
    let generatedDocs: Array<{ id: string; documentType: string; audience: 'customer' | 'ops'; label: string }> = [];
    try {
      generatedDocs = (await this.contractDocuments?.generateDocumentsForApproval({
        applicationId: app.id,
        financingType:
          (app.offer as { financingType?: 'ijarah' | 'diminishing_musharakah' } | null)?.financingType ??
          'diminishing_musharakah',
        ctx: fieldCtx,
      })) ?? [];
    } catch {
      generatedDocs = [];
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await this.musharakah.maybeOpenRegister(tx, id, pricing, user.id);
      return tx.application.update({
        where: { id },
        data: {
          status: 'contract_signing_required',
          contractGenerated: true,
          contractData: asJson({
            ...contractData,
            generatedContentSha256: contentSha256,
            musharakahUnits: 100,
          }),
          contractPdfPath,
          ...credit.columns,
        },
      });
    });

    await this.activity.log({
      actorUserId: user.id,
      entityType: 'application',
      entityId: id,
      action: 'status_transition',
      fromValue: 'under_review',
      toValue: 'contract_signing_required',
    });
    await this.logCreditDecision(user, id, credit, opts?.overrideReason);
    if (app.customerUserId) {
      const customerDocs = generatedDocs.filter((doc) => doc.audience === 'customer');
      if (customerDocs.length === 0) {
        await this.activity.notify(
          app.customerUserId,
          'Contract ready to sign',
          'Download your financing contract, sign it, and upload the signed PDF.',
          `/app/applications/${id}`,
        );
      } else {
        for (const doc of customerDocs) {
          await this.activity.notify(
            app.customerUserId,
            `${doc.label} ready to sign`,
            `Download ${doc.label}, sign it, and upload the signed PDF. Each agreement is signed separately.`,
            `/app/applications/${id}`,
          );
        }
      }
    }

    this.analytics.track('approval', {
      application_id: id,
      from_status: 'under_review',
      to_status: 'contract_signing_required',
      actor_role: user.role,
    });

    return toOpsApplicationDto(updated);
  }

  async downloadContract(user: User, id: string) {
    const app = await this.prisma.application.findUnique({ where: { id } });
    if (!app) throw new NotFoundException();
    await assertApplicationCanView(this.prisma, user, app);
    if (!app.contractPdfPath) throw new NotFoundException();
    const file = await this.storage.readContract(app.contractPdfPath);
    return { ...file, filename: 'financing-contract.pdf' };
  }

  private async assertSignedContractMatchesGenerated(
    app: {
      id: string;
      contractData: unknown;
    },
    file: Express.Multer.File,
  ) {
    const expectedHash = expectedContractContentSha256(app.contractData);
    if (!expectedHash) {
      throw new BadRequestException('contract_not_fingerprinted');
    }
    if (!(await verifySignedContractReferencesOriginal(file.buffer, expectedHash, app.id))) {
      throw new BadRequestException('contract_hash_mismatch');
    }
  }

  async submitSignedContract(user: User, id: string, file: Express.Multer.File) {
    if (user.role !== UserRole.customer) throw new ForbiddenException('forbidden_role');
    const app = await this.prisma.application.findUnique({ where: { id } });
    if (!app || app.customerUserId !== user.id) throw new ForbiddenException('forbidden_role');
    if (app.status !== 'contract_signing_required') {
      throw new BadRequestException('invalid_status_transition');
    }

    this.storage.assertSignedContractFile(file);
    await this.assertSignedContractMatchesGenerated(app, file);
    const signedContractPath = await this.storage.uploadSignedContract(file, id);

    const remaining = (await this.contractDocuments?.remainingCustomerDocuments(id)) ?? 0;
    const data =
      remaining === 0
        ? { status: 'contracts_submitted' as const, signedContractPath }
        : { signedContractPath };
    const updated = await this.prisma.application.update({ where: { id }, data });

    if (remaining === 0) {
      await this.activity.log({
        actorUserId: user.id,
        entityType: 'application',
        entityId: id,
        action: 'status_transition',
        fromValue: 'contract_signing_required',
        toValue: 'contracts_submitted',
      });
    }

    return toApplicationDto(updated);
  }

  /**
   * P0-4 backstop: ops can file a physically-signed contract on the customer's
   * behalf (walk-in customers sign at the dealership). Audit-logged with the
   * uploading officer as actor.
   */
  async submitSignedContractOps(user: User, id: string, file: Express.Multer.File) {
    this.assertDecisionRole(user);
    const app = await this.prisma.application.findUnique({ where: { id } });
    if (!app) throw new NotFoundException();
    await assertCompanyScope(this.prisma, user, app.companyId);
    if (app.status !== 'contract_signing_required') {
      throw new BadRequestException('invalid_status_transition');
    }

    this.storage.assertSignedContractFile(file);
    await this.assertSignedContractMatchesGenerated(app, file);
    const signedContractPath = await this.storage.uploadSignedContract(file, id);

    const remaining = (await this.contractDocuments?.remainingCustomerDocuments(id)) ?? 0;
    const data =
      remaining === 0
        ? { status: 'contracts_submitted' as const, signedContractPath }
        : { signedContractPath };
    const updated = await this.prisma.application.update({ where: { id }, data });

    if (remaining === 0) {
      await this.activity.log({
        actorUserId: user.id,
        entityType: 'application',
        entityId: id,
        action: 'status_transition',
        fromValue: 'contract_signing_required',
        toValue: 'contracts_submitted',
        metadata: { uploadedBy: 'ops', onBehalfOfCustomer: app.customerUserId },
      });
      if (app.customerUserId) {
        await this.activity.notify(
          app.customerUserId,
          'Signed contract received',
          'Your signed contract was filed by our team and is now under review.',
          `/app/applications/${id}`,
        );
      }
    }

    return toOpsApplicationDto(updated);
  }

  async opsTransition(
    user: User,
    id: string,
    toStatus: ApplicationStatus,
    reason?: string,
    overrideReason?: string | null,
  ) {
    // The per-edge actor table in application-transitions.ts is the
    // authoritative gate; this only rejects roles that never transition.
    this.assertDecisionRole(user);
    const app = await this.prisma.application.findUnique({
      where: { id },
      include: {
        financePartner: { select: { crmAdapter: true } },
        product: { select: { attributes: true, bodyType: true } },
      },
    });
    if (!app) throw new NotFoundException();
    await assertCompanyScope(this.prisma, user, app.companyId);
    if (app.status === ApplicationStatus.partner_processing) {
      throw new BadRequestException('partner_application_readonly');
    }

    try {
      assertOpsTransitionAllowed(app.status, toStatus, user.role);
    } catch (e) {
      if (e instanceof Error && e.message === 'invalid_status_transition') {
        throw new BadRequestException('invalid_status_transition');
      }
      throw e;
    }

    if (opsTransitionRequiresReason(app.status, toStatus) && !reason?.trim()) {
      throw new BadRequestException('validation_failed');
    }

    // "Approve for Finance" straight from review is an approval: the same
    // compliance gate as approve-contract applies, then the approval matrix.
    let credit: CreditApproval | null = null;
    if (
      toStatus === ApplicationStatus.pending_finance_activation &&
      (app.status === ApplicationStatus.under_review || app.status === ApplicationStatus.draft)
    ) {
      await this.compliance.assertPassedForApproval(id);
      credit = this.evaluateCreditApproval(user, app, overrideReason);
    }

    if (
      app.status === ApplicationStatus.contract_under_review &&
      toStatus === ApplicationStatus.pending_finance_activation
    ) {
      await assertDownPaymentRecordedForDirectActivation(
        this.prisma,
        id,
        app.pricingSnapshot as Record<string, unknown>,
      );
    }

    const releasesListing =
      toStatus === 'rejected' ||
      (toStatus === 'submission_cancelled' && app.status !== ApplicationStatus.active);
    const reopensListing =
      toStatus === 'under_review' &&
      (app.status === ApplicationStatus.rejected || app.status === ApplicationStatus.submission_cancelled);

    const updated = await this.prisma.$transaction(async (tx) => {
      if (reopensListing) {
        // Reopening re-reserves the vehicle; refuse if it was sold meanwhile.
        const product = await tx.product.findUniqueOrThrow({
          where: { id: app.productId },
          select: { listingStatus: true },
        });
        if (product.listingStatus === ListingStatus.sold) {
          throw new ConflictException('vehicle_unavailable');
        }
        if (product.listingStatus === ListingStatus.published) {
          await tx.product.update({
            where: { id: app.productId },
            data: { listingStatus: ListingStatus.reserved },
          });
        }
      }

      const next = await tx.application.update({
        where: { id },
        data: {
          status: toStatus,
          statusReason: reason,
          rejectionReason: toStatus === 'rejected' ? reason : app.rejectionReason,
          // The customer-facing DTO only exposes resubmissionComment (statusReason
          // is ops-only), so the reason must land here for resubmission requests too.
          resubmissionComment:
            toStatus === 'contract_signing_required' || toStatus === 'resubmission_required'
              ? reason
              : app.resubmissionComment,
          ...(credit ? credit.columns : {}),
        },
      });

      if (releasesListing) {
        await this.unreserveIfNeeded(tx, app.productId, id);
      }

      return next;
    });

    await this.activity.log({
      actorUserId: user.id,
      entityType: 'application',
      entityId: id,
      action: 'status_transition',
      fromValue: app.status,
      toValue: toStatus,
      metadata: { reason },
    });
    if (credit) await this.logCreditDecision(user, id, credit, overrideReason);

    const notifyTitle =
      toStatus === 'rejected'
        ? 'Application rejected'
        : toStatus === 'submission_cancelled'
          ? 'Application cancelled'
          : toStatus === 'contract_signing_required'
            ? 'Contract needs re-signing'
            : toStatus === 'pending_finance_activation'
              ? app.status === ApplicationStatus.under_review
                ? 'Application approved'
                : 'Contract approved'
              : reopensListing
                ? 'Application reopened'
                : 'Application update';
    if (app.customerUserId) {
      await this.activity.notify(
        app.customerUserId,
        notifyTitle,
        customerNotificationBody(toStatus, reason),
        `/app/applications/${id}`,
      );
    }

    if (toStatus === 'rejected') {
      this.analytics.track('rejection', {
        application_id: id,
        from_status: app.status,
        actor_role: user.role,
      });
    } else if (toStatus === 'pending_finance_activation') {
      this.analytics.track('approval', {
        application_id: id,
        from_status: app.status,
        to_status: toStatus,
        actor_role: user.role,
      });
    }

    return toOpsApplicationDto(updated);
  }

  async recordDownPayment(
    user: User,
    id: string,
    body: { amount: number; method?: string; reference?: string; paidAt?: string },
  ) {
    this.assertDownPaymentRole(user);
    if (!Number.isFinite(body.amount) || body.amount <= 0) {
      throw new BadRequestException('validation_failed');
    }

    const app = await this.prisma.application.findUnique({
      where: { id },
      select: { id: true, status: true, companyId: true, customerUserId: true },
    });
    if (!app) throw new NotFoundException();
    await assertCompanyScope(this.prisma, user, app.companyId);

    if (app.status !== ApplicationStatus.down_payment_required) {
      throw new BadRequestException('invalid_status_transition');
    }

    const amount = new Prisma.Decimal(String(body.amount));
    const paidAtRaw = body.paidAt?.trim();
    const paidAt = paidAtRaw ? new Date(paidAtRaw) : null;
    if (paidAtRaw && (!paidAt || Number.isNaN(paidAt.getTime()))) {
      throw new BadRequestException('validation_failed');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const event = await tx.paymentEvent.create({
        data: {
          applicationId: id,
          type: PaymentEventType.down_payment,
          amount,
          currency: 'QAR',
          actorUserId: user.id,
          metadata: asJson({
            method: body.method?.trim() ?? null,
            reference: body.reference?.trim() ?? null,
            paidAt: paidAt?.toISOString() ?? null,
          }),
        },
      });

      const appRow = await tx.application.findUniqueOrThrow({
        where: { id },
        select: { pricingSnapshot: true },
      });
      await this.musharakah.maybeOpenRegister(
        tx,
        id,
        (appRow.pricingSnapshot ?? {}) as Record<string, unknown>,
        user.id,
        event.id,
      );

      await transitionApplication(tx, id, ApplicationStatus.down_payment_required, {
        status: ApplicationStatus.down_payment_submitted,
      });

      return tx.application.findUniqueOrThrow({ where: { id } });
    });

    await this.activity.log({
      actorUserId: user.id,
      entityType: 'application',
      entityId: id,
      action: 'down_payment_recorded',
      fromValue: ApplicationStatus.down_payment_required,
      toValue: ApplicationStatus.down_payment_submitted,
      metadata: {
        amount: amount.toNumber(),
        method: body.method ?? null,
        reference: body.reference ?? null,
      },
    });
    if (app.customerUserId) {
      await this.activity.notify(
        app.customerUserId,
        'Down payment recorded',
        'Your down payment receipt was recorded and is pending confirmation.',
        `/app/applications/${id}`,
      );
    }

    return toOpsApplicationDto(updated);
  }

  async activate(user: User, id: string, opts?: { direct?: boolean; overrideReason?: string | null }) {
    this.assertOps(user);
    if (user.role === UserRole.finance_officer) {
      throw new ForbiddenException('forbidden_role');
    }

    const app = await this.prisma.application.findUnique({
      where: { id },
      include: {
        company: { select: { allowDirectActivate: true, unitOffersEnabled: true } },
        product: { select: { attributes: true, bodyType: true } },
      },
    });
    if (!app) throw new NotFoundException();
    await assertCompanyScope(this.prisma, user, app.companyId);
    if (app.status === ApplicationStatus.partner_processing) {
      throw new BadRequestException('partner_application_readonly');
    }

    if (app.status === 'active') {
      return toOpsApplicationDto(app);
    }

    let expectedFromStatus: ApplicationStatus;
    let adminOverride = false;
    // Activation straight out of review (direct or admin override) is an
    // approval: the credit matrix applies as it does to approve-contract.
    let credit: CreditApproval | null = null;
    if (opts?.direct) {
      // Company-policy shortcut: credit/admin activate from review when the
      // dealer company opted in and contract + compliance are already in place.
      if (app.status !== 'under_review') {
        throw new BadRequestException('invalid_status_transition');
      }
      if (!app.company.allowDirectActivate) {
        throw new BadRequestException('direct_activate_disabled');
      }
      await this.compliance.assertPassedForApproval(id);
      if (!app.contractGenerated || !app.contractPdfPath) {
        throw new BadRequestException('contract_not_generated');
      }
      if (!app.signedContractPath) {
        throw new BadRequestException('signed_contract_required');
      }
      credit = this.evaluateCreditApproval(user, app, opts.overrideReason);
      expectedFromStatus = ApplicationStatus.under_review;
    } else if (ACTIVATE_FROM_STATUSES.includes(app.status)) {
      // vercel: credit/admin "Activate Financing" from the handoff states.
      expectedFromStatus = app.status;
    } else if (
      roleToActor(user.role) === 'admin' &&
      ADMIN_ACTIVATE_FROM_STATUSES.includes(app.status)
    ) {
      // vercel: admin "Activate (Admin)" / "Activate draft" — still behind the
      // compliance gate, which is a marketplace P0 control.
      await this.compliance.assertPassedForApproval(id);
      credit = this.evaluateCreditApproval(user, app, opts?.overrideReason);
      expectedFromStatus = app.status;
      adminOverride = true;
    } else {
      throw new BadRequestException('invalid_status_transition');
    }

    const pricing = app.pricingSnapshot as Record<string, unknown>;
    const installmentPlan = app.installmentPlan as InstallmentPlan | null | undefined;
    const requiredDown = requiredDownPaymentAmount(pricing);
    const recordedDown = await sumDownPaymentRecorded(this.prisma, id);
    assertDownPaymentSatisfied(requiredDown, recordedDown);

    if (!opts?.direct && !adminOverride) {
      await this.musharakah.assertActivationGates(id, expectedFromStatus);
    } else if (this.appConfig.preDisbursalGateEnabled && !opts?.direct) {
      await this.musharakah.assertActivationGates(id, expectedFromStatus);
    }

    const scheduleDrafts = buildScheduleDrafts(pricing, new Date(), installmentPlan);

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM applications WHERE id = ${id} FOR UPDATE`;

      const existingScheduleCount = await tx.paymentSchedule.count({
        where: { applicationId: id },
      });

      if (existingScheduleCount === 0) {
        await tx.paymentSchedule.createMany({
          data: scheduleDrafts.map((s) => ({
            applicationId: id,
            sequence: s.sequence,
            dueDate: s.dueDate,
            amount: s.amount,
            paidAmount: 0,
            remainingAmount: s.amount,
            status: 'pending',
          })),
        });
      } else if (installmentPlan?.schedule?.length) {
        await syncPaymentSchedulesFromInstallmentPlan(tx, id, pricing, installmentPlan);
      }

      await transitionApplication(tx, id, expectedFromStatus, {
        status: ApplicationStatus.active,
        activatedAt: new Date(),
        ...(credit ? credit.columns : {}),
      });

      await tx.product.update({
        where: { id: app.productId },
        data: { listingStatus: ListingStatus.sold },
      });

      await this.musharakah.maybeOpenRegister(tx, id, pricing, user.id);
      await this.musharakah.maybeCreateFirstUnitOffer(tx, id, app.company.unitOffersEnabled);

      return tx.application.findUniqueOrThrow({ where: { id } });
    });

    await this.activity.log({
      actorUserId: user.id,
      entityType: 'application',
      entityId: id,
      action: 'status_transition',
      fromValue: app.status,
      toValue: 'active',
      metadata: opts?.direct ? { direct: true } : adminOverride ? { admin_override: true } : undefined,
    });
    if (credit) await this.logCreditDecision(user, id, credit, opts?.overrideReason);
    if (app.customerUserId) {
      await this.activity.notify(
        app.customerUserId,
        'Financing activated',
        'Your payment schedule is now available in your application.',
        `/app/applications/${id}`,
      );
    }
    void this.musharakah.notifyVehicleCareOnActivate(id);

    return toOpsApplicationDto(updated);
  }

  private async unreserveIfNeeded(
    tx: Prisma.TransactionClient,
    productId: string,
    excludeAppId: string,
  ) {
    const stillBlocking = await tx.application.findFirst({
      where: {
        productId,
        id: { not: excludeAppId },
        status: { in: BLOCKING_APPLICATION_STATUSES },
      },
    });
    if (!stillBlocking) {
      const product = await tx.product.findUnique({
        where: { id: productId },
        select: { listingStatus: true },
      });
      if (product?.listingStatus === ListingStatus.reserved) {
        await tx.product.update({
          where: { id: productId },
          data: { listingStatus: ListingStatus.published },
        });
      }
    }
  }
}
