import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  ApplicationStatus,
  CollectionsCaseStatus,
  HardshipPlanStatus,
  LpoStatus,
  MandateStatus,
  OwnershipRegisterEventType,
  PaymentEventType,
  Prisma,
  RepossessionStatus,
  RentPoolEntryType,
  TakafulStatus,
  TotalLossClaimStatus,
  UnitOfferStatus,
  User,
  UserRole,
} from '@prisma/client';
import { customerPhaseFor } from '@drivemarket/shared/application-status-map';
import { isMature, proRataAllocation, splitRentAndUnits } from '@drivemarket/shared/units';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityService } from '../common/activity.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { AppConfigService } from '../config/app-config.service';
import { assertCompanyScope } from '../applications/company-scope';
import { assertApplicationCanView } from '../applications/application-access';
import { transitionApplication } from '../applications/guarded-transitions';
import { toOpsApplicationDto } from '../applications/application-response.dto';
import { assertSeparationOfDutiesForApplication } from '../applications/separation-of-duties';
import {
  appendRegisterEntry,
  findRegister,
  openRegister,
  recordRentPool,
  registerDto,
  zeroRemainingUnits,
} from './register';
import { evaluateAcquisitionGate, evaluatePreDisbursal } from './gates';
import { requiredDownPaymentAmount, sumDownPaymentRecorded } from '../applications/down-payment';

const DECISION_ROLES: UserRole[] = [
  UserRole.credit_officer,
  UserRole.finance_officer,
  UserRole.admin,
  UserRole.super_admin,
];
const FINANCE_ROLES: UserRole[] = [UserRole.finance_officer, UserRole.admin, UserRole.super_admin];

@Injectable()
export class MusharakahService {
  private readonly logger = new Logger(MusharakahService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityService,
    private readonly analytics: AnalyticsService,
    private readonly appConfig: AppConfigService,
  ) {}

  unitOffersOn(company?: { unitOffersEnabled?: boolean | null }): boolean {
    return this.appConfig.unitOffersEnabled && company?.unitOffersEnabled !== false;
  }

  async maybeOpenRegister(
    tx: Prisma.TransactionClient,
    applicationId: string,
    pricing: Record<string, unknown>,
    actorUserId?: string | null,
    paymentEventId?: string | null,
  ) {
    if (!this.appConfig.musharakahRegisterEnabled) return null;
    return openRegister(tx, { applicationId, pricing, actorUserId, paymentEventId });
  }

  async applyInstallmentToRegister(
    tx: Prisma.TransactionClient,
    input: {
      applicationId: string;
      paymentAmount: number;
      rentDue: number;
      paymentEventId: string;
      actorUserId?: string | null;
      period?: number;
    },
  ) {
    if (!this.appConfig.musharakahRegisterEnabled) return { matured: false };
    const register = await findRegister(tx, input.applicationId);
    if (!register) return { matured: false };
    const split = splitRentAndUnits(input.paymentAmount, input.rentDue, Number(register.unitNominalValue));
    await recordRentPool(tx, {
      applicationId: input.applicationId,
      type: RentPoolEntryType.collected,
      amount: split.rentCollected,
      period: input.period,
      paymentEventId: input.paymentEventId,
      actorUserId: input.actorUserId,
    });
    if (split.unitsBought > 0) {
      const updated = await appendRegisterEntry(tx, {
        applicationId: input.applicationId,
        eventType: OwnershipRegisterEventType.unit_purchase,
        unitsDelta: split.unitsBought,
        paymentEventId: input.paymentEventId,
        actorUserId: input.actorUserId,
        metadata: { rent_collected: split.rentCollected, unit_amount: split.unitPurchaseAmount },
      });
      return { matured: isMature(updated.bloxUnits) };
    }
    return { matured: isMature(register.bloxUnits) };
  }

  async getRegister(user: User, applicationId: string) {
    const app = await this.prisma.application.findUnique({ where: { id: applicationId } });
    if (!app) throw new NotFoundException();
    await assertApplicationCanView(this.prisma, user, app);
    const register = await findRegister(this.prisma, applicationId);
    if (!register) return { register: null, entries: [] };
    const entries = await this.prisma.ownershipRegisterEntry.findMany({
      where: { registerId: register.id },
      orderBy: { createdAt: 'asc' },
    });
    return {
      register: registerDto(register),
      entries: entries.map((e) => ({
        id: e.id,
        event_type: e.eventType,
        units_delta: e.unitsDelta,
        customer_units_after: e.customerUnitsAfter,
        blox_units_after: e.bloxUnitsAfter,
        created_at: e.createdAt.toISOString(),
      })),
    };
  }

