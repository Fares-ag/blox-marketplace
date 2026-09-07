import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  ConsentCode,
  DataRightsRequestKind,
  DataRightsRequestStatus,
  Prisma,
  User,
  UserRole,
} from '@prisma/client';
import { isConsentCode } from '@drivemarket/shared/domain-rules';
import type {
  ConsentStatusDto,
  CustomerDocumentDto,
  CustomerProfileDto,
  DataRightsRequestDto,
} from '../../../shared/src/types/customer-platform';
import { ActivityService } from '../common/activity.service';
import { IdentityService } from '../common/identity.service';
import { ConsentsService } from '../consents/consents.service';
import { financingFromPricing } from '../partner/partner-logic';
import { PrismaService } from '../prisma/prisma.service';
import { CustomerDocumentsService } from './customer-documents.service';
import { toCustomerProfileDto } from './customer-profile';
import {
  anonymisationPatch,
  canTransitionDataRights,
  dataRightsDueAt,
  DATA_RIGHTS_SLA_DAYS,
  DELETION_BLOCKING_STATUSES,
  isTerminalDataRightsStatus,
  PENDING_DATA_RIGHTS_STATUSES,
  toDataRightsRequestDto,
} from './data-rights-logic';

const REQUEST_INCLUDE = {
  handledBy: { select: { name: true } },
  user: { select: { id: true, name: true, email: true } },
} satisfies Prisma.DataRightsRequestInclude;

export type CreateDataRightsInput = {
  kind: DataRightsRequestKind;
  details?: string | null;
  consent_code?: string | null;
};

export type TransitionDataRightsInput = {
  status: DataRightsRequestStatus;
  resolution_note?: string | null;
};

export type CustomerDataExport = {
  generated_at: string;
  profile: CustomerProfileDto & { qid: string | null; email_verified: boolean; created_at: string };
  applications: Array<{
    id: string;
    status: string;
    created_at: string;
    submitted_at: string | null;
    activated_at: string | null;
    completed_at: string | null;
    consents_completed_at: string | null;
    company_name: string;
    finance_partner_name: string | null;
    vehicle: { make: string; model: string; model_year: number };
    financing: ReturnType<typeof financingFromPricing>;
    customer_snapshot: unknown;
  }>;
  consents: ConsentStatusDto;
  documents: CustomerDocumentDto[];
  notifications: Array<{
    id: string;
    title: string;
    body: string | null;
    link_path: string | null;
    read_at: string | null;
    created_at: string;
  }>;
  data_rights_requests: DataRightsRequestDto[];
};

const KIND_LABELS: Record<DataRightsRequestKind, string> = {
  access: 'data access',
  correction: 'data correction',
  deletion: 'account deletion',
  consent_withdrawal: 'consent withdrawal',
};

/**
 * Data-rights requests (Qatar PDPPL): the customer files access, correction,
 * deletion and consent-withdrawal requests and downloads their data; the
 * privacy team (admin/super_admin) works the queue. Completing a deletion
 * anonymises the account; completing a consent withdrawal applies it.
 */
