import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  ApplicationStatus,
  ConsentChannel,
  ConsentCode,
  DataRightsRequestKind,
  Prisma,
  User,
} from '@prisma/client';
import { CONSENT_CATALOG_VERSION, isConsentCode } from '@drivemarket/shared/domain-rules';
import type { ConsentStatusDto } from '../../../shared/src/types/customer-platform';
import { assertApplicationCanView, BLOCKING_APPLICATION_STATUSES } from '../applications/application-access';
import { ActivityService } from '../common/activity.service';
import { dataRightsDueAt, PENDING_DATA_RIGHTS_STATUSES } from '../customers/data-rights-logic';
import { PrismaService } from '../prisma/prisma.service';
import {
  buildConsentStatus,
  consentTextHash,
  normalizeConsentLocale,
  validateAcceptances,
  type ConsentAcceptanceInput,
} from './consent-logic';
import { consentWithdrawalDecision } from './consent-withdrawal';

export type RecordConsentsInput = {
  userId: string;
  acceptances: ConsentAcceptanceInput[];
  locale: string;
  applicationId?: string | null;
  channel: ConsentChannel;
  ipAddress?: string | null;
  userAgent?: string | null;
  sessionId?: string | null;
  deviceInfo?: Prisma.InputJsonValue | null;
  /** Staff member present when the consent was captured on the customer's device (assisted journey). */
  actorUserId?: string | null;
};

export type WithdrawConsentInput = {
  userId: string;
  code: string;
  reason?: string | null;
  /** Staff member completing a data-rights request on the customer's behalf. */
  actorUserId?: string | null;
  /** Privacy-team decision: apply even while live applications rely on the consent. */
  force?: boolean;
};

/** `consentsCompletedAt` may still be stamped while the application has not been (re)submitted. */
const CONSENT_STAMPABLE_STATUSES: ApplicationStatus[] = [
  ApplicationStatus.draft,
  ApplicationStatus.resubmission_required,
];

/**
 * Consent centre. Acceptances are account-level (one valid acceptance of the
 * current catalog version covers every application), immutable, and hashed
 * against the exact text shown. The application's `consentsCompletedAt` is the
 * submit gate A1 reads; it is stamped the moment all four are in place.
 */
