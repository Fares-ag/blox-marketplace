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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var MailService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MailService = exports.MailDeliveryError = exports.MAIL_TEMPLATES = void 0;
exports.isMailTemplate = isMailTemplate;
exports.resolveSmtpRequireTls = resolveSmtpRequireTls;
exports.renderDocumentExpiryEmail = renderDocumentExpiryEmail;
exports.renderTakafulRenewalEmail = renderTakafulRenewalEmail;
exports.renderNotificationEmail = renderNotificationEmail;
exports.renderAssistedSessionEmail = renderAssistedSessionEmail;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const client_1 = require("@prisma/client");
const nodemailer_1 = __importDefault(require("nodemailer"));
const notification_texts_1 = require("../notifications/notification-texts");
const prisma_service_1 = require("../prisma/prisma.service");
const postmark_mail_1 = require("./postmark-mail");
exports.MAIL_TEMPLATES = [
    'password_reset',
    'email_verification',
    'walk_in_invite',
    'staff_account_created',
    'assisted_session',
    'document_expiry',
    'takaful_renewal',
    'notification',
    'transactional',
];
function isMailTemplate(value) {
    return typeof value === 'string' && exports.MAIL_TEMPLATES.includes(value);
}
const LOCAL_SMTP_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);
function resolveSmtpRequireTls(raw, opts) {
    const flag = raw?.trim().toLowerCase();
    if (flag === 'true' || flag === '1')
        return true;
    if (flag === 'false' || flag === '0')
        return false;
    if (opts.secure)
        return false;
    if (opts.port === 25)
        return false;
    return !LOCAL_SMTP_HOSTS.has(opts.host.trim().toLowerCase());
}
class MailDeliveryError extends Error {
    outboxId;
    constructor(message, outboxId) {
        super(message);
        this.outboxId = outboxId;
        this.name = 'MailDeliveryError';
    }
}
exports.MailDeliveryError = MailDeliveryError;
const AUTH_CRITICAL_TEMPLATES = new Set([
    'password_reset',
    'email_verification',
    'walk_in_invite',
    'staff_account_created',
]);
const MAX_OUTBOX_ATTEMPTS = 5;
const BACKOFF_MS = [60_000, 300_000, 900_000, 3_600_000];
function backoffMs(attemptNumber) {
    const idx = Math.max(0, Math.min(attemptNumber - 1, BACKOFF_MS.length - 1));
    return BACKOFF_MS[idx];
}
function plainUrl(url, locale) {
    return locale === 'ar' ? (0, notification_texts_1.isolateLtr)(url) : url;
}
const FOOTER_STYLE = 'color:#64748b;font-size:14px;';
function renderDocumentExpiryEmail(input, locale = 'en') {
    const t = (0, notification_texts_1.notificationTexts)(locale, 'text');
    const h = (0, notification_texts_1.notificationTexts)(locale, 'html');
    const values = { category: input.documentCategory, days: input.daysToExpiry, date: (0, notification_texts_1.formatQatarDate)(input.expiresAt, locale) };
    const subject = (0, notification_texts_1.finalizeText)(t.documentEmailSubject(values), locale);
    const text = (0, notification_texts_1.finalizeText)([t.greeting(input.name), '', t.documentEmailLead(values), '', t.documentEmailCta, plainUrl(input.url, locale), '', t.documentEmailFooter].join('\n'), locale);
    const html = (0, notification_texts_1.wrapHtml)(`<p>${h.greeting(input.name)}</p>` +
        `<p>${h.documentEmailLead(values)}</p>` +
        `<p><a href="${(0, notification_texts_1.escapeHtml)(input.url)}">${h.documentEmailLink}</a></p>` +
        `<p style="${FOOTER_STYLE}">${h.documentEmailFooter}</p>`, locale);
    return { subject, text, html };
}
function renderTakafulRenewalEmail(input, locale = 'en') {
    const t = (0, notification_texts_1.notificationTexts)(locale, 'text');
    const h = (0, notification_texts_1.notificationTexts)(locale, 'html');
    const values = {
        vehicle: input.vehicleLabel,
        provider: input.provider,
        days: input.daysToExpiry,
        date: (0, notification_texts_1.formatQatarDate)(input.expiresAt, locale),
    };
    const subject = (0, notification_texts_1.finalizeText)(t.takafulEmailSubject(values), locale);
    const text = (0, notification_texts_1.finalizeText)([
        t.greeting(input.name),
        '',
        t.takafulEmailLead(values),
        '',
        `${t.takafulEmailRequirement} ${t.takafulEmailCta}`,
        plainUrl(input.url, locale),
        '',
        t.takafulEmailFooter,
    ].join('\n'), locale);
    const html = (0, notification_texts_1.wrapHtml)(`<p>${h.greeting(input.name)}</p>` +
        `<p>${h.takafulEmailLead(values)}</p>` +
        `<p>${h.takafulEmailRequirement}</p>` +
        `<p><a href="${(0, notification_texts_1.escapeHtml)(input.url)}">${h.takafulEmailLink}</a></p>` +
        `<p style="${FOOTER_STYLE}">${h.takafulEmailFooter}</p>`, locale);
    return { subject, text, html };
}
function renderNotificationEmail(input, locale = 'en') {
    const t = (0, notification_texts_1.notificationTexts)(locale, 'text');
    const h = (0, notification_texts_1.notificationTexts)(locale, 'html');
    const body = input.body?.trim() || '';
    const url = input.url?.trim() || '';
    const text = (0, notification_texts_1.finalizeText)([
        t.greeting(input.name),
        '',
        input.title,
        ...(body ? ['', body] : []),
        ...(url ? ['', t.openInBloxLine(url)] : []),
        '',
        t.notificationFooter,
    ].join('\n'), locale);
    const html = (0, notification_texts_1.wrapHtml)(`<p>${h.greeting(input.name)}</p>` +
        `<p><strong>${(0, notification_texts_1.escapeHtml)(input.title)}</strong></p>` +
        (body ? `<p>${(0, notification_texts_1.escapeHtml)(body)}</p>` : '') +
        (url ? `<p><a href="${(0, notification_texts_1.escapeHtml)(url)}">${h.openInBloxLabel}</a></p>` : '') +
        `<p style="${FOOTER_STYLE}">${h.notificationFooter}</p>`, locale);
    return { subject: input.title, text, html };
}
function renderAssistedSessionEmail(input, locale = 'en') {
    const t = (0, notification_texts_1.notificationTexts)(locale, 'text');
    const h = (0, notification_texts_1.notificationTexts)(locale, 'html');
    const expires = (0, notification_texts_1.formatQatarDateTime)(input.expiresAt, locale);
    const party = { dealerName: input.dealerName, agentName: input.agentName ?? null };
    const subject = (0, notification_texts_1.finalizeText)(t.assistEmailSubject(party), locale);
    const text = (0, notification_texts_1.finalizeText)([
        t.assistEmailIntro(party),
        '',
        t.assistEmailInstructions,
        plainUrl(input.url, locale),
        '',
        t.assistEmailExpiry({ expires, dealerName: input.dealerName }),
        '',
        t.assistEmailIgnore,
    ].join('\n'), locale);
    const html = (0, notification_texts_1.wrapHtml)(`<p>${h.assistEmailIntro(party)}</p>` +
        `<p>${h.assistEmailInstructions}</p>` +
        `<p><a href="${(0, notification_texts_1.escapeHtml)(input.url)}">${h.assistEmailLink}</a></p>` +
        `<p style="${FOOTER_STYLE}">${h.assistEmailExpiry({ expires, dealerName: input.dealerName })} ${h.assistEmailIgnore}</p>`, locale);
    return { subject, text, html };
}
let MailService = MailService_1 = class MailService {
    config;
    prisma;
    logger = new common_1.Logger(MailService_1.name);
    transport;
    transporter = null;
    postmarkToken;
    postmarkHttpTimeoutMs;
    from;
    constructor(config, prisma) {
        this.config = config;
        this.prisma = prisma;
        this.from =
            this.config.get('SMTP_FROM') ?? 'Blox <no-reply@blox.market>';
        this.postmarkToken = (0, postmark_mail_1.resolvePostmarkServerToken)(config);
        this.postmarkHttpTimeoutMs = (0, postmark_mail_1.resolvePostmarkHttpTimeoutMs)(config);
        if (this.postmarkToken) {
            this.transport = 'postmark';
            this.logger.log('Mail transport: Postmark HTTP API');
        }
        else {
            const host = this.config.get('SMTP_HOST');
            if (host) {
                const port = Number(this.config.get('SMTP_PORT') ?? 587);
                const secure = this.config.get('SMTP_SECURE') === 'true';
                this.transporter = nodemailer_1.default.createTransport({
                    host,
                    port,
                    secure,
                    requireTLS: resolveSmtpRequireTls(this.config.get('SMTP_REQUIRE_TLS'), {
                        host,
                        port,
                        secure,
                    }),
                    auth: this.config.get('SMTP_USER')
                        ? {
                            user: this.config.get('SMTP_USER'),
                            pass: this.config.get('SMTP_PASS'),
                        }
                        : undefined,
                    connectionTimeout: 15_000,
                    greetingTimeout: 15_000,
                    socketTimeout: 30_000,
                });
                this.transport = 'smtp';
                this.logger.log(`Mail transport: SMTP (${host}:${port})`);
            }
            else {
                this.transport = 'none';
            }
        }
    }
    get enabled() {
        return this.transport !== 'none';
    }
    assertProductionReady(_requireEmailVerification) {
        void _requireEmailVerification;
        if (process.env.NODE_ENV === 'production' && !this.enabled) {
            throw new Error('Mail is not configured but this deployment sends transactional email ' +
                '(password reset, email verification, walk-in invites). ' +
                'Set POSTMARK_SERVER_TOKEN (recommended on Railway) or SMTP_HOST, SMTP_PORT, ' +
                'SMTP_USER, SMTP_PASS, and SMTP_FROM.');
        }
    }
    async send(input) {
        const authCritical = input.authCritical ?? AUTH_CRITICAL_TEMPLATES.has(input.template);
        const payload = {
            text: input.text,
            html: input.html,
            ...(input.payload ?? {}),
        };
        const row = await this.prisma.emailOutbox.create({
            data: {
                to: input.to,
                subject: input.subject,
                template: input.template,
                payload: payload,
                status: client_1.EmailOutboxStatus.pending,
            },
        });
        if (this.transport === 'none') {
            const url = typeof payload.url === 'string' ? payload.url : undefined;
            this.logger.warn(url
                ? `Mail not configured — dev verification link for ${input.to}: ${url}`
                : `Mail not configured — queued outbox=${row.id} to=${input.to} template=${input.template}`);
            return;
        }
        try {
            await this.attemptDelivery(row);
        }
        catch (err) {
            const message = err instanceof Error ? err.message : 'mail_send_failed';
            if (authCritical) {
                throw new MailDeliveryError(`Failed to send ${input.template} email to ${input.to}: ${message}`, row.id);
            }
            this.logger.error(`Non-critical mail failed outbox=${row.id} to=${input.to}: ${message}`);
        }
    }
    async markForRetry(id) {
        await this.prisma.emailOutbox.updateMany({
            where: {
                id,
                status: client_1.EmailOutboxStatus.failed,
                attempts: { lt: MAX_OUTBOX_ATTEMPTS },
            },
            data: {
                status: client_1.EmailOutboxStatus.pending,
                nextAttemptAt: new Date(),
            },
        });
    }
    async processOutbox(limit = 20) {
        const now = new Date();
        const rows = await this.prisma.emailOutbox.findMany({
            where: {
                status: { in: [client_1.EmailOutboxStatus.pending, client_1.EmailOutboxStatus.failed] },
                attempts: { lt: MAX_OUTBOX_ATTEMPTS },
                OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
            },
            orderBy: { createdAt: 'asc' },
            take: limit,
        });
        let sent = 0;
        let failed = 0;
        for (const row of rows) {
            let current = row;
            if (row.status === client_1.EmailOutboxStatus.failed) {
                await this.markForRetry(row.id);
                const refreshed = await this.prisma.emailOutbox.findUnique({ where: { id: row.id } });
                if (!refreshed || refreshed.status !== client_1.EmailOutboxStatus.pending)
                    continue;
                current = refreshed;
            }
            try {
                await this.attemptDelivery(current);
                sent += 1;
            }
            catch (err) {
                failed += 1;
                const message = err instanceof Error ? err.message : 'mail_send_failed';
                this.logger.warn(`Outbox retry failed id=${row.id} to=${row.to}: ${message}`);
            }
        }
        return { processed: rows.length, sent, failed };
    }
    async attemptDelivery(row) {
        try {
            await this.deliver(row);
            await this.prisma.emailOutbox.update({
                where: { id: row.id },
                data: {
                    status: client_1.EmailOutboxStatus.sent,
                    sentAt: new Date(),
                    lastError: null,
                    nextAttemptAt: null,
                },
            });
            this.logger.log(`Mail sent outbox=${row.id} to=${row.to} template=${row.template}`);
        }
        catch (err) {
            const message = err instanceof Error ? err.message : 'mail_send_failed';
            const nextAttempts = row.attempts + 1;
            const exhausted = nextAttempts >= MAX_OUTBOX_ATTEMPTS;
            await this.prisma.emailOutbox.update({
                where: { id: row.id },
                data: {
                    attempts: nextAttempts,
                    lastError: message,
                    status: exhausted ? client_1.EmailOutboxStatus.failed : client_1.EmailOutboxStatus.pending,
                    nextAttemptAt: exhausted ? null : new Date(Date.now() + backoffMs(nextAttempts)),
                },
            });
            if (this.transport === 'none') {
                this.logger.warn(`Mail not configured — NOT sent. outbox=${row.id} to=${row.to} subject="${row.subject}"`);
            }
            else {
                this.logger.error(`Mail send failed outbox=${row.id} to=${row.to}: ${message}`);
            }
            throw err instanceof Error ? err : new Error(message);
        }
    }
    async deliver(row) {
        const payload = row.payload;
        const text = payload.text ?? '';
        if (this.postmarkToken) {
            await (0, postmark_mail_1.sendPostmarkEmail)({
                token: this.postmarkToken,
                from: this.from,
                to: row.to,
                subject: row.subject,
                text,
                html: payload.html,
                timeoutMs: this.postmarkHttpTimeoutMs,
            });
            return;
        }
        if (this.transporter) {
            await this.transporter.sendMail({
                from: this.from,
                to: row.to,
                subject: row.subject,
                text,
                html: payload.html,
            });
            return;
        }
        throw new Error('Mail transport not configured');
    }
    async sendVerificationEmail(to, url) {
        await this.send({
            to,
            subject: 'Verify your Blox email address',
            text: `Welcome to Blox.\n\nVerify your email address to activate your account:\n${url}\n\nIf you did not create this account, ignore this email.`,
            template: 'email_verification',
            payload: { url },
        });
    }
    async sendPasswordResetEmail(to, url) {
        await this.send({
            to,
            subject: 'Reset your Blox password',
            text: `We received a request to reset your Blox password.\n\nSet a new password here (link expires shortly):\n${url}\n\nIf you did not request this, ignore this email — your password is unchanged.`,
            template: 'password_reset',
            payload: { url },
            authCritical: true,
        });
    }
    async sendWalkInInviteEmail(to, url, dealerName) {
        await this.send({
            to,
            subject: 'Your Blox financing application',
            text: `${dealerName} started a vehicle financing application for you on Blox.\n\n` +
                `Set a password to access your application, upload documents, and sign your contract:\n${url}\n\n` +
                `If this wasn't you, contact the dealer or ignore this email.`,
            template: 'walk_in_invite',
            payload: { url, dealerName },
            authCritical: true,
        });
    }
    async sendDealerAgentWelcomeEmail(input) {
        const subject = `You're invited to ${input.dealerName} on Blox`;
        const text = `Hi ${input.name},\n\n` +
            `${input.dealerName} invited you to the Blox dealer portal to create vehicle financing applications.\n\n` +
            `Sign in with:\n` +
            `Email: ${input.to}\n` +
            `Temporary password: ${input.temporaryPassword}\n\n` +
            `Dealer portal: ${input.loginUrl}\n\n` +
            `Change your password after your first sign-in.\n\n` +
            `If you were not expecting this invitation, contact ${input.dealerName} or ignore this email.`;
        const html = `<p>Hi ${input.name},</p>` +
            `<p><strong>${input.dealerName}</strong> invited you to the Blox dealer portal to create vehicle financing applications.</p>` +
            `<p><strong>Email:</strong> ${input.to}<br>` +
            `<strong>Temporary password:</strong> <code>${input.temporaryPassword}</code></p>` +
            `<p><a href="${input.loginUrl}">Open the dealer portal</a></p>` +
            `<p style="color:#64748b;font-size:14px;">Change your password after your first sign-in. ` +
            `If you were not expecting this invitation, contact ${input.dealerName} or ignore this email.</p>`;
        await this.send({
            to: input.to,
            subject,
            text,
            html,
            template: 'transactional',
            payload: {
                loginUrl: input.loginUrl,
                dealerName: input.dealerName,
                temporaryPassword: input.temporaryPassword,
            },
        });
    }
    async sendAdminPasswordResetEmail(input) {
        const subject = 'Your Blox password was reset';
        const text = `Hi ${input.name},\n\n` +
            `An administrator reset your Blox account password.\n\n` +
            `Sign in with:\n` +
            `Email: ${input.to}\n` +
            `Temporary password: ${input.temporaryPassword}\n\n` +
            `Sign-in URL: ${input.loginUrl}\n\n` +
            `Change your password after signing in.\n\n` +
            `If you did not expect this change, contact your administrator immediately.`;
        const html = `<p>Hi ${input.name},</p>` +
            `<p>An administrator reset your Blox account password.</p>` +
            `<p><strong>Email:</strong> ${input.to}<br>` +
            `<strong>Temporary password:</strong> <code>${input.temporaryPassword}</code></p>` +
            `<p><a href="${input.loginUrl}">Sign in to Blox</a></p>` +
            `<p style="color:#64748b;font-size:14px;">Change your password after signing in. ` +
            `If you did not expect this change, contact your administrator immediately.</p>`;
        await this.send({
            to: input.to,
            subject,
            text,
            html,
            template: 'transactional',
            payload: {
                loginUrl: input.loginUrl,
                temporaryPassword: input.temporaryPassword,
            },
        });
    }
    async sendStaffAccountCreatedEmail(to, name, loginUrl) {
        await this.send({
            to,
            subject: 'Your Blox account is ready',
            text: `Hi ${name},\n\n` +
                `An administrator created your Blox account. Sign in here:\n${loginUrl}\n\n` +
                `Use the email and temporary password shared with you by your administrator. ` +
                `Change your password after your first sign-in.\n\n` +
                `If you were not expecting this account, contact your administrator.`,
            template: 'staff_account_created',
            payload: { name, loginUrl },
            authCritical: true,
        });
    }
    async sendDealerQuoteEmail(input) {
        const price = `QAR ${Math.round(input.negotiatedPrice).toLocaleString('en-QA')}`;
        const expires = input.expiresAt.toLocaleString('en-QA', {
            dateStyle: 'medium',
            timeStyle: 'short',
            timeZone: 'Asia/Qatar',
        });
        const subject = `Your vehicle financing quote from ${input.dealerName}`;
        const text = `${input.dealerName} prepared a financing quote for you on Blox.\n\n` +
            `Vehicle: ${input.vehicleLabel}\n` +
            `Quoted price: ${price}\n` +
            `Valid until: ${expires}\n\n` +
            `Review the quote and start your application here:\n${input.url}\n\n` +
            `This link is tied to your email address and expires on the date above. ` +
            `If you were not expecting this quote, contact the dealer or ignore this email.`;
        const html = `<p>${input.dealerName} prepared a financing quote for you on Blox.</p>` +
            `<ul>` +
            `<li><strong>Vehicle:</strong> ${input.vehicleLabel}</li>` +
            `<li><strong>Quoted price:</strong> ${price}</li>` +
            `<li><strong>Valid until:</strong> ${expires}</li>` +
            `</ul>` +
            `<p><a href="${input.url}">Review your quote</a></p>` +
            `<p style="color:#64748b;font-size:14px;">This link is tied to your email address. ` +
            `If you were not expecting this quote, contact the dealer or ignore this email.</p>`;
        await this.send({
            to: input.to,
            subject,
            text,
            html,
            template: 'transactional',
            payload: {
                url: input.url,
                dealerName: input.dealerName,
                vehicleLabel: input.vehicleLabel,
                negotiatedPrice: input.negotiatedPrice,
                expiresAt: input.expiresAt.toISOString(),
            },
        });
    }
    async sendAssistedSessionEmail(input) {
        const locale = input.locale ?? 'en';
        const { subject, text, html } = renderAssistedSessionEmail(input, locale);
        await this.send({
            to: input.to,
            subject,
            text,
            html,
            template: 'assisted_session',
            payload: {
                url: input.url,
                dealerName: input.dealerName,
                agentName: input.agentName ?? null,
                expiresAt: input.expiresAt.toISOString(),
                locale,
            },
        });
    }
    async sendDocumentExpiryEmail(input) {
        const locale = input.locale ?? 'en';
        const { subject, text, html } = renderDocumentExpiryEmail(input, locale);
        await this.send({
            to: input.to,
            subject,
            text,
            html,
            template: 'document_expiry',
            payload: {
                url: input.url,
                documentCategory: input.documentCategory,
                expiresAt: input.expiresAt.toISOString(),
                daysToExpiry: input.daysToExpiry,
                locale,
            },
        });
    }
    async sendTakafulRenewalEmail(input) {
        const locale = input.locale ?? 'en';
        const { subject, text, html } = renderTakafulRenewalEmail(input, locale);
        await this.send({
            to: input.to,
            subject,
            text,
            html,
            template: 'takaful_renewal',
            payload: {
                url: input.url,
                vehicleLabel: input.vehicleLabel,
                provider: input.provider,
                expiresAt: input.expiresAt.toISOString(),
                daysToExpiry: input.daysToExpiry,
                locale,
            },
        });
    }
    async sendNotificationEmail(input) {
        const locale = input.locale ?? 'en';
        const { subject, text, html } = renderNotificationEmail(input, locale);
        await this.send({
            to: input.to,
            subject,
            text,
            html,
            template: 'notification',
            payload: { url: input.url, category: input.category, locale },
        });
    }
};
exports.MailService = MailService;
exports.MailService = MailService = MailService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService,
        prisma_service_1.PrismaService])
], MailService);
//# sourceMappingURL=mail.service.js.map