@Injectable()
export class DataRightsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityService,
    private readonly identity: IdentityService,
    private readonly consents: ConsentsService,
    private readonly documents: CustomerDocumentsService,
  ) {}

  // ---- Customer ----

  async listMine(userId: string): Promise<DataRightsRequestDto[]> {
    const rows = await this.prisma.dataRightsRequest.findMany({
      where: { userId },
      include: REQUEST_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => toDataRightsRequestDto(row));
  }

  async create(user: User, input: CreateDataRightsInput): Promise<DataRightsRequestDto> {
    const details = input.details?.trim() || null;
    let consentCode: ConsentCode | null = null;
    if (input.kind === DataRightsRequestKind.consent_withdrawal) {
      const code = input.consent_code?.trim() ?? '';
      if (!isConsentCode(code)) throw new BadRequestException({ message: 'consent_code_invalid', consent_code: code });
      consentCode = code;
    }
    if (input.kind === DataRightsRequestKind.deletion) {
      const active = await this.prisma.application.findFirst({
        where: { customerUserId: user.id, status: { in: DELETION_BLOCKING_STATUSES } },
        select: { id: true, status: true },
        orderBy: { updatedAt: 'desc' },
      });
      if (active) {
        throw new ConflictException({
          message: 'deletion_blocked_active_financing',
          application_id: active.id,
          status: active.status,
        });
      }
    }

    const pending = await this.prisma.dataRightsRequest.findFirst({
      where: {
        userId: user.id,
        kind: input.kind,
        ...(consentCode ? { consentCode } : {}),
        status: { in: PENDING_DATA_RIGHTS_STATUSES },
      },
      select: { id: true },
    });
    if (pending) throw new ConflictException({ message: 'data_rights_request_pending', request_id: pending.id });

    const created = await this.prisma.dataRightsRequest.create({
      data: { userId: user.id, kind: input.kind, details, consentCode, dueAt: dataRightsDueAt() },
      include: REQUEST_INCLUDE,
    });
    await this.activity.log({
      actorUserId: user.id,
      entityType: 'data_rights_request',
      entityId: created.id,
      action: 'data_rights_requested',
      toValue: input.kind,
      metadata: { consent_code: consentCode, due_at: created.dueAt?.toISOString() ?? null },
    });
    await this.notifyPrivacyTeam(created.id, input.kind, user.name);
    return toDataRightsRequestDto(created);
  }

  /** Right of access: everything the platform holds about the customer, as one JSON bundle. */
  async exportFor(user: User): Promise<CustomerDataExport> {
    const [applications, consents, documents, notifications, requests] = await Promise.all([
      this.prisma.application.findMany({
        where: { customerUserId: user.id },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          status: true,
          createdAt: true,
          submittedAt: true,
          activatedAt: true,
          completedAt: true,
          consentsCompletedAt: true,
          customerSnapshot: true,
          pricingSnapshot: true,
          company: { select: { name: true } },
          financePartner: { select: { name: true } },
          product: { select: { make: true, model: true, modelYear: true } },
        },
      }),
      this.consents.statusFor(user.id),
      this.documents.list(user.id),
      this.prisma.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' }, take: 500 }),
      this.listMine(user.id),
    ]);

    await this.activity.log({
      actorUserId: user.id,
      entityType: 'user',
      entityId: user.id,
      action: 'data_export_generated',
      metadata: { applications: applications.length, documents: documents.length },
    });

    return {
      generated_at: new Date().toISOString(),
      profile: {
        ...toCustomerProfileDto(user, this.identity.readQid(user)),
        qid: this.identity.readQid(user),
        email_verified: user.emailVerified,
        created_at: user.createdAt.toISOString(),
      },
      applications: applications.map((app) => ({
        id: app.id,
        status: app.status,
        created_at: app.createdAt.toISOString(),
        submitted_at: app.submittedAt?.toISOString() ?? null,
        activated_at: app.activatedAt?.toISOString() ?? null,
        completed_at: app.completedAt?.toISOString() ?? null,
        consents_completed_at: app.consentsCompletedAt?.toISOString() ?? null,
        company_name: app.company.name,
        finance_partner_name: app.financePartner?.name ?? null,
        vehicle: { make: app.product.make, model: app.product.model, model_year: app.product.modelYear },
        financing: financingFromPricing(app.pricingSnapshot),
        customer_snapshot: app.customerSnapshot,
      })),
      consents,
      documents,
      notifications: notifications.map((n) => ({
        id: n.id,
        title: n.title,
        body: n.body ?? null,
        link_path: n.linkPath ?? null,
        read_at: n.readAt?.toISOString() ?? null,
        created_at: n.createdAt.toISOString(),
      })),
      data_rights_requests: requests,
    };
  }

  // ---- Ops (admin / super_admin) ----

  async listForOps(status?: DataRightsRequestStatus | null): Promise<DataRightsRequestDto[]> {
    const rows = await this.prisma.dataRightsRequest.findMany({
      where: status ? { status } : {},
      include: REQUEST_INCLUDE,
      orderBy: [{ dueAt: 'asc' }, { createdAt: 'asc' }],
    });
    return rows.map((row) => toDataRightsRequestDto(row, { includeCustomer: true }));
  }

  async transition(actor: User, id: string, input: TransitionDataRightsInput): Promise<DataRightsRequestDto> {
    const row = await this.prisma.dataRightsRequest.findUnique({ where: { id }, include: REQUEST_INCLUDE });
    if (!row) throw new NotFoundException('data_rights_request_not_found');
    if (!canTransitionDataRights(row.status, input.status)) {
      throw new ConflictException({ message: 'invalid_status_transition', from: row.status, to: input.status });
    }
    const note = input.resolution_note?.trim() || null;
    const now = new Date();
    const terminal = isTerminalDataRightsStatus(input.status);
    const completing = input.status === DataRightsRequestStatus.completed;

    if (completing && row.kind === DataRightsRequestKind.consent_withdrawal && row.consentCode) {
      await this.consents.withdraw({
        userId: row.userId,
        code: row.consentCode,
        reason: note ?? row.details,
        actorUserId: actor.id,
        force: true,
      });
    }

    let anonymised = false;
    const updated = await this.prisma.$transaction(async (tx) => {
      if (completing && row.kind === DataRightsRequestKind.deletion) {
        await this.anonymiseUser(tx, row.userId, now);
        anonymised = true;
      }
      return tx.dataRightsRequest.update({
        where: { id: row.id },
        data: {
          status: input.status,
          resolutionNote: note ?? undefined,
          handledById: actor.id,
          handledAt: terminal ? now : row.handledAt,
        },
        include: REQUEST_INCLUDE,
      });
    });

    await this.activity.log({
      actorUserId: actor.id,
      entityType: 'data_rights_request',
      entityId: row.id,
      action: 'data_rights_transitioned',
      fromValue: row.status,
      toValue: input.status,
      metadata: { kind: row.kind, user_id: row.userId, consent_code: row.consentCode, note, anonymised },
    });
    if (anonymised) {
      await this.activity.log({
        actorUserId: actor.id,
        entityType: 'user',
        entityId: row.userId,
        action: 'user_anonymised',
        metadata: { data_rights_request_id: row.id },
      });
    } else {
      await this.notifyCustomer(row.userId, row.kind, input.status, note);
    }
    return toDataRightsRequestDto(updated, { includeCustomer: true });
  }

  /**
   * Right to erasure: identity fields are overwritten (QID columns through
   * IdentityService), vault documents soft-deleted and every session and
   * device revoked. Applications, ledgers and audit rows stay for the
   * statutory retention period, now pointing at an anonymised account.
   */
  private async anonymiseUser(tx: Prisma.TransactionClient, userId: string, now: Date): Promise<void> {
    const qid = this.identity.prepareQidWrite(null) ?? { qid: null, qidEnc: null, qidHash: null };
    await tx.user.update({
      where: { id: userId },
      data: {
        ...anonymisationPatch(userId),
        ...qid,
        address: Prisma.DbNull,
        notificationPreferences: Prisma.DbNull,
      },
    });
    await tx.customerDocument.updateMany({ where: { userId, deletedAt: null }, data: { deletedAt: now } });
    await tx.session.deleteMany({ where: { userId } });
    await tx.mobileRefreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: now } });
    await tx.deviceToken.deleteMany({ where: { userId } });
  }

  private async notifyPrivacyTeam(requestId: string, kind: DataRightsRequestKind, customerName: string | null) {
    const admins = await this.prisma.user.findMany({
      where: { isActive: true, role: { in: [UserRole.admin, UserRole.super_admin] } },
      select: { id: true },
    });
    for (const admin of admins) {
      await this.activity.notify(
        admin.id,
        'New data-rights request',
        `${customerName ?? 'A customer'} submitted a ${KIND_LABELS[kind]} request. Respond within ${DATA_RIGHTS_SLA_DAYS} days.`,
        `/data-rights/${requestId}`,
        { category: 'security' },
      );
    }
  }

  private async notifyCustomer(
    userId: string,
    kind: DataRightsRequestKind,
    status: DataRightsRequestStatus,
    note: string | null,
  ) {
    const label = KIND_LABELS[kind];
    const copy: Partial<Record<DataRightsRequestStatus, { title: string; body: string }>> = {
      in_progress: {
        title: 'Your data request is being handled',
        body: `Our privacy team is working on your ${label} request.`,
      },
      completed: {
        title: 'Your data request is complete',
        body: note ? `Your ${label} request has been completed. ${note}` : `Your ${label} request has been completed.`,
      },
      rejected: {
        title: 'Your data request could not be fulfilled',
        body: note ? `Your ${label} request was declined: ${note}` : `Your ${label} request was declined.`,
      },
    };
    const message = copy[status];
    if (!message) return;
    // Privacy-rights updates are account security notices: always in-app + email.
    await this.activity.notify(userId, message.title, message.body, '/app/profile', { category: 'security' });
  }
}
