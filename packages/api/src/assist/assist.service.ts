import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApplicationStatus, AssistedSession, AssistedSessionStatus, Prisma, User, UserRole } from '@prisma/client';
import { maskPhone } from '@drivemarket/shared/domain-rules';
import type {
  AssistedSessionDto,
  AssistedSessionPublicDto,
  CompanyBrandingDto,
  ConsentStatusDto,
} from '../../../shared/src/types/customer-platform';
import { resolveAuthSecret } from '../auth/auth-config';
import { ActivityService } from '../common/activity.service';
import { generateOtp, hashOtp, OTP_POLICY, otpMatches, otpResendGate } from '../common/otp';
import { AppConfigService } from '../config/app-config.service';
import type { ConsentAcceptanceInput } from '../consents/consent-logic';
import { ConsentsService } from '../consents/consents.service';
import { KycBridgeService } from '../kyc/kyc-bridge.service';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { normalizePhone, SmsService, type SmsKind } from '../sms/sms.service';
import {
  advanceAssistStatus,
  assistProofMatches,
  effectiveAssistStatus,
  evaluateOtpAttempt,
  generateAssistProof,
  generateAssistToken,
  hashAssistProof,
  isAssistSessionOpen,
  issuedOtpPatch,
  OPEN_ASSIST_STATUSES,
  verifiedOtpPatch,
} from './assist-logic';

const sessionInclude = {
  application: {
    select: {
      id: true,
      companyId: true,
      customerUserId: true,
      status: true,
      consentsCompletedAt: true,
      pricingSnapshot: true,
      product: { select: { make: true, model: true, modelYear: true } },
      company: { select: { name: true, logoUrl: true, branding: true } },
    },
  },
  customer: { select: { id: true, name: true, email: true, preferredLanguage: true } },
  createdBy: { select: { id: true, name: true } },
} satisfies Prisma.AssistedSessionInclude;

type SessionWithRelations = Prisma.AssistedSessionGetPayload<{ include: typeof sessionInclude }>;

/** No assisted journey can start on an application that is already over. */
const CLOSED_APPLICATION_STATUSES: ApplicationStatus[] = [
  ApplicationStatus.completed,
  ApplicationStatus.rejected,
  ApplicationStatus.submission_cancelled,
];

export type CreateAssistedSessionInput = { applicationId: string; phone: string; email?: string | null };
export type AssistConsentsInput = { acceptances: ConsentAcceptanceInput[]; locale: string };
export type AssistRequestMeta = { ipAddress: string | null; userAgent: string | null };

function cleanString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function numberOrNull(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim()) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** Company branding JSON (snake_case or camelCase keys) → wire DTO, falling back to the company record. */
export function brandingFromCompany(company: {
  name: string;
  logoUrl: string | null;
  branding: Prisma.JsonValue | null;
}): CompanyBrandingDto {
  const raw =
    company.branding && typeof company.branding === 'object' && !Array.isArray(company.branding)
      ? (company.branding as Record<string, unknown>)
      : {};
  return {
    primary: cleanString(raw.primary),
    accent: cleanString(raw.accent),
    logo_url: cleanString(raw.logo_url ?? raw.logoUrl) ?? company.logoUrl ?? null,
    display_name: cleanString(raw.display_name ?? raw.displayName) ?? company.name,
    tagline: cleanString(raw.tagline),
  };
}

/**
 * Sales-executive assisted journey (LOS FSD Stage 1): staff start a session,
 * the customer verifies an OTP on their own phone, accepts the consents and
 * starts identity verification. Everything after the OTP is guarded by a
 * browser proof; the OTP itself and the unmasked phone never leave the API.
 */