  async buildPreDisbursal(applicationId: string) {
    const app = await this.prisma.application.findUnique({
      where: { id: applicationId },
      include: { takafulPolicies: true },
    });
    if (!app) throw new NotFoundException();
    const pricing = (app.pricingSnapshot ?? {}) as Record<string, unknown>;
    const requiredDown = requiredDownPaymentAmount(pricing);
    const recordedDown = await sumDownPaymentRecorded(this.prisma, applicationId);
    const vehiclePrice = Number(pricing.list_price ?? 0);
    const takafulCoverageOk = app.takafulPolicies.some((p) => {
      const coverage = p.coverageAmount ? Number(p.coverageAmount) : 0;
      const live =
        p.status === TakafulStatus.active ||
        p.status === TakafulStatus.declared ||
        p.status === TakafulStatus.pending_verification;
      return live && coverage >= vehiclePrice;
    });
    return evaluatePreDisbursal({
      applicationId,
      status: app.status,
      customerPhase: customerPhaseFor(app.status),
      kycStatus: app.kycStatus,
      contractGenerated: app.contractGenerated,
      signedContractPath: app.signedContractPath,
      preDisbursalCompletedAt: app.preDisbursalCompletedAt,
      repaymentMandateStatus: app.repaymentMandateStatus,
      requiredDown,
      recordedDown,
      takafulCoverageOk,
    });
  }

  async completePreDisbursal(user: User, applicationId: string) {
    const app = await this.prisma.application.findUnique({ where: { id: applicationId } });
    if (!app) throw new NotFoundException();
    if (user.role === UserRole.customer && app.customerUserId !== user.id) {
      throw new ForbiddenException('forbidden_role');
    }
    if (user.role !== UserRole.customer) {
      await assertCompanyScope(this.prisma, user, app.companyId);
    }
    const checklist = await this.buildPreDisbursal(applicationId);
    if (!checklist.complete) {
      throw new BadRequestException({ message: 'pre_disbursal_incomplete', items: checklist.items });
    }
    if (!app.preDisbursalCompletedAt) {
      await this.prisma.application.update({
        where: { id: applicationId },
        data: { preDisbursalCompletedAt: new Date() },
      });
    }
    this.analytics.track('pre_disbursal_complete', { application_id: applicationId });
    return this.buildPreDisbursal(applicationId);
  }

  async registerMandate(
    user: User,
    applicationId: string,
    body: { reference?: string },
  ) {
    const app = await this.prisma.application.findUnique({ where: { id: applicationId } });
    if (!app) throw new NotFoundException();
    if (user.role === UserRole.customer) {
      if (app.customerUserId !== user.id) throw new ForbiddenException('forbidden_role');
    } else {
      if (!DECISION_ROLES.includes(user.role)) throw new ForbiddenException('forbidden_role');
      await assertCompanyScope(this.prisma, user, app.companyId);
    }
    const updated = await this.prisma.application.update({
      where: { id: applicationId },
      data: {
        repaymentMandateStatus: MandateStatus.registered,
        repaymentMandateAt: new Date(),
        repaymentMandateRef: body.reference?.trim() || `mandate:${applicationId}`,
      },
    });
    await this.activity.log({
      actorUserId: user.id,
      entityType: 'application',
      entityId: applicationId,
      action: 'mandate_registered',
      metadata: { reference: updated.repaymentMandateRef },
    });
    return { ok: true, mandate_status: updated.repaymentMandateStatus, reference: updated.repaymentMandateRef };
  }

