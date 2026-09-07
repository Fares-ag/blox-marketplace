import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApplicationStatus, GuarantorSessionStatus, Prisma, User, UserRole } from '@prisma/client';
import { maskPhone } from '@drivemarket/shared/domain-rules';
import type {
  GuarantorSessionDto,
  GuarantorSessionPublicDto,
} from '../../../shared/src/types/customer-platform';
import { assertCompanyScopeForRead } from '../applications/company-scope';
import {
  assistProofMatches,
  evaluateOtpAttempt,
  generateAssistProof,
  generateAssistToken,
  hashAssistProof,
  issuedOtpPatch,
  verifiedOtpPatch,
} from '../assist/assist-logic';
import { resolveAuthSecret } from '../auth/auth-config';
import { ActivityService } from '../common/activity.service';
import { EncryptionService } from '../common/encryption.service';
import { generateOtp, hashOtp, OTP_POLICY, otpMatches, otpResendGate } from '../common/otp';
import { AppConfigService } from '../config/app-config.service';
import { KycPlatformClient } from '../kyc/kyc-platform.client';
import { PrismaService } from '../prisma/prisma.service';
import { normalizePhone, SmsService, type SmsKind } from '../sms/sms.service';
import {
  advanceGuarantorStatus,
  buildGuarantorAcceptances,
  effectiveGuarantorStatus,
  guarantorFromSnapshot,
  guarantorSmsBody,
  isGuarantorSessionOpen,
  OPEN_GUARANTOR_STATUSES,
  toGuarantorSessionDto,
  toGuarantorSessionPublicDto,
  validateGuarantorAcceptances,
  type GuarantorAcceptanceInput,
  type GuarantorConsentCode,
  type GuarantorSmsKind,
} from './guarantor-logic';

const sessionInclude = {
  application: {
    select: {
      id: true,
      companyId: true,
      customerUserId: true,
      status: true,
      product: { select: { make: true, model: true, modelYear: true } },
      company: { select: { name: true } },
      customer: { select: { id: true, name: true, preferredLanguage: true } },
    },
  },
  createdBy: { select: { id: true, name: true, role: true } },
} satisfies Prisma.GuarantorConsentSessionInclude;

type SessionWithRelations = Prisma.GuarantorConsentSessionGetPayload<{ include: typeof sessionInclude }>;

/** No guarantor journey can start on an application that is already over. */
const CLOSED_APPLICATION_STATUSES: ApplicationStatus[] = [
  ApplicationStatus.completed,
  ApplicationStatus.rejected,
  ApplicationStatus.submission_cancelled,
];

type ApplicationRef = {
  id: string;
  companyId: string;
  customerUserId: string;
  status: ApplicationStatus;
  customerSnapshot: Prisma.JsonValue;
  company: { name: string };
  customer: { name: string | null };
};

export type GuarantorConsentsInput = { acceptances: GuarantorAcceptanceInput[]; locale: string };
export type GuarantorRequestMeta = { ipAddress: string | null; userAgent: string | null };

const SMS_KIND: Record<GuarantorSmsKind, SmsKind> = { link: 'assist_link', otp: 'assist_otp' };

/**
 * Guarantor consent sessions (LOS FSD guarantor gate): the applicant or a
 * staff member sends the guarantor a link; the guarantor verifies an OTP on
 * their own phone, accepts their consents and may complete identity
 * verification. Everything after the OTP is guarded by a browser proof; the
 * OTP itself and the unmasked phone never leave the API.
 */
