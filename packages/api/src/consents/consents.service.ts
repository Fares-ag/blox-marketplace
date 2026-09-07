import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ApplicationStatus, ConsentChannel, Prisma, User } from '@prisma/client';
import { CONSENT_CATALOG_VERSION } from '@drivemarket/shared/domain-rules';
import type { ConsentStatusDto } from '../../../shared/src/types/customer-platform';
import { assertApplicationCanView } from '../applications/application-access';
import { ActivityService } from '../common/activity.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  buildConsentStatus,
  consentTextHash,
  normalizeConsentLocale,
  validateAcceptances,
  type ConsentAcceptanceInput,
} from './consent-logic';

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