  async assertActivationGates(applicationId: string, fromStatus: ApplicationStatus) {
    if (this.appConfig.lpoGateEnabled) {
      if (fromStatus !== ApplicationStatus.acquisition_pending) {
        throw new BadRequestException('lpo_gate_requires_acquisition_pending');
      }
      const [lpo, app] = await Promise.all([
        this.prisma.lpoRecord.findFirst({
          where: { applicationId, status: LpoStatus.settled },
          orderBy: { issuedAt: 'desc' },
        }),
        this.prisma.application.findUnique({
          where: { id: applicationId },
          include: {
            product: { select: { vin: true, chassisNumber: true, engineNumber: true } },
            documents: { select: { category: true } },
          },
        }),
      ]);
      if (!app) throw new NotFoundException();
      const checklist = await this.buildPreDisbursal(applicationId);
      const gate = evaluateAcquisitionGate({
        lpoSettled: Boolean(lpo),
        vehicle: app.product,
        documents: app.documents,
        preDisbursalComplete: checklist.complete || !this.appConfig.preDisbursalGateEnabled,
      });
      if (!gate.ok) {
        throw new BadRequestException({ message: 'acquisition_gate_failed', missing: gate.missing });
      }
      return;
    }
    if (this.appConfig.preDisbursalGateEnabled) {
      const checklist = await this.buildPreDisbursal(applicationId);
      if (!checklist.complete) {
        throw new BadRequestException({ message: 'pre_disbursal_incomplete', items: checklist.items });
      }
    }
  }

