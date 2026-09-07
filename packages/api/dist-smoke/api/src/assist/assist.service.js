"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var AssistService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AssistService = void 0;
exports.brandingFromCompany = brandingFromCompany;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const client_1 = require("@prisma/client");
const domain_rules_1 = require("@drivemarket/shared/domain-rules");
const auth_config_1 = require("../auth/auth-config");
const activity_service_1 = require("../common/activity.service");
const otp_1 = require("../common/otp");
const app_config_service_1 = require("../config/app-config.service");
const consents_service_1 = require("../consents/consents.service");
const kyc_bridge_service_1 = require("../kyc/kyc-bridge.service");
const mail_service_1 = require("../mail/mail.service");
const notification_texts_1 = require("../notifications/notification-texts");
const prisma_service_1 = require("../prisma/prisma.service");
const sms_texts_1 = require("../sms/sms-texts");
const sms_service_1 = require("../sms/sms.service");
const assist_logic_1 = require("./assist-logic");
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
};
const CLOSED_APPLICATION_STATUSES = [
    client_1.ApplicationStatus.completed,
    client_1.ApplicationStatus.rejected,
    client_1.ApplicationStatus.submission_cancelled,
];
function cleanString(value) {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
}
function numberOrNull(value) {
    if (typeof value === 'number')
        return Number.isFinite(value) ? value : null;
    if (typeof value === 'string' && value.trim()) {
        const n = Number(value);
        return Number.isFinite(n) ? n : null;
    }
    return null;
}
function brandingFromCompany(company) {
    const raw = company.branding && typeof company.branding === 'object' && !Array.isArray(company.branding)
        ? company.branding
        : {};
    return {
        primary: cleanString(raw.primary),
        accent: cleanString(raw.accent),
        logo_url: cleanString(raw.logo_url ?? raw.logoUrl) ?? company.logoUrl ?? null,
        display_name: cleanString(raw.display_name ?? raw.displayName) ?? company.name,
        tagline: cleanString(raw.tagline),
    };
}
let AssistService = AssistService_1 = class AssistService {
    prisma;
    activity;
    consents;
    kycBridge;
    sms;
    mail;
    appConfig;
    logger = new common_1.Logger(AssistService_1.name);
    secret;
    constructor(prisma, activity, consents, kycBridge, sms, mail, appConfig, config) {
        this.prisma = prisma;
        this.activity = activity;
        this.consents = consents;
        this.kycBridge = kycBridge;
        this.sms = sms;
        this.mail = mail;
        this.appConfig = appConfig;
        this.secret = (0, auth_config_1.resolveAuthSecret)(config);
    }
    async create(user, input) {
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
        if (!app)
            throw new common_1.NotFoundException('application_not_found');
        this.assertStaffScope(user, app);
        if (CLOSED_APPLICATION_STATUSES.includes(app.status))
            throw new common_1.ConflictException('application_closed');
        const phone = (0, sms_service_1.normalizePhone)(input.phone);
        if (!phone)
            throw new common_1.BadRequestException('phone_invalid');
        const email = input.email?.trim().toLowerCase() || null;
        const now = new Date();
        const expiresAt = new Date(now.getTime() + this.appConfig.assistSessionTtlMinutes * 60_000);
        await this.prisma.assistedSession.updateMany({
            where: { applicationId: app.id, status: { in: [...assist_logic_1.OPEN_ASSIST_STATUSES] } },
            data: { status: client_1.AssistedSessionStatus.cancelled },
        });
        const created = await this.prisma.assistedSession.create({
            data: {
                token: (0, assist_logic_1.generateAssistToken)(),
                applicationId: app.id,
                customerUserId: app.customerUserId,
                createdByUserId: user.id,
                phone,
                email,
                expiresAt,
            },
        });
        const code = (0, otp_1.generateOtp)();
        const session = await this.prisma.assistedSession.update({
            where: { id: created.id },
            data: (0, assist_logic_1.issuedOtpPatch)((0, otp_1.hashOtp)(this.secret, created.id, code), now),
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
                locale: (0, sms_texts_1.resolveNotificationLocale)(session.customer.preferredLanguage),
            });
        }
        await this.activity.log({
            actorUserId: user.id,
            entityType: 'assisted_session',
            entityId: session.id,
            action: 'assisted_session_created',
            toValue: session.status,
            metadata: { application_id: app.id, phone_masked: (0, domain_rules_1.maskPhone)(phone), email_sent: Boolean(email) },
        });
        return this.toDto(session, link);
    }
    async list(user, applicationId) {
        const app = await this.prisma.application.findUnique({
            where: { id: applicationId },
            select: { id: true, companyId: true },
        });
        if (!app)
            throw new common_1.NotFoundException('application_not_found');
        this.assertStaffScope(user, app);
        const sessions = await this.prisma.assistedSession.findMany({
            where: { applicationId: app.id },
            orderBy: { createdAt: 'desc' },
        });
        return sessions.map((s) => this.toDto(s));
    }
    async resend(user, id) {
        const session = await this.staffSession(user, id);
        await this.assertOpen(session);
        const { session: updated, link } = await this.issueNewCode(session, user.id);
        return this.toDto(updated, link);
    }
    async cancel(user, id) {
        const session = await this.staffSession(user, id);
        if (session.status === client_1.AssistedSessionStatus.completed)
            throw new common_1.ConflictException('assist_session_closed');
        if (!(0, assist_logic_1.isAssistSessionOpen)(session.status))
            return this.toDto(session);
        const updated = await this.prisma.assistedSession.update({
            where: { id: session.id },
            data: { status: client_1.AssistedSessionStatus.cancelled },
        });
        await this.activity.log({
            actorUserId: user.id,
            entityType: 'assisted_session',
            entityId: session.id,
            action: 'assisted_session_cancelled',
            fromValue: session.status,
            toValue: client_1.AssistedSessionStatus.cancelled,
            metadata: { application_id: session.applicationId },
        });
        return this.toDto(updated);
    }
    async publicView(token) {
        const session = await this.byToken(token);
        const now = new Date();
        const status = (0, assist_logic_1.effectiveAssistStatus)(session, now);
        await this.prisma.assistedSession.update({
            where: { id: session.id },
            data: { lastOpenedAt: now, ...(status !== session.status ? { status } : {}) },
        });
        return this.toPublicDto(session, status);
    }
    async verifyOtp(token, code) {
        const session = await this.openSession(token);
        const now = new Date();
        const matches = Boolean(session.otpCodeHash) && (0, otp_1.otpMatches)(this.secret, session.id, code, session.otpCodeHash);
        const result = (0, assist_logic_1.evaluateOtpAttempt)(session, matches, now);
        switch (result.outcome) {
            case 'locked':
                throw new common_1.HttpException({ message: 'otp_locked', retry_after_sec: result.retryAfterSec }, common_1.HttpStatus.TOO_MANY_REQUESTS);
            case 'expired':
                throw new common_1.BadRequestException('otp_expired');
            case 'not_issued':
                throw new common_1.BadRequestException('otp_not_issued');
            case 'invalid': {
                await this.prisma.assistedSession.update({ where: { id: session.id }, data: result.patch });
                if (result.lockedForSec) {
                    throw new common_1.HttpException({ message: 'otp_locked', retry_after_sec: result.lockedForSec }, common_1.HttpStatus.TOO_MANY_REQUESTS);
                }
                throw new common_1.BadRequestException({ message: 'otp_invalid', remaining: result.remaining });
            }
            case 'verified': {
                const proof = (0, assist_logic_1.generateAssistProof)();
                const status = (0, assist_logic_1.advanceAssistStatus)(session.status, client_1.AssistedSessionStatus.otp_verified);
                await this.prisma.assistedSession.update({
                    where: { id: session.id },
                    data: { ...(0, assist_logic_1.verifiedOtpPatch)((0, assist_logic_1.hashAssistProof)(proof), now), status },
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
    async resendPublic(token) {
        const session = await this.openSession(token);
        const { session: updated } = await this.issueNewCode(session, session.customerUserId);
        return { status: (0, assist_logic_1.effectiveAssistStatus)(updated), otp_expires_in_sec: otp_1.OTP_POLICY.ttlMs / 1000 };
    }
    async recordConsents(token, proof, input, meta) {
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
                    status: (0, assist_logic_1.advanceAssistStatus)(session.status, client_1.AssistedSessionStatus.consents_done),
                },
            });
        }
        return status;
    }
    async startIdentity(token, proof) {
        const session = await this.provenSession(token, proof);
        if (!session.consentsCompletedAt && !session.application.consentsCompletedAt) {
            throw new common_1.ConflictException('consents_required');
        }
        const customer = await this.prisma.user.findUnique({ where: { id: session.customerUserId } });
        if (!customer)
            throw new common_1.NotFoundException('customer_not_found');
        const kyc = await this.kycBridge.ensureSession(customer, session.applicationId);
        const status = (0, assist_logic_1.advanceAssistStatus)(session.status, client_1.AssistedSessionStatus.identity_started);
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
    async complete(token, proof) {
        const session = await this.provenSession(token, proof);
        if (session.status !== client_1.AssistedSessionStatus.consents_done &&
            session.status !== client_1.AssistedSessionStatus.identity_started) {
            throw new common_1.ConflictException('assist_session_incomplete');
        }
        const now = new Date();
        await this.prisma.assistedSession.update({
            where: { id: session.id },
            data: { status: client_1.AssistedSessionStatus.completed, completedAt: now },
        });
        await this.activity.log({
            actorUserId: session.customerUserId,
            entityType: 'assisted_session',
            entityId: session.id,
            action: 'assisted_session_completed',
            fromValue: session.status,
            toValue: client_1.AssistedSessionStatus.completed,
            metadata: { application_id: session.applicationId },
        });
        await this.activity.notify(session.createdByUserId, (0, notification_texts_1.localizedText)((t) => t.assistCompletedTitle), (0, notification_texts_1.localizedText)((t) => t.assistCompletedBody({ customerName: session.customer.name })), `/applications/${session.applicationId}`);
        return { status: client_1.AssistedSessionStatus.completed };
    }
    async issueNewCode(session, actorUserId) {
        const now = new Date();
        const gate = (0, otp_1.otpResendGate)(session, now);
        if (!gate.ok) {
            throw new common_1.HttpException({ message: 'otp_resend_limit', retry_after_sec: Math.max(1, Math.ceil(gate.retryAfterMs / 1000)) }, common_1.HttpStatus.TOO_MANY_REQUESTS);
        }
        const code = (0, otp_1.generateOtp)();
        const updated = await this.prisma.assistedSession.update({
            where: { id: session.id },
            data: {
                ...(0, assist_logic_1.issuedOtpPatch)((0, otp_1.hashOtp)(this.secret, session.id, code), now),
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
    async byToken(token) {
        const value = token?.trim();
        if (!value || value.length > 128)
            throw new common_1.NotFoundException('assist_session_not_found');
        const session = await this.prisma.assistedSession.findUnique({ where: { token: value }, include: sessionInclude });
        if (!session)
            throw new common_1.NotFoundException('assist_session_not_found');
        return session;
    }
    async openSession(token) {
        const session = await this.byToken(token);
        await this.assertOpen(session);
        return session;
    }
    async assertOpen(session) {
        const status = (0, assist_logic_1.effectiveAssistStatus)(session);
        if (status === client_1.AssistedSessionStatus.expired) {
            if (session.status !== client_1.AssistedSessionStatus.expired) {
                await this.prisma.assistedSession.update({
                    where: { id: session.id },
                    data: { status: client_1.AssistedSessionStatus.expired },
                });
            }
            throw new common_1.ConflictException('assist_session_expired');
        }
        if (!(0, assist_logic_1.isAssistSessionOpen)(status))
            throw new common_1.ConflictException('assist_session_closed');
    }
    async provenSession(token, proof) {
        const session = await this.openSession(token);
        if (!(0, assist_logic_1.assistProofMatches)(proof, session.proofHash))
            throw new common_1.UnauthorizedException('assist_proof_invalid');
        return session;
    }
    async staffSession(user, id) {
        const session = await this.prisma.assistedSession.findUnique({ where: { id }, include: sessionInclude });
        if (!session)
            throw new common_1.NotFoundException('assist_session_not_found');
        this.assertStaffScope(user, session.application);
        return session;
    }
    assertStaffScope(user, app) {
        if (user.role === client_1.UserRole.dealer_agent && user.companyId !== app.companyId) {
            throw new common_1.NotFoundException('application_not_found');
        }
    }
    linkFor(token) {
        return this.appConfig.marketplacePath(`/assist/${token}`);
    }
    async deliverSms(session, code, link, kind) {
        const body = (0, sms_texts_1.assistSmsBody)({
            kind,
            locale: (0, sms_texts_1.resolveNotificationLocale)(session.customer.preferredLanguage),
            dealerName: session.application.company.name,
            link,
            code,
        });
        try {
            await this.sms.send({ to: session.phone, body, kind });
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            this.logger.error(`Assisted-session SMS failed session=${session.id} kind=${kind}: ${message}`);
            if (this.sms.isLive)
                throw new common_1.HttpException('sms_delivery_failed', common_1.HttpStatus.BAD_GATEWAY);
        }
    }
    toDto(session, link) {
        return {
            id: session.id,
            application_id: session.applicationId,
            status: (0, assist_logic_1.effectiveAssistStatus)(session),
            phone_masked: (0, domain_rules_1.maskPhone)(session.phone),
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
    toPublicDto(session, status) {
        const pricing = session.application.pricingSnapshot && typeof session.application.pricingSnapshot === 'object'
            ? session.application.pricingSnapshot
            : {};
        const product = session.application.product;
        return {
            status,
            phone_masked: (0, domain_rules_1.maskPhone)(session.phone),
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
};
exports.AssistService = AssistService;
exports.AssistService = AssistService = AssistService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        activity_service_1.ActivityService,
        consents_service_1.ConsentsService,
        kyc_bridge_service_1.KycBridgeService,
        sms_service_1.SmsService,
        mail_service_1.MailService,
        app_config_service_1.AppConfigService,
        config_1.ConfigService])
], AssistService);
//# sourceMappingURL=assist.service.js.map