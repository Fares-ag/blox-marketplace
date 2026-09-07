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
var GuarantorsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.GuarantorsService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const client_1 = require("@prisma/client");
const domain_rules_1 = require("@drivemarket/shared/domain-rules");
const company_scope_1 = require("../applications/company-scope");
const assist_logic_1 = require("../assist/assist-logic");
const auth_config_1 = require("../auth/auth-config");
const activity_service_1 = require("../common/activity.service");
const encryption_service_1 = require("../common/encryption.service");
const otp_1 = require("../common/otp");
const app_config_service_1 = require("../config/app-config.service");
const kyc_platform_client_1 = require("../kyc/kyc-platform.client");
const prisma_service_1 = require("../prisma/prisma.service");
const sms_service_1 = require("../sms/sms.service");
const guarantor_logic_1 = require("./guarantor-logic");
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
};
const CLOSED_APPLICATION_STATUSES = [
    client_1.ApplicationStatus.completed,
    client_1.ApplicationStatus.rejected,
    client_1.ApplicationStatus.submission_cancelled,
];
const SMS_KIND = { link: 'assist_link', otp: 'assist_otp' };
let GuarantorsService = GuarantorsService_1 = class GuarantorsService {
    prisma;
    activity;
    encryption;
    kyc;
    sms;
    appConfig;
    logger = new common_1.Logger(GuarantorsService_1.name);
    secret;
    constructor(prisma, activity, encryption, kyc, sms, appConfig, config) {
        this.prisma = prisma;
        this.activity = activity;
        this.encryption = encryption;
        this.kyc = kyc;
        this.sms = sms;
        this.appConfig = appConfig;
        this.secret = (0, auth_config_1.resolveAuthSecret)(config);
    }
    async create(user, applicationId) {
        const app = await this.scopedApplication(user, applicationId);
        if (CLOSED_APPLICATION_STATUSES.includes(app.status))
            throw new common_1.ConflictException('application_closed');
        const guarantor = (0, guarantor_logic_1.guarantorFromSnapshot)(app.customerSnapshot);
        if (!guarantor)
            throw new common_1.BadRequestException('guarantor_not_declared');
        const phone = (0, sms_service_1.normalizePhone)(guarantor.phone);
        if (!phone)
            throw new common_1.BadRequestException('phone_invalid');
        const now = new Date();
        const expiresAt = new Date(now.getTime() + this.appConfig.assistSessionTtlMinutes * 60_000);
        const superseded = await this.prisma.guarantorConsentSession.updateMany({
            where: { applicationId: app.id, status: { in: [...guarantor_logic_1.OPEN_GUARANTOR_STATUSES] } },
            data: { status: client_1.GuarantorSessionStatus.cancelled },
        });
        const created = await this.prisma.guarantorConsentSession.create({
            data: {
                token: (0, assist_logic_1.generateAssistToken)(),
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
        const code = (0, otp_1.generateOtp)();
        const session = await this.prisma.guarantorConsentSession.update({
            where: { id: created.id },
            data: (0, assist_logic_1.issuedOtpPatch)((0, otp_1.hashOtp)(this.secret, created.id, code), now),
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
                phone_masked: (0, domain_rules_1.maskPhone)(phone),
                relationship: guarantor.relationship,
                superseded: superseded.count,
            },
        });
        return (0, guarantor_logic_1.toGuarantorSessionDto)(session, link, now);
    }
    async current(user, applicationId) {
        const app = await this.scopedApplication(user, applicationId);
        const session = await this.latest(app.id);
        return session ? (0, guarantor_logic_1.toGuarantorSessionDto)(session) : null;
    }
    async resend(user, applicationId) {
        const app = await this.scopedApplication(user, applicationId);
        const session = await this.latest(app.id);
        if (!session)
            throw new common_1.NotFoundException('guarantor_session_not_found');
        await this.assertOpen(session);
        const { session: updated, link } = await this.issueNewCode(session, user.id);
        return (0, guarantor_logic_1.toGuarantorSessionDto)(updated, link);
    }
    async cancel(user, applicationId) {
        const app = await this.scopedApplication(user, applicationId);
        const session = await this.latest(app.id);
        if (!session)
            throw new common_1.NotFoundException('guarantor_session_not_found');
        if (session.status === client_1.GuarantorSessionStatus.completed)
            throw new common_1.ConflictException('guarantor_session_closed');
        if (!(0, guarantor_logic_1.isGuarantorSessionOpen)(session.status))
            return (0, guarantor_logic_1.toGuarantorSessionDto)(session);
        const updated = await this.prisma.guarantorConsentSession.update({
            where: { id: session.id },
            data: { status: client_1.GuarantorSessionStatus.cancelled },
        });
        await this.activity.log({
            actorUserId: user.id,
            entityType: 'guarantor_session',
            entityId: session.id,
            action: 'guarantor_session_cancelled',
            fromValue: session.status,
            toValue: client_1.GuarantorSessionStatus.cancelled,
            metadata: { application_id: session.applicationId },
        });
        return (0, guarantor_logic_1.toGuarantorSessionDto)(updated);
    }
    async publicView(token) {
        const session = await this.byToken(token);
        const now = new Date();
        const status = (0, guarantor_logic_1.effectiveGuarantorStatus)(session, now);
        await this.prisma.guarantorConsentSession.update({
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
                await this.prisma.guarantorConsentSession.update({ where: { id: session.id }, data: result.patch });
                if (result.lockedForSec) {
                    throw new common_1.HttpException({ message: 'otp_locked', retry_after_sec: result.lockedForSec }, common_1.HttpStatus.TOO_MANY_REQUESTS);
                }
                throw new common_1.BadRequestException({ message: 'otp_invalid', remaining: result.remaining });
            }
            case 'verified': {
                const proof = (0, assist_logic_1.generateAssistProof)();
                const status = (0, guarantor_logic_1.advanceGuarantorStatus)(session.status, client_1.GuarantorSessionStatus.otp_verified);
                await this.prisma.guarantorConsentSession.update({
                    where: { id: session.id },
                    data: { ...(0, assist_logic_1.verifiedOtpPatch)((0, assist_logic_1.hashAssistProof)(proof), now), status },
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
    async resendPublic(token) {
        const session = await this.openSession(token);
        const { session: updated } = await this.issueNewCode(session, null);
        return { status: (0, guarantor_logic_1.effectiveGuarantorStatus)(updated), otp_expires_in_sec: otp_1.OTP_POLICY.ttlMs / 1000 };
    }
    async recordConsents(token, proof, input, meta) {
        const session = await this.provenSession(token, proof);
        const validation = (0, guarantor_logic_1.validateGuarantorAcceptances)(input.acceptances);
        if (!validation.ok) {
            if (validation.error === 'guarantor_consents_incomplete') {
                throw new common_1.BadRequestException({ message: validation.error, missing: validation.missing });
            }
            throw new common_1.BadRequestException({ message: validation.error, consent_code: validation.code });
        }
        const now = new Date();
        const acceptances = (0, guarantor_logic_1.buildGuarantorAcceptances)(validation.accepted, input.locale, now);
        const completedAt = session.consentsCompletedAt ?? now;
        const status = (0, guarantor_logic_1.advanceGuarantorStatus)(session.status, client_1.GuarantorSessionStatus.consents_done);
        await this.prisma.guarantorConsentSession.update({
            where: { id: session.id },
            data: {
                acceptances: acceptances,
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
    async startIdentity(token, proof) {
        const session = await this.provenSession(token, proof);
        if (!session.consentsCompletedAt)
            throw new common_1.ConflictException('consents_required');
        if (!this.kyc.configured())
            throw new common_1.BadRequestException('kyc_not_configured');
        const externalRef = `guarantor:${session.id}`;
        let caseId = session.kycCaseId;
        let inviteUrl;
        try {
            if (!caseId) {
                const existing = await this.kyc.findCaseByExternalRef(externalRef);
                if (existing) {
                    caseId = existing.id;
                }
                else {
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
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            this.logger.error(`Guarantor KYC start failed session=${session.id}: ${message}`);
            throw new common_1.HttpException('kyc_unavailable', common_1.HttpStatus.BAD_GATEWAY);
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
    async complete(token, proof) {
        const session = await this.provenSession(token, proof);
        if (session.status !== client_1.GuarantorSessionStatus.consents_done) {
            throw new common_1.ConflictException('guarantor_session_incomplete');
        }
        const now = new Date();
        await this.prisma.guarantorConsentSession.update({
            where: { id: session.id },
            data: { status: client_1.GuarantorSessionStatus.completed, completedAt: now },
        });
        await this.activity.log({
            actorUserId: session.createdByUserId,
            entityType: 'guarantor_session',
            entityId: session.id,
            action: 'guarantor_session_completed',
            fromValue: session.status,
            toValue: client_1.GuarantorSessionStatus.completed,
            metadata: { application_id: session.applicationId, kyc_started: Boolean(session.kycCaseId) },
        });
        const applicantId = session.application.customerUserId;
        await this.activity.notify(applicantId, 'Guarantor consent received', `${session.fullName} accepted the guarantor consents for your application. You can continue to submit it.`, `/app/applications/${session.applicationId}`);
        if (session.createdByUserId && session.createdByUserId !== applicantId) {
            await this.activity.notify(session.createdByUserId, 'Guarantor consent received', `${session.fullName} finished the guarantor consent step for ${session.application.customer.name ?? 'the applicant'}.`, `/applications/${session.applicationId}`);
        }
        return { status: client_1.GuarantorSessionStatus.completed };
    }
    async issueNewCode(session, actorUserId) {
        const now = new Date();
        const gate = (0, otp_1.otpResendGate)(session, now);
        if (!gate.ok) {
            throw new common_1.HttpException({ message: 'otp_resend_limit', retry_after_sec: Math.max(1, Math.ceil(gate.retryAfterMs / 1000)) }, common_1.HttpStatus.TOO_MANY_REQUESTS);
        }
        const code = (0, otp_1.generateOtp)();
        const updated = await this.prisma.guarantorConsentSession.update({
            where: { id: session.id },
            data: {
                ...(0, assist_logic_1.issuedOtpPatch)((0, otp_1.hashOtp)(this.secret, session.id, code), now),
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
    async latest(applicationId) {
        return this.prisma.guarantorConsentSession.findFirst({
            where: { applicationId },
            orderBy: { createdAt: 'desc' },
            include: sessionInclude,
        });
    }
    async byToken(token) {
        const value = token?.trim();
        if (!value || value.length > 128)
            throw new common_1.NotFoundException('guarantor_session_not_found');
        const session = await this.prisma.guarantorConsentSession.findUnique({
            where: { token: value },
            include: sessionInclude,
        });
        if (!session)
            throw new common_1.NotFoundException('guarantor_session_not_found');
        return session;
    }
    async openSession(token) {
        const session = await this.byToken(token);
        await this.assertOpen(session);
        return session;
    }
    async assertOpen(session) {
        const status = (0, guarantor_logic_1.effectiveGuarantorStatus)(session);
        if (status === client_1.GuarantorSessionStatus.expired) {
            if (session.status !== client_1.GuarantorSessionStatus.expired) {
                await this.prisma.guarantorConsentSession.update({
                    where: { id: session.id },
                    data: { status: client_1.GuarantorSessionStatus.expired },
                });
            }
            throw new common_1.ConflictException('guarantor_session_expired');
        }
        if (!(0, guarantor_logic_1.isGuarantorSessionOpen)(status))
            throw new common_1.ConflictException('guarantor_session_closed');
    }
    async provenSession(token, proof) {
        const session = await this.openSession(token);
        if (!(0, assist_logic_1.assistProofMatches)(proof, session.proofHash))
            throw new common_1.UnauthorizedException('assist_proof_invalid');
        return session;
    }
    async scopedApplication(user, applicationId) {
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
        if (!app)
            throw new common_1.NotFoundException('application_not_found');
        switch (user.role) {
            case client_1.UserRole.customer:
                if (app.customerUserId !== user.id)
                    throw new common_1.NotFoundException('application_not_found');
                break;
            case client_1.UserRole.dealer_agent:
                if (user.companyId !== app.companyId)
                    throw new common_1.NotFoundException('application_not_found');
                break;
            case client_1.UserRole.admin:
            case client_1.UserRole.super_admin:
                break;
            case client_1.UserRole.credit_officer:
                await (0, company_scope_1.assertCompanyScopeForRead)(this.prisma, user, app.companyId);
                break;
            default:
                throw new common_1.ForbiddenException('forbidden_role');
        }
        return app;
    }
    linkFor(token) {
        return this.appConfig.marketplacePath(`/guarantor/${token}`);
    }
    async deliverSms(session, code, link, kind) {
        const body = (0, guarantor_logic_1.guarantorSmsBody)(kind, { applicantName: session.application.customer.name, link, code });
        try {
            await this.sms.send({ to: session.phone, body, kind: SMS_KIND[kind] });
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            this.logger.error(`Guarantor SMS failed session=${session.id} kind=${kind}: ${message}`);
            if (this.sms.isLive)
                throw new common_1.HttpException('sms_delivery_failed', common_1.HttpStatus.BAD_GATEWAY);
        }
    }
    toPublicDto(session, status) {
        const product = session.application.product;
        return (0, guarantor_logic_1.toGuarantorSessionPublicDto)({
            session,
            status,
            applicantName: session.application.customer.name,
            dealerName: session.application.company.name ?? null,
            vehicle: product ? { make: product.make, model: product.model, modelYear: product.modelYear ?? null } : null,
            locale: session.application.customer.preferredLanguage,
        });
    }
};
exports.GuarantorsService = GuarantorsService;
exports.GuarantorsService = GuarantorsService = GuarantorsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        activity_service_1.ActivityService,
        encryption_service_1.EncryptionService,
        kyc_platform_client_1.KycPlatformClient,
        sms_service_1.SmsService,
        app_config_service_1.AppConfigService,
        config_1.ConfigService])
], GuarantorsService);
//# sourceMappingURL=guarantors.service.js.map