  async issueLpo(user: User, applicationId: string, body?: { reference?: string; notes?: string }) {
    if (!FINANCE_ROLES.includes(user.role)) throw new ForbiddenException('forbidden_role');
    const app = await this.prisma.application.findUnique({ where: { id: applicationId } });
    if (!app) throw new NotFoundException();
    await assertCompanyScope(this.prisma, user, app.companyId);
    if (app.status === ApplicationStatus.partner_processing) {
      throw new BadRequestException('partner_application_readonly');
    }
    if (app.status !== ApplicationStatus.pending_finance_activation) {
      throw new BadRequestException('invalid_status_transition');
    }
    const pricing = (app.pricingSnapshot ?? {}) as Record<string, unknown>;
    const amount = new Prisma.Decimal(String(Math.max(0, Number(pricing.list_price ?? 0) - Number(pricing.down_payment ?? 0))));

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.lpoRecord.create({
        data: {
          applicationId,
          dealerCompanyId: app.companyId,
          amount,
          reference: body?.reference?.trim() || `LPO-${applicationId.slice(-8).toUpperCase()}`,
          issuedByUserId: user.id,
          notes: body?.notes ?? null,
        },
      });
      await transitionApplication(tx, applicationId, ApplicationStatus.pending_finance_activation, {
        status: ApplicationStatus.lpo_issued,
      });
      return tx.application.findUniqueOrThrow({ where: { id: applicationId } });
    });

    await this.activity.log({
      actorUserId: user.id,
      entityType: 'application',
      entityId: applicationId,
      action: 'status_transition',
      fromValue: ApplicationStatus.pending_finance_activation,
      toValue: ApplicationStatus.lpo_issued,
    });
    this.analytics.track('lpo_issued', { application_id: applicationId });
    return toOpsApplicationDto(updated);
  }

  async confirmLpoSettlement(user: User, applicationId: string, body?: { settlementRef?: string }) {
    if (!FINANCE_ROLES.includes(user.role)) throw new ForbiddenException('forbidden_role');
    const app = await this.prisma.application.findUnique({ where: { id: applicationId } });
    if (!app) throw new NotFoundException();
    await assertCompanyScope(this.prisma, user, app.companyId);
    if (app.status !== ApplicationStatus.lpo_issued) {
      throw new BadRequestException('invalid_status_transition');
    }
    const lpo = await this.prisma.lpoRecord.findFirst({
      where: { applicationId, status: LpoStatus.issued },
      orderBy: { issuedAt: 'desc' },
    });
    if (!lpo) throw new BadRequestException('lpo_not_found');

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.lpoRecord.update({
        where: { id: lpo.id },
        data: {
          status: LpoStatus.settled,
          settledAt: new Date(),
          settledByUserId: user.id,
          settlementRef: body?.settlementRef?.trim() || null,
        },
      });
      await transitionApplication(tx, applicationId, ApplicationStatus.lpo_issued, {
        status: ApplicationStatus.acquisition_pending,
      });
      return tx.application.findUniqueOrThrow({ where: { id: applicationId } });
    });

    await this.activity.log({
      actorUserId: user.id,
      entityType: 'application',
      entityId: applicationId,
      action: 'status_transition',
      fromValue: ApplicationStatus.lpo_issued,
      toValue: ApplicationStatus.acquisition_pending,
    });
    return toOpsApplicationDto(updated);
  }

  async listDealerLpos(user: User) {
    if (user.role !== UserRole.dealer_agent && !FINANCE_ROLES.includes(user.role)) {
      throw new ForbiddenException('forbidden_role');
    }
    const companyId = user.companyId;
    if (user.role === UserRole.dealer_agent && !companyId) throw new ForbiddenException('forbidden_role');
    const rows = await this.prisma.lpoRecord.findMany({
      where: user.role === UserRole.dealer_agent ? { dealerCompanyId: companyId! } : {},
      include: {
        application: {
          select: {
            id: true,
            status: true,
            customerEmail: true,
            product: { select: { make: true, model: true, modelYear: true } },
          },
        },
      },
      orderBy: { issuedAt: 'desc' },
      take: 100,
    });
    return {
      items: rows.map((row) => ({
        id: row.id,
        application_id: row.applicationId,
        status: row.status,
        amount: Number(row.amount),
        reference: row.reference,
        issued_at: row.issuedAt.toISOString(),
        settled_at: row.settledAt?.toISOString() ?? null,
        vehicle: `${row.application.product.make} ${row.application.product.model} ${row.application.product.modelYear ?? ''}`.trim(),
        application_status: row.application.status,
      })),
    };
  }

  async maybeCreateFirstUnitOffer(tx: Prisma.TransactionClient, applicationId: string, companyUnitOffers?: boolean) {
    if (!this.unitOffersOn({ unitOffersEnabled: companyUnitOffers })) return;
    const existing = await tx.unitOffer.findUnique({
      where: { applicationId_period: { applicationId, period: 1 } },
    });
    if (existing) return;
    const register = await findRegister(tx, applicationId);
    const schedule = await tx.paymentSchedule.findFirst({
      where: { applicationId, sequence: 1 },
    });
    if (!schedule) return;
    const unitPrice = register ? Number(register.unitNominalValue) : 0;
    const total = Number(schedule.amount);
    const rent = Math.max(0, total - unitPrice);
    await tx.unitOffer.create({
      data: {
        applicationId,
        period: 1,
        unitsOffered: 1,
        unitPrice: new Prisma.Decimal(String(unitPrice)),
        rentAmount: new Prisma.Decimal(String(rent)),
        totalAmount: schedule.amount,
        status: UnitOfferStatus.offered,
        offeredAt: new Date(),
        scheduleId: schedule.id,
        expiresAt: new Date(Date.now() + 14 * 86400000),
      },
    });
  }

  async listUnitOffers(user: User, applicationId: string) {
    const app = await this.prisma.application.findUnique({ where: { id: applicationId } });
    if (!app) throw new NotFoundException();
    await assertApplicationCanView(this.prisma, user, app);
    const offers = await this.prisma.unitOffer.findMany({
      where: { applicationId },
      orderBy: { period: 'asc' },
    });
    return {
      disclosure_required: true,
      disclosure_ack_at: app.unitOfferDisclosureAckAt?.toISOString() ?? null,
      items: offers.map((o) => ({
        id: o.id,
        period: o.period,
        units_offered: o.unitsOffered,
        unit_price: Number(o.unitPrice),
        rent_amount: Number(o.rentAmount),
        total_amount: Number(o.totalAmount),
        status: o.status,
        offered_at: o.offeredAt?.toISOString() ?? null,
        expires_at: o.expiresAt?.toISOString() ?? null,
      })),
    };
  }

  async acknowledgeOfferDisclosure(user: User, applicationId: string) {
    const app = await this.prisma.application.findUnique({ where: { id: applicationId } });
    if (!app || app.customerUserId !== user.id) throw new NotFoundException();
    await this.prisma.application.update({
      where: { id: applicationId },
      data: { unitOfferDisclosureAckAt: new Date() },
    });
    return { ok: true };
  }

  async acceptUnitOffer(user: User, applicationId: string, offerId: string) {
    const app = await this.prisma.application.findUnique({ where: { id: applicationId } });
    if (!app) throw new NotFoundException();
    if (user.role === UserRole.customer && app.customerUserId !== user.id) {
      throw new ForbiddenException('forbidden_role');
    }
    if (!app.unitOfferDisclosureAckAt && user.role === UserRole.customer) {
      throw new BadRequestException('disclosure_required');
    }
    const offer = await this.prisma.unitOffer.findFirst({
      where: { id: offerId, applicationId },
    });
    if (!offer) throw new NotFoundException();
    if (offer.status !== UnitOfferStatus.offered && offer.status !== UnitOfferStatus.pending) {
      throw new BadRequestException('offer_not_open');
    }
    await this.prisma.unitOffer.update({
      where: { id: offerId },
      data: { status: UnitOfferStatus.accepted, acceptedAt: new Date() },
    });
    this.analytics.track('offer_accepted', { application_id: applicationId, offer_id: offerId });
    return { ok: true, offer_id: offerId, status: UnitOfferStatus.accepted };
  }

  async markUnitOfferPaid(
    tx: Prisma.TransactionClient,
    offerId: string,
    paymentEventId: string,
  ) {
    await tx.unitOffer.update({
      where: { id: offerId },
      data: { status: UnitOfferStatus.paid, paidAt: new Date() },
    });
    this.analytics.track('unit_offer_paid', { offer_id: offerId, payment_event_id: paymentEventId });
  }

  async issueOpenUnitOffers() {
    if (!this.appConfig.unitOffersEnabled) return { issued: 0 };
    const due = await this.prisma.paymentSchedule.findMany({
      where: {
        status: { in: ['pending', 'overdue'] },
        application: { status: ApplicationStatus.active, company: { unitOffersEnabled: true } },
      },
      include: { application: { include: { ownershipRegister: true } } },
      take: 200,
    });
    let issued = 0;
    for (const schedule of due) {
      const existing = await this.prisma.unitOffer.findUnique({
        where: { applicationId_period: { applicationId: schedule.applicationId, period: schedule.sequence } },
      });
      if (existing) continue;
      const unitPrice = schedule.application.ownershipRegister
        ? Number(schedule.application.ownershipRegister.unitNominalValue)
        : 0;
      const total = Number(schedule.amount);
      const rent = Math.max(0, total - unitPrice);
      await this.prisma.unitOffer.create({
        data: {
          applicationId: schedule.applicationId,
          period: schedule.sequence,
          unitsOffered: 1,
          unitPrice,
          rentAmount: rent,
          totalAmount: schedule.amount,
          status: UnitOfferStatus.offered,
          offeredAt: new Date(),
          scheduleId: schedule.id,
          expiresAt: new Date(Date.now() + 14 * 86400000),
        },
      });
      issued += 1;
    }
    return { issued };
  }

  async expireOverdueOffersAndOpenCollections() {
    const expired = await this.prisma.unitOffer.updateMany({
      where: {
        status: { in: [UnitOfferStatus.offered, UnitOfferStatus.accepted] },
        expiresAt: { lt: new Date() },
      },
      data: { status: UnitOfferStatus.expired },
    });
    const overdue = await this.prisma.paymentSchedule.findMany({
      where: { status: 'overdue', application: { status: ApplicationStatus.active } },
      select: { applicationId: true },
      distinct: ['applicationId'],
      take: 100,
    });
    for (const row of overdue) {
      const open = await this.prisma.collectionsCase.findFirst({
        where: { applicationId: row.applicationId, status: { in: [CollectionsCaseStatus.open, CollectionsCaseStatus.hardship] } },
      });
      if (open) continue;
      await this.prisma.collectionsCase.create({
        data: { applicationId: row.applicationId, reason: 'overdue_installment' },
      });
    }
    return { expired: expired.count, collections_opened: overdue.length };
  }

  async openHardship(user: User, applicationId: string, body: { notes?: string; installmentsDeferred?: number; overrideDeferQuota?: boolean }) {
    if (!DECISION_ROLES.includes(user.role)) throw new ForbiddenException('forbidden_role');
    const app = await this.prisma.application.findUnique({
      where: { id: applicationId },
      include: { company: { select: { separationOfDutiesEnabled: true } } },
    });
    if (!app) throw new NotFoundException();
    await assertCompanyScope(this.prisma, user, app.companyId);
    if (app.status !== ApplicationStatus.active) throw new BadRequestException('invalid_status_transition');

    const updated = await this.prisma.$transaction(async (tx) => {
      const collections = await tx.collectionsCase.create({
        data: {
          applicationId,
          status: CollectionsCaseStatus.hardship,
          reason: 'hardship_plan',
          openedByUserId: user.id,
        },
      });
      await tx.hardshipPlan.create({
        data: {
          applicationId,
          collectionsCaseId: collections.id,
          proposedByUserId: user.id,
          notes: body.notes ?? null,
          installmentsDeferred: body.installmentsDeferred ?? 0,
          overrideDeferQuota: body.overrideDeferQuota === true,
        },
      });
      await transitionApplication(tx, applicationId, ApplicationStatus.active, {
        status: ApplicationStatus.hardship,
      });
      return tx.application.findUniqueOrThrow({ where: { id: applicationId } });
    });

    await this.activity.log({
      actorUserId: user.id,
      entityType: 'application',
      entityId: applicationId,
      action: 'status_transition',
      fromValue: 'active',
      toValue: 'hardship',
    });
    return toOpsApplicationDto(updated);
  }

  async decideHardship(user: User, applicationId: string, decision: 'approve' | 'fail' | 'resolve') {
    if (!DECISION_ROLES.includes(user.role)) throw new ForbiddenException('forbidden_role');
    const app = await this.prisma.application.findUnique({
      where: { id: applicationId },
      include: { company: { select: { separationOfDutiesEnabled: true } } },
    });
    if (!app) throw new NotFoundException();
    await assertCompanyScope(this.prisma, user, app.companyId);
    if (app.status !== ApplicationStatus.hardship) throw new BadRequestException('invalid_status_transition');
    await assertSeparationOfDutiesForApplication(
      this.prisma,
      user.id,
      applicationId,
      app.company.separationOfDutiesEnabled,
    );

    const plan = await this.prisma.hardshipPlan.findFirst({
      where: { applicationId, status: { in: [HardshipPlanStatus.proposed, HardshipPlanStatus.active, HardshipPlanStatus.approved] } },
      orderBy: { proposedAt: 'desc' },
    });

    const toStatus =
      decision === 'fail' ? ApplicationStatus.repossession_in_progress : ApplicationStatus.active;
    const planStatus =
      decision === 'fail'
        ? HardshipPlanStatus.failed
        : decision === 'approve'
          ? HardshipPlanStatus.approved
          : HardshipPlanStatus.completed;

    const updated = await this.prisma.$transaction(async (tx) => {
      if (plan) {
        await tx.hardshipPlan.update({
          where: { id: plan.id },
          data: {
            status: planStatus,
            approvedByUserId: user.id,
            decidedAt: new Date(),
            completedAt: decision === 'resolve' || decision === 'fail' ? new Date() : null,
          },
        });
      }
      await transitionApplication(tx, applicationId, ApplicationStatus.hardship, { status: toStatus });
      if (decision === 'fail') {
        await tx.repossessionCase.create({
          data: { applicationId, initiatedByUserId: user.id },
        });
      }
      return tx.application.findUniqueOrThrow({ where: { id: applicationId } });
    });

    await this.activity.log({
      actorUserId: user.id,
      entityType: 'application',
      entityId: applicationId,
      action: 'status_transition',
      fromValue: 'hardship',
      toValue: toStatus,
    });
    return toOpsApplicationDto(updated);
  }

  async closeRepossession(user: User, applicationId: string, body: { saleProceeds: number }) {
    if (!FINANCE_ROLES.includes(user.role) && user.role !== UserRole.admin && user.role !== UserRole.super_admin) {
      throw new ForbiddenException('forbidden_role');
    }
    const app = await this.prisma.application.findUnique({ where: { id: applicationId } });
    if (!app) throw new NotFoundException();
    await assertCompanyScope(this.prisma, user, app.companyId);
    if (app.status !== ApplicationStatus.repossession_in_progress) {
      throw new BadRequestException('invalid_status_transition');
    }
    const repo = await this.prisma.repossessionCase.findFirst({
      where: { applicationId, status: { in: [RepossessionStatus.initiated, RepossessionStatus.recovered] } },
      orderBy: { createdAt: 'desc' },
    });
    if (!repo) throw new BadRequestException('repossession_not_found');
    const register = await findRegister(this.prisma, applicationId);
    const alloc = proRataAllocation(register?.customerUnits ?? 0, register?.bloxUnits ?? 100, body.saleProceeds);

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.repossessionCase.update({
        where: { id: repo.id },
        data: {
          status: RepossessionStatus.closed,
          soldAt: new Date(),
          closedAt: new Date(),
          saleProceeds: new Prisma.Decimal(String(body.saleProceeds)),
          customerShare: new Prisma.Decimal(String(alloc.customerShare)),
          bloxShare: new Prisma.Decimal(String(alloc.bloxShare)),
        },
      });
      await tx.paymentEvent.create({
        data: {
          applicationId,
          type: PaymentEventType.repossession_proceeds,
          amount: new Prisma.Decimal(String(body.saleProceeds)),
          actorUserId: user.id,
          metadata: { customer_share: alloc.customerShare, blox_share: alloc.bloxShare },
        },
      });
      await zeroRemainingUnits(tx, {
        applicationId,
        eventType: OwnershipRegisterEventType.repossession_sale,
        actorUserId: user.id,
      });
      await transitionApplication(tx, applicationId, ApplicationStatus.repossession_in_progress, {
        status: ApplicationStatus.completed,
        completedAt: new Date(),
      });
      return tx.application.findUniqueOrThrow({ where: { id: applicationId } });
    });
    return toOpsApplicationDto(updated);
  }

  async fileTotalLoss(user: User, applicationId: string, body: { proceeds: number; takafulPolicyId?: string; notes?: string }) {
    if (!DECISION_ROLES.includes(user.role)) throw new ForbiddenException('forbidden_role');
    const app = await this.prisma.application.findUnique({ where: { id: applicationId } });
    if (!app) throw new NotFoundException();
    await assertCompanyScope(this.prisma, user, app.companyId);
    if (app.status !== ApplicationStatus.active && app.status !== ApplicationStatus.hardship) {
      throw new BadRequestException('invalid_status_transition');
    }
    const register = await findRegister(this.prisma, applicationId);
    const alloc = proRataAllocation(register?.customerUnits ?? 0, register?.bloxUnits ?? 100, body.proceeds);
    const fromStatus = app.status;

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.totalLossClaim.create({
        data: {
          applicationId,
          takafulPolicyId: body.takafulPolicyId ?? null,
          proceeds: new Prisma.Decimal(String(body.proceeds)),
          customerShare: new Prisma.Decimal(String(alloc.customerShare)),
          bloxShare: new Prisma.Decimal(String(alloc.bloxShare)),
          filedByUserId: user.id,
          notes: body.notes ?? null,
          status: TotalLossClaimStatus.allocated,
          allocatedAt: new Date(),
        },
      });
      await tx.paymentEvent.create({
        data: {
          applicationId,
          type: PaymentEventType.total_loss_proceeds,
          amount: new Prisma.Decimal(String(body.proceeds)),
          actorUserId: user.id,
          metadata: { customer_share: alloc.customerShare, blox_share: alloc.bloxShare },
        },
      });
      await zeroRemainingUnits(tx, {
        applicationId,
        eventType: OwnershipRegisterEventType.total_loss,
        actorUserId: user.id,
      });
      await transitionApplication(tx, applicationId, fromStatus, {
        status: ApplicationStatus.total_loss,
        defaultClassification: 'npl',
      });
      await transitionApplication(tx, applicationId, ApplicationStatus.total_loss, {
        status: ApplicationStatus.completed,
        completedAt: new Date(),
      });
      return tx.application.findUniqueOrThrow({ where: { id: applicationId } });
    });
    return toOpsApplicationDto(updated);
  }

  async completeSettlementLedger(
    tx: Prisma.TransactionClient,
    input: {
      applicationId: string;
      amount: Prisma.Decimal;
      actorUserId: string;
      settlementId: string;
      forgivenRent: Prisma.Decimal;
    },
  ) {
    const event = await tx.paymentEvent.create({
      data: {
        applicationId: input.applicationId,
        type: PaymentEventType.settlement,
        amount: input.amount,
        actorUserId: input.actorUserId,
        metadata: { settlement_id: input.settlementId },
      },
    });
    await recordRentPool(tx, {
      applicationId: input.applicationId,
      type: RentPoolEntryType.forgiven,
      amount: input.forgivenRent,
      paymentEventId: event.id,
      actorUserId: input.actorUserId,
    });
    await zeroRemainingUnits(tx, {
      applicationId: input.applicationId,
      eventType: OwnershipRegisterEventType.settlement,
      paymentEventId: event.id,
      actorUserId: input.actorUserId,
    });
    const openSchedules = await tx.paymentSchedule.findMany({
      where: { applicationId: input.applicationId, status: { in: ['pending', 'overdue'] } },
    });
    for (const row of openSchedules) {
      await tx.paymentSchedule.update({
        where: { id: row.id },
        data: {
          status: 'waived',
          paidAmount: row.amount,
          remainingAmount: 0,
          paidAt: new Date(),
        },
      });
    }
    await transitionApplication(tx, input.applicationId, ApplicationStatus.active, {
      status: ApplicationStatus.completed,
      completedAt: new Date(),
    });
    await tx.applicationDocument.create({
      data: {
        applicationId: input.applicationId,
        category: 'maturity_certificate',
        storagePath: `maturity://${input.applicationId}/${input.settlementId}`,
        mimeType: 'application/pdf',
        uploadedById: input.actorUserId,
        originalName: 'Ownership transfer certificate',
        verificationStatus: 'verified',
      },
    });
    this.analytics.track('maturity_reached', { application_id: input.applicationId, path: 'settlement' });
  }

  async applyKycWebhookStatus(applicationId: string, eventType: string | undefined, eventId: string | undefined) {
    if (!this.appConfig.kycWebhookDrivesStatus) return;
    const app = await this.prisma.application.findUnique({ where: { id: applicationId } });
    if (!app) return;
    if (eventId && app.lastKycWebhookEventId === eventId) return;

    await this.prisma.application.update({
      where: { id: applicationId },
      data: {
        lastKycWebhookEventId: eventId ?? app.lastKycWebhookEventId,
        lastKycWebhookAt: new Date(),
      },
    });

    if (eventType === 'kyc.rejected' && app.status === ApplicationStatus.under_review) {
      await this.prisma.$transaction(async (tx) => {
        await transitionApplication(tx, applicationId, ApplicationStatus.under_review, {
          status: ApplicationStatus.resubmission_required,
          statusReason: 'kyc_rejected',
        });
      });
    }
    if (app.customerUserId && eventType === 'rekyc.triggered' && app.status === ApplicationStatus.active) {
      await this.activity.notify(
        app.customerUserId,
        'Identity review required',
        'Please complete a refresh of your identity documents.',
        `/app/applications/${applicationId}`,
      );
    }
    if (app.customerUserId && eventType === 'document.expiring') {
      await this.activity.notify(
        app.customerUserId,
        'Document expiring',
        'Please update the identity document that is nearing expiry.',
        `/app/applications/${applicationId}`,
      );
    }
    if (app.customerUserId && eventType === 'kyc.manual_review') {
      await this.activity.notify(
        app.customerUserId,
        'Identity under review',
        'Your identity check needs a little more time. We will update this application shortly.',
        `/app/applications/${applicationId}`,
      );
    }
  }

  /**
   * Optional post-activate provisioning for vehicle-care. Failures are logged
   * and never roll back financing activation or LPO.
   */
  async notifyVehicleCareOnActivate(applicationId: string) {
    const url = this.appConfig.vehicleCareWebhookUrl;
    if (!url) return;
    const app = await this.prisma.application.findUnique({
      where: { id: applicationId },
      include: { product: { select: { vin: true, make: true, model: true, modelYear: true } } },
    });
    if (!app) return;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          type: 'financing.activated',
          application_id: applicationId,
          vin: app.product.vin,
          vehicle: `${app.product.make} ${app.product.model} ${app.product.modelYear ?? ''}`.trim(),
        }),
        signal: AbortSignal.timeout(8_000),
      });
      if (!res.ok) {
        this.logger.warn(`vehicle-care hook ${res.status} for ${applicationId}`);
      }
    } catch (err) {
      this.logger.warn(`vehicle-care hook failed for ${applicationId}: ${String(err)}`);
    }
  }
}
