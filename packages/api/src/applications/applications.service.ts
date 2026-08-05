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

function asJson(value: Record<string, unknown>): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

@Injectable()
export class ApplicationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityService,
    private readonly storage: StorageService,
  ) {}

  async hasBlocking(userId: string) {
    const found = await this.prisma.application.findFirst({
      where: { customerUserId: userId, status: { in: BLOCKING } },
      select: { id: true },
    });
    return { blocking: !!found, applicationId: found?.id ?? null };
  }

  async create(
    user: User,
    dto: {
      productId: string;
      offerId: string;
      customerSnapshot: Record<string, unknown>;
      pricingSnapshot: Record<string, unknown>;
      installmentPlan?: Record<string, unknown>;
    },
  ) {
    if (user.role !== UserRole.customer) throw new ForbiddenException('forbidden_role');

    const blocking = await this.hasBlocking(user.id);
    if (blocking.blocking) throw new BadRequestException('blocking_application_exists');

    const product = await this.prisma.product.findUnique({ where: { id: dto.productId } });
    if (
      !product ||
      product.listingStatus !== ListingStatus.published ||
      !product.financeEligible
    ) {
      throw new BadRequestException('listing_not_available');
    }

    const offer = await this.prisma.offer.findFirst({
      where: { id: dto.offerId, status: 'active' },
    });
    if (!offer) throw new BadRequestException('validation_failed');

    const snap = dto.customerSnapshot;
    if (!snap.full_name || !snap.phone || !snap.qid) {
      throw new BadRequestException('validation_failed');
    }

    const app = await this.prisma.$transaction(async (tx) => {
      const created = await tx.application.create({
        data: {
          customerUserId: user.id,
          customerEmail: user.email,
          customerSnapshot: asJson(snap),
          productId: product.id,
          companyId: product.companyId,
          offerId: offer.id,
          pricingSnapshot: asJson(dto.pricingSnapshot),
          installmentPlan: dto.installmentPlan ? asJson(dto.installmentPlan) : undefined,
          status: ApplicationStatus.under_review,
          submittedAt: new Date(),
        },
      });

      await tx.product.update({
        where: { id: product.id },
        data: { listingStatus: ListingStatus.reserved },
      });

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
      action: 'status_transition',
      toValue: 'under_review',
    });

    const notifyTargets = await this.prisma.user.findMany({
      where: {
        isActive: true,
        OR: [
          { role: UserRole.credit_officer, creditScope: 'all' },
          { role: UserRole.dealer_agent, companyId: product.companyId },
          { role: { in: [UserRole.admin, UserRole.super_admin] } },
        ],
      },
    });
    for (const t of notifyTargets) {
      await this.activity.notify(
        t.id,
        t.role === UserRole.dealer_agent ? 'New lead on your stock' : 'New financing application',
        'A customer applied for financing.',
        `/applications/${app.id}`,
      );
    }

    return app;
  }

  async listMine(user: User) {
    return this.prisma.application.findMany({
      where: { customerUserId: user.id },
      include: {
        product: { select: { make: true, model: true, modelYear: true, slug: true, price: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getOne(user: User, id: string) {
    const app = await this.prisma.application.findUnique({
      where: { id },
      include: {
        product: true,
        documents: true,
        company: { select: { id: true, name: true } },
        offer: true,
      },
    });
    if (!app) throw new NotFoundException();
    this.assertCanView(user, app);
    const safeProduct = { ...app.product, vin: undefined, chassisNumber: undefined };
    if (user.role === UserRole.customer || user.role === UserRole.dealer_agent) {
      // dealer can see lead; still hide nothing critical for MVP dealer
    }
    return { ...app, product: safeProduct };
  }

  async opsQueue(user: User) {
    const allowed: UserRole[] = [
      UserRole.credit_officer,
      UserRole.admin,
      UserRole.super_admin,
      UserRole.finance_officer,
    ];
    if (!allowed.includes(user.role)) {
      throw new ForbiddenException('forbidden_role');
    }
    return this.prisma.application.findMany({
      where: {
        status: {
          in: [
            'under_review',
            'resubmission_required',
            'contract_signing_required',
            'contracts_submitted',
            'contract_under_review',
            'pending_finance_activation',
          ],
        },
      },
      include: {
        product: { select: { make: true, model: true, modelYear: true, slug: true } },
        company: { select: { name: true } },
        customer: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async dealerLeads(user: User) {
    if (user.role !== UserRole.dealer_agent || !user.companyId) {
      throw new ForbiddenException('forbidden_role');
    }
    return this.prisma.application.findMany({
      where: { companyId: user.companyId },
      include: {
        product: { select: { make: true, model: true, modelYear: true, slug: true } },
        customer: { select: { name: true, email: true, phone: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async transition(
    user: User,
    id: string,
    toStatus: ApplicationStatus,
    reason?: string,
  ) {
    const roleOk: UserRole[] = [UserRole.credit_officer, UserRole.admin, UserRole.super_admin];
    if (!roleOk.includes(user.role)) {
      throw new ForbiddenException('forbidden_role');
    }
    const app = await this.prisma.application.findUnique({ where: { id } });
    if (!app) throw new NotFoundException();

    let transitionOk = false;
    if (app.status === 'under_review' && (toStatus === 'rejected' || toStatus === 'resubmission_required')) {
      transitionOk = true;
    }
    if (app.status === 'resubmission_required' && toStatus === 'rejected') transitionOk = true;
    if (!transitionOk) throw new BadRequestException('invalid_status_transition');
    if ((toStatus === 'rejected' || toStatus === 'resubmission_required') && !reason?.trim()) {
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
            toStatus === 'resubmission_required' ? reason : app.resubmissionComment,
        },
      });

      if (toStatus === 'rejected' || toStatus === 'submission_cancelled') {
        const stillBlocking = await tx.application.findFirst({
          where: {
            productId: app.productId,
            id: { not: id },
            status: { in: BLOCKING },
          },
        });
        if (!stillBlocking) {
          await tx.product.update({
            where: { id: app.productId },
            data: { listingStatus: ListingStatus.published },
          });
        }
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
    await this.activity.notify(
      app.customerUserId,
      toStatus === 'rejected' ? 'Application rejected' : 'Documents required',
      reason,
      `/app/applications/${id}`,
    );
    return updated;
  }

  async resubmit(user: User, id: string) {
    const app = await this.prisma.application.findUnique({ where: { id } });
    if (!app || app.customerUserId !== user.id) throw new ForbiddenException('forbidden_role');
    if (app.status !== 'resubmission_required') {
      throw new BadRequestException('invalid_status_transition');
    }
    const updated = await this.prisma.application.update({
      where: { id },
      data: { status: 'under_review' },
    });
    await this.activity.log({
      actorUserId: user.id,
      entityType: 'application',
      entityId: id,
      action: 'status_transition',
      fromValue: 'resubmission_required',
      toValue: 'under_review',
    });
    return updated;
  }

  async cancel(user: User, id: string, reason?: string) {
    const app = await this.prisma.application.findUnique({ where: { id } });
    if (!app || app.customerUserId !== user.id) throw new ForbiddenException('forbidden_role');
    if (!['draft', 'under_review', 'resubmission_required'].includes(app.status)) {
      throw new BadRequestException('invalid_status_transition');
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.application.update({
        where: { id },
        data: { status: 'submission_cancelled', statusReason: reason },
      });
      const stillBlocking = await tx.application.findFirst({
        where: {
          productId: app.productId,
          id: { not: id },
          status: { in: BLOCKING },
        },
      });
      if (!stillBlocking) {
        await tx.product.update({
          where: { id: app.productId },
          data: { listingStatus: ListingStatus.published },
        });
      }
      return next;
    });
    await this.activity.log({
      actorUserId: user.id,
      entityType: 'application',
      entityId: id,
      action: 'status_transition',
      toValue: 'submission_cancelled',
    });
    return updated;
  }

  async uploadDoc(
    user: User,
    id: string,
    category: 'qid' | 'salary' | 'bank' | 'other',
    file: Express.Multer.File,
  ) {
    const app = await this.prisma.application.findUnique({ where: { id } });
    if (!app || app.customerUserId !== user.id) throw new ForbiddenException('forbidden_role');
    if (!['under_review', 'resubmission_required', 'draft'].includes(app.status)) {
      throw new BadRequestException('validation_failed');
    }
    const key = await this.storage.uploadKyc(file, id, category);
    return this.prisma.applicationDocument.create({
      data: {
        applicationId: id,
        category,
        storagePath: key,
        mimeType: file.mimetype,
        uploadedById: user.id,
      },
    });
  }

  private assertCanView(
    user: User,
    app: { customerUserId: string; companyId: string },
  ) {
    if (user.role === UserRole.customer && app.customerUserId === user.id) return;
    if (user.role === UserRole.dealer_agent && user.companyId === app.companyId) return;
    const ops: UserRole[] = [
      UserRole.credit_officer,
      UserRole.finance_officer,
      UserRole.admin,
      UserRole.super_admin,
    ];
    if (ops.includes(user.role)) {
      return;
    }
    throw new ForbiddenException('forbidden_role');
  }
}