@Injectable()
export class ConsentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityService,
  ) {}

  /** Account-level status; with an application id, also stamps the application when everything is in place. */
  async statusFor(userId: string, applicationId?: string | null): Promise<ConsentStatusDto> {
    if (applicationId) await this.assertOwnedApplication(userId, applicationId);
    const status = buildConsentStatus(await this.loadRecords(userId));
    if (applicationId && status.complete) await this.stampApplication(userId, applicationId);
    return status;
  }

  async record(input: RecordConsentsInput): Promise<ConsentStatusDto> {
    const validation = validateAcceptances(input.acceptances);
    if (!validation.ok) {
      throw new BadRequestException({ message: validation.error, consent_code: validation.code });
    }
    if (!validation.accepted.length) throw new BadRequestException('validation_failed');

    const applicationId = input.applicationId ?? null;
    if (applicationId) await this.assertOwnedApplication(input.userId, applicationId);

    const locale = normalizeConsentLocale(input.locale);
    const acceptedAt = new Date();
    await this.prisma.consentRecord.createMany({
      data: validation.accepted.map(({ code, version }) => ({
        userId: input.userId,
        applicationId,
        code,
        version,
        textHash: consentTextHash(code, locale),
        locale,
        channel: input.channel,
        acceptedAt,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ? input.userAgent.slice(0, 512) : null,
        sessionId: input.sessionId ?? null,
        deviceInfo: input.deviceInfo ?? undefined,
        actorUserId: input.actorUserId ?? null,
      })),
    });

    await this.activity.log({
      actorUserId: input.actorUserId ?? input.userId,
      entityType: applicationId ? 'application' : 'user',
      entityId: applicationId ?? input.userId,
      action: 'consents_recorded',
      toValue: CONSENT_CATALOG_VERSION,
      metadata: {
        user_id: input.userId,
        codes: validation.accepted.map((a) => a.code),
        channel: input.channel,
        locale,
      },
    });

    const status = buildConsentStatus(await this.loadRecords(input.userId));
    if (applicationId && status.complete) await this.stampApplication(input.userId, applicationId);
    return status;
  }

  /**
   * Withdraw every live acceptance of one consent (PDPPL). Free while only
   * drafts rely on it — their `consentsCompletedAt` stamp is cleared and they
   * must re-consent before submitting. Once a submitted, still-live
   * application relies on it, the withdrawal is refused with
   * `consent_withdrawal_blocked` and a data-rights request is opened for the
   * privacy team, who complete it with `force`.
   */
  async withdraw(input: WithdrawConsentInput): Promise<ConsentStatusDto> {
    const code = String(input.code ?? '').trim();
    if (!isConsentCode(code)) {
      throw new BadRequestException({ message: 'consent_code_invalid', consent_code: code });
    }
    const reason = input.reason?.trim() || null;
    const live = await this.prisma.consentRecord.findMany({
      where: { userId: input.userId, code, withdrawnAt: null },
      select: { id: true },
    });
    if (!live.length && !input.force) throw new ConflictException('consent_not_accepted');

    const applications = await this.prisma.application.findMany({
      where: { customerUserId: input.userId, status: { in: BLOCKING_APPLICATION_STATUSES } },
      select: {
        id: true,
        status: true,
        consentsCompletedAt: true,
        consentRecords: { where: { code, withdrawnAt: null }, select: { id: true } },
      },
    });
    const decision = consentWithdrawalDecision(
      code,
      applications.map((app) => ({
        id: app.id,
        status: app.status,
        consentsCompletedAt: app.consentsCompletedAt,
        consentCodes: app.consentRecords.length ? [code] : [],
      })),
    );

    if (!decision.allowed && !input.force) {
      const request = await this.openWithdrawalRequest(input.userId, code, reason);
      throw new ConflictException({
        message: 'consent_withdrawal_blocked',
        consent_code: code,
        application_ids: decision.blockingApplicationIds,
        data_rights_request_id: request.id,
      });
    }

    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      if (live.length) {
        await tx.consentRecord.updateMany({
          where: { userId: input.userId, code, withdrawnAt: null },
          data: { withdrawnAt: now, withdrawalReason: reason },
        });
      }
      if (decision.draftIdsToClear.length) {
        await tx.application.updateMany({
          where: { id: { in: decision.draftIdsToClear }, customerUserId: input.userId },
          data: { consentsCompletedAt: null },
        });
      }
    });

    await this.activity.log({
      actorUserId: input.actorUserId ?? input.userId,
      entityType: 'user',
      entityId: input.userId,
      action: 'consent_withdrawn',
      fromValue: code,
      metadata: {
        consent_code: code,
        records_withdrawn: live.length,
        drafts_cleared: decision.draftIdsToClear,
        live_applications: decision.blockingApplicationIds,
        forced: Boolean(input.force),
        reason,
      },
    });
    return buildConsentStatus(await this.loadRecords(input.userId));
  }

  /** One pending consent-withdrawal request per consent; the privacy team completes it (see DataRightsService). */
  private async openWithdrawalRequest(userId: string, code: ConsentCode, reason: string | null) {
    const pending = await this.prisma.dataRightsRequest.findFirst({
      where: {
        userId,
        kind: DataRightsRequestKind.consent_withdrawal,
        consentCode: code,
        status: { in: PENDING_DATA_RIGHTS_STATUSES },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (pending) return pending;
    const created = await this.prisma.dataRightsRequest.create({
      data: {
        userId,
        kind: DataRightsRequestKind.consent_withdrawal,
        consentCode: code,
        details: reason,
        dueAt: dataRightsDueAt(),
      },
    });
    await this.activity.log({
      actorUserId: userId,
      entityType: 'data_rights_request',
      entityId: created.id,
      action: 'data_rights_requested',
      toValue: DataRightsRequestKind.consent_withdrawal,
      metadata: { consent_code: code, origin: 'consent_withdrawal_blocked', due_at: created.dueAt?.toISOString() },
    });
    return created;
  }

  /** Ops read: the applicant's account-level consent status, scoped exactly like the application. */
  async statusForApplication(user: User, applicationId: string): Promise<ConsentStatusDto> {
    const app = await this.prisma.application.findUnique({
      where: { id: applicationId },
      select: { id: true, customerUserId: true, companyId: true },
    });
    if (!app) throw new NotFoundException('application_not_found');
    await assertApplicationCanView(this.prisma, user, app);
    return buildConsentStatus(await this.loadRecords(app.customerUserId));
  }

  private loadRecords(userId: string) {
    return this.prisma.consentRecord.findMany({
      where: { userId },
      include: { actor: { select: { name: true } } },
      orderBy: { acceptedAt: 'desc' },
    });
  }

  private async assertOwnedApplication(userId: string, applicationId: string) {
    const app = await this.prisma.application.findUnique({
      where: { id: applicationId },
      select: { id: true, customerUserId: true },
    });
    if (!app || app.customerUserId !== userId) throw new NotFoundException('application_not_found');
    return app;
  }

  /** Stamp `consentsCompletedAt` once, only on the owner's not-yet-(re)submitted application. */
  private async stampApplication(userId: string, applicationId: string) {
    const result = await this.prisma.application.updateMany({
      where: {
        id: applicationId,
        customerUserId: userId,
        consentsCompletedAt: null,
        status: { in: CONSENT_STAMPABLE_STATUSES },
      },
      data: { consentsCompletedAt: new Date() },
    });
    if (result.count > 0) {
      await this.activity.log({
        actorUserId: userId,
        entityType: 'application',
        entityId: applicationId,
        action: 'consents_completed',
        toValue: CONSENT_CATALOG_VERSION,
      });
    }
  }
}