@Injectable()
export class AssistService {
  private readonly logger = new Logger(AssistService.name);
  private readonly secret: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityService,
    private readonly consents: ConsentsService,
    private readonly kycBridge: KycBridgeService,
    private readonly sms: SmsService,
    private readonly mail: MailService,
    private readonly appConfig: AppConfigService,
    config: ConfigService,
  ) {
    this.secret = resolveAuthSecret(config);
  }

  // ---- Staff (dealer_agent own company, admin, super_admin) ----

  async create(user: User, input: CreateAssistedSessionInput): Promise<AssistedSessionDto> {
    const app = await this.prisma.application.findUnique({
      where: { id: input.applicationId },
      select: {
        id: true,
        companyId: true,
        customerUserId: true,
        status: true,
        company: { select: { name: true } },
      },
    });
    if (!app) throw new NotFoundException('application_not_found');
    this.assertStaffScope(user, app);
    if (CLOSED_APPLICATION_STATUSES.includes(app.status)) throw new ConflictException('application_closed');

    const phone = normalizePhone(input.phone);
    if (!phone) throw new BadRequestException('phone_invalid');
    const email = input.email?.trim().toLowerCase() || null;

    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.appConfig.assistSessionTtlMinutes * 60_000);

    // One live session per application: a new link supersedes any open one.
    await this.prisma.assistedSession.updateMany({
      where: { applicationId: app.id, status: { in: [...OPEN_ASSIST_STATUSES] } },
      data: { status: AssistedSessionStatus.cancelled },
    });

    const created = await this.prisma.assistedSession.create({
      data: {
        token: generateAssistToken(),
        applicationId: app.id,
        customerUserId: app.customerUserId,
        createdByUserId: user.id,
        phone,
        email,
        expiresAt,
      },
    });
    const code = generateOtp();
    const session = await this.prisma.assistedSession.update({
      where: { id: created.id },
      data: issuedOtpPatch(hashOtp(this.secret, created.id, code), now),
      include: sessionInclude,
    });

    const link = this.linkFor(session.token);
    await this.deliverSms(session, code, link, 'assist_link');
    if (email) {
      await this.mail.sendAssistedSessionEmail({
        to: email,
        url: link,
        dealerName: app.company.name,
        agentName: user.name,
        expiresAt,
      });
    }

    await this.activity.log({
      actorUserId: user.id,
      entityType: 'assisted_session',
      entityId: session.id,
      action: 'assisted_session_created',
      toValue: session.status,
      metadata: { application_id: app.id, phone_masked: maskPhone(phone), email_sent: Boolean(email) },
    });
    return this.toDto(session, link);
  }

  async list(user: User, applicationId: string): Promise<AssistedSessionDto[]> {
    const app = await this.prisma.application.findUnique({
      where: { id: applicationId },
      select: { id: true, companyId: true },
    });
    if (!app) throw new NotFoundException('application_not_found');
    this.assertStaffScope(user, app);
    const sessions = await this.prisma.assistedSession.findMany({
      where: { applicationId: app.id },
      orderBy: { createdAt: 'desc' },
    });
    return sessions.map((s) => this.toDto(s));
  }

  async resend(user: User, id: string): Promise<AssistedSessionDto> {
    const session = await this.staffSession(user, id);
    await this.assertOpen(session);
    const { session: updated, link } = await this.issueNewCode(session, user.id);
    return this.toDto(updated, link);
  }

  async cancel(user: User, id: string): Promise<AssistedSessionDto> {
    const session = await this.staffSession(user, id);
    if (session.status === AssistedSessionStatus.completed) throw new ConflictException('assist_session_closed');
    if (!isAssistSessionOpen(session.status)) return this.toDto(session);
    const updated = await this.prisma.assistedSession.update({
      where: { id: session.id },
      data: { status: AssistedSessionStatus.cancelled },
    });
    await this.activity.log({
      actorUserId: user.id,
      entityType: 'assisted_session',
      entityId: session.id,
      action: 'assisted_session_cancelled',
      fromValue: session.status,
      toValue: AssistedSessionStatus.cancelled,
      metadata: { application_id: session.applicationId },
    });
    return this.toDto(updated);
  }

  // ---- Public (token link on the customer's device) ----

  async publicView(token: string): Promise<AssistedSessionPublicDto> {
    const session = await this.byToken(token);
    const now = new Date();
    const status = effectiveAssistStatus(session, now);
    await this.prisma.assistedSession.update({
      where: { id: session.id },
      data: { lastOpenedAt: now, ...(status !== session.status ? { status } : {}) },
    });
    return this.toPublicDto(session, status);
  }

  async verifyOtp(token: string, code: string): Promise<{ proof: string; status: AssistedSessionStatus }> {
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
        await this.prisma.assistedSession.update({ where: { id: session.id }, data: result.patch });
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
        const status = advanceAssistStatus(session.status, AssistedSessionStatus.otp_verified);
        await this.prisma.assistedSession.update({
          where: { id: session.id },
          data: { ...verifiedOtpPatch(hashAssistProof(proof), now), status },
        });
        await this.activity.log({
          actorUserId: session.customerUserId,
          entityType: 'assisted_session',
          entityId: session.id,
          action: 'assisted_otp_verified',
          fromValue: session.status,
          toValue: status,
          metadata: { application_id: session.applicationId },
        });
        return { proof, status };
      }
    }
  }

  async resendPublic(token: string): Promise<{ status: AssistedSessionStatus; otp_expires_in_sec: number }> {
    const session = await this.openSession(token);
    const { session: updated } = await this.issueNewCode(session, session.customerUserId);
    return { status: effectiveAssistStatus(updated), otp_expires_in_sec: OTP_POLICY.ttlMs / 1000 };
  }

  async recordConsents(
    token: string,
    proof: string | string[] | undefined,
    input: AssistConsentsInput,
    meta: AssistRequestMeta,
  ): Promise<ConsentStatusDto> {
    const session = await this.provenSession(token, proof);
    const status = await this.consents.record({
      userId: session.customerUserId,
      acceptances: input.acceptances,
      locale: input.locale,
      applicationId: session.applicationId,
      channel: 'assisted',
      actorUserId: session.createdByUserId,
      sessionId: session.id,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
    if (status.complete) {
      await this.prisma.assistedSession.update({
        where: { id: session.id },
        data: {
          consentsCompletedAt: session.consentsCompletedAt ?? new Date(),
          status: advanceAssistStatus(session.status, AssistedSessionStatus.consents_done),
        },
      });
    }
    return status;
  }

  async startIdentity(
    token: string,
    proof: string | string[] | undefined,
  ): Promise<{ kyc_url: string; status: AssistedSessionStatus }> {
    const session = await this.provenSession(token, proof);
    // Biometric capture needs the kyc_biometric consent first.
    if (!session.consentsCompletedAt && !session.application.consentsCompletedAt) {
      throw new ConflictException('consents_required');
    }
    const customer = await this.prisma.user.findUnique({ where: { id: session.customerUserId } });
    if (!customer) throw new NotFoundException('customer_not_found');

    const kyc = await this.kycBridge.ensureSession(customer, session.applicationId);
    const status = advanceAssistStatus(session.status, AssistedSessionStatus.identity_started);
    await this.prisma.assistedSession.update({
      where: { id: session.id },
      data: { identityStartedAt: session.identityStartedAt ?? new Date(), status },
    });
    await this.activity.log({
      actorUserId: session.customerUserId,
      entityType: 'assisted_session',
      entityId: session.id,
      action: 'assisted_identity_started',
      fromValue: session.status,
      toValue: status,
      metadata: { application_id: session.applicationId, kyc_case_id: kyc.case_id },
    });
    return { kyc_url: kyc.invite_url, status };
  }

  async complete(token: string, proof: string | string[] | undefined): Promise<{ status: AssistedSessionStatus }> {
    const session = await this.provenSession(token, proof);
    if (
      session.status !== AssistedSessionStatus.consents_done &&
      session.status !== AssistedSessionStatus.identity_started
    ) {
      throw new ConflictException('assist_session_incomplete');
    }
    const now = new Date();
    await this.prisma.assistedSession.update({
      where: { id: session.id },
      data: { status: AssistedSessionStatus.completed, completedAt: now },
    });
    await this.activity.log({
      actorUserId: session.customerUserId,
      entityType: 'assisted_session',
      entityId: session.id,
      action: 'assisted_session_completed',
      fromValue: session.status,
      toValue: AssistedSessionStatus.completed,
      metadata: { application_id: session.applicationId },
    });
    await this.activity.notify(
      session.createdByUserId,
      'Assisted session completed',
      `${session.customer.name} finished the OTP, consent and identity steps on their device.`,
      `/applications/${session.applicationId}`,
    );
    return { status: AssistedSessionStatus.completed };
  }

  // ---- Internals ----

  private async issueNewCode(
    session: SessionWithRelations,
    actorUserId: string,
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
    const updated = await this.prisma.assistedSession.update({
      where: { id: session.id },
      data: {
        ...issuedOtpPatch(hashOtp(this.secret, session.id, code), now),
        otpResendCount: gate.next.otpResendCount,
        otpResendWindowStart: gate.next.otpResendWindowStart,
      },
      include: sessionInclude,
    });
    const link = this.linkFor(updated.token);
    await this.deliverSms(updated, code, link, 'assist_otp');
    await this.activity.log({
      actorUserId,
      entityType: 'assisted_session',
      entityId: session.id,
      action: 'assisted_otp_resent',
      metadata: { application_id: session.applicationId, resend_count: gate.next.otpResendCount },
    });
    return { session: updated, link };
  }

  private async byToken(token: string): Promise<SessionWithRelations> {
    const value = token?.trim();
    if (!value || value.length > 128) throw new NotFoundException('assist_session_not_found');
    const session = await this.prisma.assistedSession.findUnique({ where: { token: value }, include: sessionInclude });
    if (!session) throw new NotFoundException('assist_session_not_found');
    return session;
  }

  /** Loads by token and refuses expired/cancelled/completed sessions, persisting a lazy expiry. */
  private async openSession(token: string): Promise<SessionWithRelations> {
    const session = await this.byToken(token);
    await this.assertOpen(session);
    return session;
  }

  private async assertOpen(session: Pick<AssistedSession, 'id' | 'status' | 'expiresAt'>): Promise<void> {
    const status = effectiveAssistStatus(session);
    if (status === AssistedSessionStatus.expired) {
      if (session.status !== AssistedSessionStatus.expired) {
        await this.prisma.assistedSession.update({
          where: { id: session.id },
          data: { status: AssistedSessionStatus.expired },
        });
      }
      throw new ConflictException('assist_session_expired');
    }
    if (!isAssistSessionOpen(status)) throw new ConflictException('assist_session_closed');
  }

  private async provenSession(token: string, proof: string | string[] | undefined): Promise<SessionWithRelations> {
    const session = await this.openSession(token);
    if (!assistProofMatches(proof, session.proofHash)) throw new UnauthorizedException('assist_proof_invalid');
    return session;
  }

  private async staffSession(user: User, id: string): Promise<SessionWithRelations> {
    const session = await this.prisma.assistedSession.findUnique({ where: { id }, include: sessionInclude });
    if (!session) throw new NotFoundException('assist_session_not_found');
    this.assertStaffScope(user, session.application);
    return session;
  }

  /** Dealer agents only see their own company's applications; out of scope reads as not found. */
  private assertStaffScope(user: User, app: { companyId: string }): void {
    if (user.role === UserRole.dealer_agent && user.companyId !== app.companyId) {
      throw new NotFoundException('application_not_found');
    }
  }

  private linkFor(token: string): string {
    return this.appConfig.marketplacePath(`/assist/${token}`);
  }

  private async deliverSms(session: SessionWithRelations, code: string, link: string, kind: SmsKind): Promise<void> {
    const dealerName = session.application.company.name;
    const body =
      kind === 'assist_link'
        ? `${dealerName} started your Blox vehicle financing application. Open ${link} and enter code ${code} (valid 5 minutes). Do not share this code.`
        : `Your Blox verification code is ${code} (valid 5 minutes). Continue here: ${link}`;
    try {
      await this.sms.send({ to: session.phone, body, kind });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Assisted-session SMS failed session=${session.id} kind=${kind}: ${message}`);
      if (this.sms.isLive) throw new HttpException('sms_delivery_failed', HttpStatus.BAD_GATEWAY);
    }
  }

  private toDto(session: AssistedSession, link?: string): AssistedSessionDto {
    return {
      id: session.id,
      application_id: session.applicationId,
      status: effectiveAssistStatus(session),
      phone_masked: maskPhone(session.phone),
      expires_at: session.expiresAt.toISOString(),
      last_opened_at: session.lastOpenedAt?.toISOString() ?? null,
      otp_verified_at: session.otpVerifiedAt?.toISOString() ?? null,
      consents_completed_at: session.consentsCompletedAt?.toISOString() ?? null,
      identity_started_at: session.identityStartedAt?.toISOString() ?? null,
      completed_at: session.completedAt?.toISOString() ?? null,
      ...(link ? { link } : {}),
      created_at: session.createdAt.toISOString(),
    };
  }

  private toPublicDto(session: SessionWithRelations, status: AssistedSessionStatus): AssistedSessionPublicDto {
    const pricing =
      session.application.pricingSnapshot && typeof session.application.pricingSnapshot === 'object'
        ? (session.application.pricingSnapshot as Record<string, unknown>)
        : {};
    const product = session.application.product;
    return {
      status,
      phone_masked: maskPhone(session.phone),
      dealer_name: session.application.company.name ?? null,
      agent_name: session.createdBy.name ?? null,
      vehicle: product ? { make: product.make, model: product.model, model_year: product.modelYear ?? null } : null,
      plan: {
        tenure_months: numberOrNull(pricing.tenor ?? pricing.tenure),
        down_payment_pct: numberOrNull(pricing.down_payment_pct),
        monthly: numberOrNull(pricing.monthly),
      },
      branding: brandingFromCompany(session.application.company),
      expires_at: session.expiresAt.toISOString(),
      consent_locale: session.customer.preferredLanguage === 'ar' ? 'ar' : 'en',
      kyc_url: null,
    };
  }
}
