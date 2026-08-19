import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ApplicationStatus,
  ListingStatus,
  Prisma,
  User,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityService } from '../common/activity.service';
import { StorageService } from '../storage/storage.service';
import {
  assertOpsTransitionAllowed,
  opsTransitionRequiresReason,
} from './application-transitions';
import { buildContractPdf } from './contract-pdf';
import { buildScheduleDrafts } from './payment-schedules';

const BLOCKING: ApplicationStatus[] = [
  'draft',
  'under_review',
  'resubmission_required',
  'contract_signing_required',
  'contracts_submitted',
  'contract_under_review',
  'down_payment_required',
  'down_payment_submitted',
  'pending_finance_activation',
  'active',
];

const OPS_ROLES: UserRole[] = [UserRole.credit_officer, UserRole.admin, UserRole.super_admin];

function asJson(value: Record<string, unknown>): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

@Injectable()
export class ApplicationsLifecycleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityService,
    private readonly storage: StorageService,
  ) {}

  private assertOps(user: User) {
    if (!OPS_ROLES.includes(user.role)) {
      throw new ForbiddenException('forbidden_role');
    }
  }

  async approveWithContract(user: User, id: string) {
    this.assertOps(user);
    const app = await this.prisma.application.findUnique({
      where: { id },
      include: {
        product: { select: { make: true, model: true, modelYear: true } },
        company: { select: { name: true } },
      },
    });
    if (!app) throw new NotFoundException();
    if (app.status !== 'under_review') {
      throw new BadRequestException('invalid_status_transition');
    }

    const snap = app.customerSnapshot as Record<string, unknown>;
    const pricing = app.pricingSnapshot as Record<string, unknown>;
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
      approvedAt: new Date().toISOString(),
      lenderName: 'DriveMarket Financing (placeholder)',
    };

    const pdf = await buildContractPdf({
      applicationId: app.id,
      customerName: String(snap.full_name ?? ''),
      customerEmail: app.customerEmail,
      customerPhone: String(snap.phone ?? ''),
      customerQid: String(snap.qid ?? ''),
      vehicleLabel: `${app.product.make} ${app.product.model} ${app.product.modelYear ?? ''}`.trim(),
      dealerName: app.company.name,
      listPrice: Number(pricing.list_price ?? 0),
      downPayment: Number(pricing.down_payment ?? 0),
      monthly: Number(pricing.monthly ?? 0),
      tenor: Number(pricing.tenor ?? pricing.tenure ?? 0),
      annualRate: Number(pricing.rate ?? 0),
    });

    const contractPdfPath = await this.storage.storeContractPdf(app.id, pdf);

    const updated = await this.prisma.application.update({
      where: { id },
      data: {
        status: 'contract_signing_required',
        contractGenerated: true,
        contractData: asJson(contractData),
        contractPdfPath,
      },
    });

    await this.activity.log({
      actorUserId: user.id,
      entityType: 'application',
      entityId: id,
      action: 'status_transition',
      fromValue: 'under_review',
      toValue: 'contract_signing_required',
    });
    await this.activity.notify(
      app.customerUserId,
      'Contract ready to sign',
      'Download your financing contract, sign it, and upload the signed PDF.',
      `/app/applications/${id}`,
    );

    return updated;
  }

  async downloadContract(user: User, id: string) {
    const app = await this.prisma.application.findUnique({ where: { id } });
    if (!app) throw new NotFoundException();
    this.assertCanView(user, app);
    if (!app.contractPdfPath) throw new NotFoundException();
    const file = await this.storage.readContract(app.contractPdfPath);
    return { ...file, filename: 'financing-contract.pdf' };
  }

  async submitSignedContract(user: User, id: string, file: Express.Multer.File) {
    if (user.role !== UserRole.customer) throw new ForbiddenException('forbidden_role');
    const app = await this.prisma.application.findUnique({ where: { id } });
    if (!app || app.customerUserId !== user.id) throw new ForbiddenException('forbidden_role');
    if (app.status !== 'contract_signing_required') {
      throw new BadRequestException('invalid_status_transition');
    }

    this.storage.assertSignedContractFile(file);
    const signedContractPath = await this.storage.uploadSignedContract(file, id);

    const updated = await this.prisma.application.update({
      where: { id },
      data: {
        status: 'contracts_submitted',
        signedContractPath,
      },
    });

    await this.activity.log({
      actorUserId: user.id,
      entityType: 'application',
      entityId: id,
      action: 'status_transition',
      fromValue: 'contract_signing_required',
      toValue: 'contracts_submitted',
    });

    return updated;
  }

  /**
   * P0-4 backstop: ops can file a physically-signed contract on the customer's
   * behalf (walk-in customers sign at the dealership). Audit-logged with the
   * uploading officer as actor.
   */
  async submitSignedContractOps(user: User, id: string, file: Express.Multer.File) {
    this.assertOps(user);
    const app = await this.prisma.application.findUnique({ where: { id } });
    if (!app) throw new NotFoundException();
    if (app.status !== 'contract_signing_required') {
      throw new BadRequestException('invalid_status_transition');
    }

    this.storage.assertSignedContractFile(file);
    const signedContractPath = await this.storage.uploadSignedContract(file, id);

    const updated = await this.prisma.application.update({
      where: { id },
      data: {
        status: 'contracts_submitted',
        signedContractPath,
      },
    });

    await this.activity.log({
      actorUserId: user.id,
      entityType: 'application',
      entityId: id,
      action: 'status_transition',
      fromValue: 'contract_signing_required',
      toValue: 'contracts_submitted',
      metadata: { uploadedBy: 'ops', onBehalfOfCustomer: app.customerUserId },
    });
    await this.activity.notify(
      app.customerUserId,
      'Signed contract received',
      'Your signed contract was filed by our team and is now under review.',
      `/app/applications/${id}`,
    );

    return updated;
  }

  async opsTransition(user: User, id: string, toStatus: ApplicationStatus, reason?: string) {
    // Finance officers participate in the down-payment edges; the per-edge
    // actor table in application-transitions.ts is the authoritative gate.
    const transitionRoles: UserRole[] = [...OPS_ROLES, UserRole.finance_officer];
    if (!transitionRoles.includes(user.role)) {
      throw new ForbiddenException('forbidden_role');
    }
    const app = await this.prisma.application.findUnique({ where: { id } });
    if (!app) throw new NotFoundException();

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

    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.application.update({
        where: { id },
        data: {
          status: toStatus,
          statusReason: reason,
          rejectionReason: toStatus === 'rejected' ? reason : app.rejectionReason,
          resubmissionComment:
            toStatus === 'contract_signing_required' ? reason : app.resubmissionComment,
        },
      });

      if (toStatus === 'rejected') {
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

    const notifyTitle =
      toStatus === 'rejected'
        ? 'Application rejected'
        : toStatus === 'contract_signing_required'
          ? 'Contract needs re-signing'
          : toStatus === 'pending_finance_activation'
            ? 'Contract approved'
            : 'Application update';
    await this.activity.notify(app.customerUserId, notifyTitle, reason, `/app/applications/${id}`);

    return updated;
  }

  async activate(user: User, id: string, opts?: { direct?: boolean }) {
    this.assertOps(user);
    if (user.role === UserRole.finance_officer) {
      throw new ForbiddenException('forbidden_role');
    }

    const app = await this.prisma.application.findUnique({
      where: { id },
      include: {
        company: { select: { allowDirectActivate: true } },
        paymentSchedules: { select: { id: true }, take: 1 },
      },
    });
    if (!app) throw new NotFoundException();

    if (app.status === 'active') {
      return app;
    }

    if (opts?.direct) {
      if (app.status !== 'under_review') {
        throw new BadRequestException('invalid_status_transition');
      }
      if (!app.company.allowDirectActivate) {
        throw new BadRequestException('direct_activate_disabled');
      }
    } else if (app.status !== 'pending_finance_activation') {
      throw new BadRequestException('invalid_status_transition');
    }

    const pricing = app.pricingSnapshot as Record<string, unknown>;
    const scheduleDrafts = buildScheduleDrafts(pricing);

    const updated = await this.prisma.$transaction(async (tx) => {
      if (app.paymentSchedules.length === 0) {
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
      }

      const next = await tx.application.update({
        where: { id },
        data: {
          status: 'active',
          activatedAt: new Date(),
        },
      });

      await tx.product.update({
        where: { id: app.productId },
        data: { listingStatus: ListingStatus.sold },
      });

      return next;
    });

    await this.activity.log({
      actorUserId: user.id,
      entityType: 'application',
      entityId: id,
      action: 'status_transition',
      fromValue: app.status,
      toValue: 'active',
      metadata: opts?.direct ? { direct: true } : undefined,
    });
    await this.activity.notify(
      app.customerUserId,
      'Financing activated',
      'Your payment schedule is now available in your application.',
      `/app/applications/${id}`,
    );

    return updated;
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
        status: { in: BLOCKING },
      },
    });
    if (!stillBlocking) {
      await tx.product.update({
        where: { id: productId },
        data: { listingStatus: ListingStatus.published },
      });
    }
  }

  private assertCanView(user: User, app: { customerUserId: string; companyId: string }) {
    if (user.role === UserRole.customer && app.customerUserId === user.id) return;
    if (user.role === UserRole.dealer_agent && user.companyId === app.companyId) return;
    const ops: UserRole[] = [
      UserRole.credit_officer,
      UserRole.finance_officer,
      UserRole.admin,
      UserRole.super_admin,
    ];
    if (ops.includes(user.role)) return;
    throw new ForbiddenException('forbidden_role');
  }
}