@Injectable()
export class GuarantorsService {
  private readonly logger = new Logger(GuarantorsService.name);
  private readonly secret: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityService,
    private readonly encryption: EncryptionService,
    private readonly kyc: KycPlatformClient,
    private readonly sms: SmsService,
    private readonly appConfig: AppConfigService,
    config: ConfigService,
  ) {
    this.secret = resolveAuthSecret(config);
  }

  // ---- Applicant (owner) and staff (dealer_agent own company, credit_officer in scope, admin, super_admin) ----

  async create(user: User, applicationId: string): Promise<GuarantorSessionDto> {
    const app = await this.scopedApplication(user, applicationId);
    if (CLOSED_APPLICATION_STATUSES.includes(app.status)) throw new ConflictException('application_closed');
    const guarantor = guarantorFromSnapshot(app.customerSnapshot);
    if (!guarantor) throw new BadRequestException('guarantor_not_declared');
    const phone = normalizePhone(guarantor.phone);
    if (!phone) throw new BadRequestException('phone_invalid');

    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.appConfig.assistSessionTtlMinutes * 60_000);

    // One live guarantor link per application: a new request supersedes any open one.
    const superseded = await this.prisma.guarantorConsentSession.updateMany({
      where: { applicationId: app.id, status: { in: [...OPEN_GUARANTOR_STATUSES] } },
      data: { status: GuarantorSessionStatus.cancelled },
    });

    const created = await this.prisma.guarantorConsentSession.create({
      data: {
        token: generateAssistToken(),
        applicationId: app.id,
        createdByUserId: user.id,
        fullName: guarantor.fullName,
        phone,
        email: guarantor.email,
        qidHash: this.encryption.qidHash(guarantor.qid),
        relationship: guarantor.relationship,
        expiresAt,
      },
    });
    const code = generateOtp();
    const session = await this.prisma.guarantorConsentSession.update({
      where: { id: created.id },
      data: issuedOtpPatch(hashOtp(this.secret, created.id, code), now),
      include: sessionInclude,
    });

    const link = this.linkFor(session.token);
    await this.deliverSms(session, code, link, 'link');
    await this.activity.log({
      actorUserId: user.id,
      entityType: 'guarantor_session',
      entityId: session.id,
      action: 'guarantor_session_created',
      toValue: session.status,
      metadata: {
        application_id: app.id,
        phone_masked: maskPhone(phone),
        relationship: guarantor.relationship,
        superseded: superseded.count,
      },
    });
    return toGuarantorSessionDto(session, link, now);
  }

  /** The latest session for the application (a new request supersedes the previous one), or null. */
  async current(user: User, applicationId: string): Promise<GuarantorSessionDto | null> {
    const app = await this.scopedApplication(user, applicationId);
    const session = await this.latest(app.id);
    return session ? toGuarantorSessionDto(session) : null;
  }

  async resend(user: User, applicationId: string): Promise<GuarantorSessionDto> {
    const app = await this.scopedApplication(user, applicationId);
    const session = await this.latest(app.id);
    if (!session) throw new NotFoundException('guarantor_session_not_found');
    await this.assertOpen(session);
    const { session: updated, link } = await this.issueNewCode(session, user.id);
    return toGuarantorSessionDto(updated, link);
  }

  async cancel(user: User, applicationId: string): Promise<GuarantorSessionDto> {
    const app = await this.scopedApplication(user, applicationId);
    const session = await this.latest(app.id);
    if (!session) throw new NotFoundException('guarantor_session_not_found');
    if (session.status === GuarantorSessionStatus.completed) throw new ConflictException('guarantor_session_closed');
    if (!isGuarantorSessionOpen(session.status)) return toGuarantorSessionDto(session);
    const updated = await this.prisma.guarantorConsentSession.update({
      where: { id: session.id },
      data: { status: GuarantorSessionStatus.cancelled },
    });
    await this.activity.log({
      actorUserId: user.id,
      entityType: 'guarantor_session',
      entityId: session.id,
      action: 'guarantor_session_cancelled',
      fromValue: session.status,
      toValue: GuarantorSessionStatus.cancelled,
      metadata: { application_id: session.applicationId },
    });
    return toGuarantorSessionDto(updated);
  }

  // ---- Public (token link on the guarantor's device) ----

  async publicView(token: string): Promise<GuarantorSessionPublicDto> {
    const session = await this.byToken(token);
    const now = new Date();
    const status = effectiveGuarantorStatus(session, now);
    await this.prisma.guarantorConsentSession.update({
      where: { id: session.id },
      data: { lastOpenedAt: now, ...(status !== session.status ? { status } : {}) },
    });
    return this.toPublicDto(session, status);
  }

  async verifyOtp(token: string, code: string): Promise<{ proof: string; status: GuarantorSessionStatus }> {
    const session = await this.openSession(token);
    const now = new Date();
    const matches = Boolean(session.otpCodeHash) && otpMatches(this.secret, session.id, code, session.otpCodeHash!);
    const result = evaluateOtpAttempt(session, matches, now);

    switch (result.outcome) {
      case 'locked':
        throw new HttpException(
          { message: 'otp_locked', retry_after_sec: result.retryAfterSec },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      case 'expired':
        throw new BadRequestException('otp_expired');
      case 'not_issued':
        throw new BadRequestException('otp_not_issued');
      case 'invalid': {
        await this.prisma.guarantorConsentSession.update({ where: { id: session.id }, data: result.patch });
        if (result.lockedForSec) {
          throw new HttpException(
            { message: 'otp_locked', retry_after_sec: result.lockedForSec },
            HttpStatus.TOO_MANY_REQUESTS,
          );
        }
        throw new BadRequestException({ message: 'otp_invalid', remaining: result.remaining });
      }
      case 'verified': {
        const proof = generateAssistProof();
        const status = advanceGuarantorStatus(session.status, GuarantorSessionStatus.otp_verified);
        await this.prisma.guarantorConsentSession.update({
          where: { id: session.id },
          data: { ...verifiedOtpPatch(hashAssistProof(proof), now), status },
        });
        await this.activity.log({
          actorUserId: null,
          entityType: 'guarantor_session',
          entityId: session.id,
          action: 'guarantor_otp_verified',
          fromValue: session.status,
          toValue: status,
          metadata: { application_id: session.applicationId },
        });
        return { proof, status };
      }
    }
  }

  async resendPublic(token: string): Promise<{ status: GuarantorSessionStatus; otp_expires_in_sec: number }> {
    const session = await this.openSession(token);
    const { session: updated } = await this.issueNewCode(session, null);
    return { status: effectiveGuarantorStatus(updated), otp_expires_in_sec: OTP_POLICY.ttlMs / 1000 };
  }

  /** All three guarantor consents in one call; the hashed text, IP and user agent are kept on the session. */
  async recordConsents(
    token: string,
    proof: string | string[] | undefined,
    input: GuarantorConsentsInput,
    meta: GuarantorRequestMeta,
  ): Promise<{ status: GuarantorSessionStatus; consents_completed_at: string; accepted: GuarantorConsentCode[] }> {
    const session = await this.provenSession(token, proof);
    const validation = validateGuarantorAcceptances(input.acceptances);
    if (!validation.ok) {
      if (validation.error === 'guarantor_consents_incomplete') {
        throw new BadRequestException({ message: validation.error, missing: validation.missing });
      }
      throw new BadRequestException({ message: validation.error, consent_code: validation.code });
    }

    const now = new Date();
    const acceptances = buildGuarantorAcceptances(validation.accepted, input.locale, now);
    const completedAt = session.consentsCompletedAt ?? now;
    const status = advanceGuarantorStatus(session.status, GuarantorSessionStatus.consents_done);
    await this.prisma.guarantorConsentSession.update({
      where: { id: session.id },
      data: {
        acceptances: acceptances as unknown as Prisma.InputJsonValue,
        consentsCompletedAt: completedAt,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent ? meta.userAgent.slice(0, 512) : null,
        status,
      },
    });
    await this.activity.log({
      actorUserId: session.createdByUserId,
      entityType: 'guarantor_session',
      entityId: session.id,
      action: 'guarantor_consents_recorded',
      fromValue: session.status,
      toValue: status,
      metadata: {
        application_id: session.applicationId,
        codes: acceptances.map((a) => a.code),
        locale: acceptances[0]?.locale ?? 'en',
      },
    });
    return { status, consents_completed_at: completedAt.toISOString(), accepted: acceptances.map((a) => a.code) };
  }

  /** Optional identity verification on the KYC platform; the case is keyed `guarantor:<sessionId>`. */
  async startIdentity(
    token: string,
    proof: string | string[] | undefined,
  ): Promise<{ kyc_url: string; status: GuarantorSessionStatus }> {
    const session = await this.provenSession(token, proof);
    if (!session.consentsCompletedAt) throw new ConflictException('consents_required');
    if (!this.kyc.configured()) throw new BadRequestException('kyc_not_configured');

    const externalRef = `guarantor:${session.id}`;
    let caseId = session.kycCaseId;
    let inviteUrl: string;
    try {
      if (!caseId) {
        const existing = await this.kyc.findCaseByExternalRef(externalRef);
        if (existing) {
          caseId = existing.id;
        } else {
          const created = await this.kyc.createCase({
            externalRef,
            fullName: session.fullName,
            email: session.email ?? undefined,
            phone: session.phone,
          });
          caseId = created.id;
        }
      }
      inviteUrl = (await this.kyc.createInvite(caseId)).invite_url;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Guarantor KYC start failed session=${session.id}: ${message}`);
      throw new HttpException('kyc_unavailable', HttpStatus.BAD_GATEWAY);
    }

    await this.prisma.guarantorConsentSession.update({
      where: { id: session.id },
      data: { kycCaseId: caseId, kycInviteUrl: inviteUrl, kycStatus: session.kycStatus ?? 'invited' },
    });
    await this.activity.log({
      actorUserId: session.createdByUserId,
      entityType: 'guarantor_session',
      entityId: session.id,
      action: 'guarantor_identity_started',
      metadata: { application_id: session.applicationId, kyc_case_id: caseId },
    });
    return { kyc_url: inviteUrl, status: session.status };
  }

  async complete(token: string, proof: string | string[] | undefined): Promise<{ status: GuarantorSessionStatus }> {
    const session = await this.provenSession(token, proof);
    if (session.status !== GuarantorSessionStatus.consents_done) {
      throw new ConflictException('guarantor_session_incomplete');
    }
    const now = new Date();
    await this.prisma.guarantorConsentSession.update({
      where: { id: session.id },
      data: { status: GuarantorSessionStatus.completed, completedAt: now },
    });
    await this.activity.log({
      actorUserId: session.createdByUserId,
      entityType: 'guarantor_session',
      entityId: session.id,
      action: 'guarantor_session_completed',
      fromValue: session.status,
      toValue: GuarantorSessionStatus.completed,
      metadata: { application_id: session.applicationId, kyc_started: Boolean(session.kycCaseId) },
    });

    const applicantId = session.application.customerUserId;
    await this.activity.notify(
      applicantId,
      'Guarantor consent received',
      `${session.fullName} accepted the guarantor consents for your application. You can continue to submit it.`,
      `/app/applications/${session.applicationId}`,
    );
    if (session.createdByUserId && session.createdByUserId !== applicantId) {
      await this.activity.notify(
        session.createdByUserId,
        'Guarantor consent received',
        `${session.fullName} finished the guarantor consent step for ${session.application.customer.name ?? 'the applicant'}.`,
        `/applications/${session.applicationId}`,
      );
    }
    return { status: GuarantorSessionStatus.completed };
  }

  // ---- Internals ----

  private async issueNewCode(
    session: SessionWithRelations,
    actorUserId: string | null,
  ): Promise<{ session: SessionWithRelations; link: string }> {
    const now = new Date();
    const gate = otpResendGate(session, now);
    if (!gate.ok) {
      throw new HttpException(
        { message: 'otp_resend_limit', retry_after_sec: Math.max(1, Math.ceil(gate.retryAfterMs / 1000)) },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    const code = generateOtp();
    const updated = await this.prisma.guarantorConsentSession.update({
      where: { id: session.id },
      data: {
        ...issuedOtpPatch(hashOtp(this.secret, session.id, code), now),
        otpResendCount: gate.next.otpResendCount,
        otpResendWindowStart: gate.next.otpResendWindowStart,
      },
      include: sessionInclude,
    });
    const link = this.linkFor(updated.token);
    await this.deliverSms(updated, code, link, 'otp');
    await this.activity.log({
      actorUserId,
      entityType: 'guarantor_session',
      entityId: session.id,
      action: 'guarantor_otp_resent',
      metadata: { application_id: session.applicationId, resend_count: gate.next.otpResendCount },
    });
    return { session: updated, link };
  }

  private async latest(applicationId: string): Promise<SessionWithRelations | null> {
    return this.prisma.guarantorConsentSession.findFirst({
      where: { applicationId },
      orderBy: { createdAt: 'desc' },
      include: sessionInclude,
    });
  }

  private async byToken(token: string): Promise<SessionWithRelations> {
    const value = token?.trim();
    if (!value || value.length > 128) throw new NotFoundException('guarantor_session_not_found');
    const session = await this.prisma.guarantorConsentSession.findUnique({
      where: { token: value },
      include: sessionInclude,
    });
    if (!session) throw new NotFoundException('guarantor_session_not_found');
    return session;
  }

  /** Loads by token and refuses expired/cancelled/completed sessions, persisting a lazy expiry. */
  private async openSession(token: string): Promise<SessionWithRelations> {
    const session = await this.byToken(token);
    await this.assertOpen(session);
    return session;
  }

  private async assertOpen(session: { id: string; status: GuarantorSessionStatus; expiresAt: Date }): Promise<void> {
    const status = effectiveGuarantorStatus(session);
    if (status === GuarantorSessionStatus.expired) {
      if (session.status !== GuarantorSessionStatus.expired) {
        await this.prisma.guarantorConsentSession.update({
          where: { id: session.id },
          data: { status: GuarantorSessionStatus.expired },
        });
      }
      throw new ConflictException('guarantor_session_expired');
    }
    if (!isGuarantorSessionOpen(status)) throw new ConflictException('guarantor_session_closed');
  }

  private async provenSession(token: string, proof: string | string[] | undefined): Promise<SessionWithRelations> {
    const session = await this.openSession(token);
    if (!assistProofMatches(proof, session.proofHash)) throw new UnauthorizedException('assist_proof_invalid');
    return session;
  }

  /**
   * The applicant sees only their own application; dealer agents their own
   * company's; credit officers the companies in their scope. Out-of-scope
   * reads as not found so ids are not enumerable.
   */
  private async scopedApplication(user: User, applicationId: string): Promise<ApplicationRef> {
    const app = await this.prisma.application.findUnique({
      where: { id: applicationId },
      select: {
        id: true,
        companyId: true,
        customerUserId: true,
        status: true,
        customerSnapshot: true,
        company: { select: { name: true } },
        customer: { select: { name: true } },
      },
    });
    if (!app) throw new NotFoundException('application_not_found');
    switch (user.role) {
      case UserRole.customer:
        if (app.customerUserId !== user.id) throw new NotFoundException('application_not_found');
        break;
      case UserRole.dealer_agent:
        if (user.companyId !== app.companyId) throw new NotFoundException('application_not_found');
        break;
      case UserRole.admin:
      case UserRole.super_admin:
        break;
      case UserRole.credit_officer:
        await assertCompanyScopeForRead(this.prisma, user, app.companyId);
        break;
      default:
        throw new ForbiddenException('forbidden_role');
    }
    return app;
  }

  private linkFor(token: string): string {
    return this.appConfig.marketplacePath(`/guarantor/${token}`);
  }

  private async deliverSms(
    session: SessionWithRelations,
    code: string,
    link: string,
    kind: GuarantorSmsKind,
  ): Promise<void> {
    const body = guarantorSmsBody(kind, { applicantName: session.application.customer.name, link, code });
    try {
      await this.sms.send({ to: session.phone, body, kind: SMS_KIND[kind] });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Guarantor SMS failed session=${session.id} kind=${kind}: ${message}`);
      if (this.sms.isLive) throw new HttpException('sms_delivery_failed', HttpStatus.BAD_GATEWAY);
    }
  }

  private toPublicDto(session: SessionWithRelations, status: GuarantorSessionStatus): GuarantorSessionPublicDto {
    const product = session.application.product;
    return toGuarantorSessionPublicDto({
      session,
      status,
      applicantName: session.application.customer.name,
      dealerName: session.application.company.name ?? null,
      vehicle: product ? { make: product.make, model: product.model, modelYear: product.modelYear ?? null } : null,
      locale: session.application.customer.preferredLanguage,
    });
  }
}
