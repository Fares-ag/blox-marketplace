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
var NotificationRouterService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationRouterService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const app_config_service_1 = require("../config/app-config.service");
const notification_preferences_1 = require("../customers/notification-preferences");
const mail_service_1 = require("../mail/mail.service");
const prisma_service_1 = require("../prisma/prisma.service");
const push_service_1 = require("../push/push.service");
const sms_service_1 = require("../sms/sms.service");
const whatsapp_service_1 = require("../sms/whatsapp.service");
const notification_router_contract_1 = require("./notification-router.contract");
const notification_routing_1 = require("./notification-routing");
const notification_texts_1 = require("./notification-texts");
let NotificationRouterService = NotificationRouterService_1 = class NotificationRouterService {
    prisma;
    mail;
    sms;
    whatsapp;
    push;
    appConfig;
    logger = new common_1.Logger(NotificationRouterService_1.name);
    outboundEnabled;
    constructor(prisma, mail, sms, whatsapp, push, appConfig, config) {
        this.prisma = prisma;
        this.mail = mail;
        this.sms = sms;
        this.whatsapp = whatsapp;
        this.push = push;
        this.appConfig = appConfig;
        this.outboundEnabled = (0, notification_routing_1.parseOutboundChannels)(config.get('NOTIFICATION_OUTBOUND_CHANNELS'));
    }
    async dispatch(input) {
        const recipient = await this.loadRecipient(input.userId);
        if (!recipient) {
            const title = (0, notification_router_contract_1.resolveLocalizedText)(input.title, 'en');
            this.logger.warn(`Notification dropped — recipient ${input.userId} not found (${input.category}: ${title})`);
            return (0, notification_router_contract_1.inAppOnlyDispatchResult)(null, 'user_not_found');
        }
        const locale = (0, notification_texts_1.resolveNotificationLocale)(recipient.preferredLanguage);
        const message = {
            locale,
            title: (0, notification_router_contract_1.resolveLocalizedText)(input.title, locale) ?? '',
            body: (0, notification_router_contract_1.resolveLocalizedText)(input.body, locale),
            url: (0, notification_routing_1.absoluteNotificationUrl)(input.linkPath, recipient.role, this.portalUrls()),
        };
        const row = await this.prisma.notification.create({
            data: {
                userId: recipient.id,
                title: message.title,
                body: message.body,
                linkPath: input.linkPath ?? null,
            },
        });
        const decisions = (0, notification_routing_1.selectNotificationChannels)({
            category: input.category,
            preferences: (0, notification_preferences_1.resolveNotificationPreferences)(recipient.notificationPreferences),
            contact: { email: recipient.email, phone: recipient.phone, deviceTokens: recipient.deviceTokens },
            providers: {
                email: this.mail.enabled && this.outboundEnabled.has('email'),
                sms: this.outboundEnabled.has('sms'),
                whatsapp: this.outboundEnabled.has('whatsapp'),
                push: this.outboundEnabled.has('push'),
            },
            active: recipient.isActive,
        });
        const outcomes = await Promise.all(notification_routing_1.OUTBOUND_CHANNELS.map(async (channel) => [channel, await this.deliver(channel, decisions[channel], recipient, input, message, row.id)]));
        const channels = { in_app: { outcome: 'sent' } };
        for (const [channel, result] of outcomes)
            channels[channel] = result;
        return { notification_id: row.id, channels };
    }
    async loadRecipient(userId) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                role: true,
                isActive: true,
                preferredLanguage: true,
                notificationPreferences: true,
                _count: { select: { deviceTokens: true } },
            },
        });
        if (!user)
            return null;
        return {
            id: user.id,
            name: user.name,
            email: user.email,
            phone: user.phone,
            role: user.role,
            isActive: user.isActive,
            preferredLanguage: user.preferredLanguage,
            notificationPreferences: user.notificationPreferences,
            deviceTokens: user._count.deviceTokens,
        };
    }
    portalUrls() {
        return {
            marketplace: this.appConfig.marketplaceUrl,
            admin: this.appConfig.adminUrl,
            superAdmin: this.appConfig.superAdminUrl,
            dealer: this.appConfig.dealerUrl,
            credit: this.appConfig.creditUrl,
            finance: this.appConfig.financeUrl,
        };
    }
    async deliver(channel, decision, recipient, input, message, notificationId) {
        if (!decision.send)
            return { outcome: 'skipped', reason: decision.reason };
        try {
            switch (channel) {
                case 'email':
                    return this.deliverEmail(recipient, input, message, notificationId);
                case 'sms': {
                    const result = await this.sms.send({
                        to: recipient.phone,
                        body: (0, notification_routing_1.notificationSmsText)({ title: message.title, body: message.body, url: message.url, locale: message.locale }),
                        kind: 'notification',
                    });
                    return result.delivered ? { outcome: 'sent' } : { outcome: 'logged', reason: result.provider };
                }
                case 'whatsapp': {
                    const result = await this.whatsapp.send({
                        to: recipient.phone,
                        body: (0, notification_routing_1.notificationWhatsAppText)({ title: message.title, body: message.body, url: message.url, locale: message.locale }),
                        kind: 'notification',
                    });
                    return result.delivered ? { outcome: 'sent' } : { outcome: 'logged', reason: result.provider };
                }
                case 'push': {
                    const result = await this.push.sendToUser(recipient.id, {
                        title: message.title,
                        body: message.body,
                        linkPath: input.linkPath,
                        data: { ...(input.data ?? {}), category: input.category, notification_id: notificationId },
                    });
                    if (result.provider === 'log')
                        return { outcome: 'logged', reason: 'log' };
                    if (result.sent > 0)
                        return { outcome: 'sent' };
                    if (result.attempted === 0)
                        return { outcome: 'skipped', reason: 'no_contact' };
                    return { outcome: 'failed', reason: result.pruned === result.attempted ? 'tokens_pruned' : 'fcm_error' };
                }
            }
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            this.logger.warn(`Notification ${channel} failed user=${recipient.id} notification=${notificationId}: ${message}`);
            return { outcome: 'failed', reason: message.slice(0, 120) };
        }
    }
    async deliverEmail(recipient, input, message, notificationId) {
        const override = typeof input.email === 'function' ? input.email(message.locale) : input.email;
        if (override) {
            await this.mail.send({
                to: recipient.email,
                subject: override.subject,
                text: override.text,
                html: override.html,
                template: (0, mail_service_1.isMailTemplate)(override.template) ? override.template : 'notification',
                payload: { url: message.url, category: input.category, notificationId, locale: message.locale },
            });
        }
        else {
            await this.mail.sendNotificationEmail({
                to: recipient.email,
                name: recipient.name,
                title: message.title,
                body: message.body,
                url: message.url,
                category: input.category,
                locale: message.locale,
            });
        }
        return { outcome: 'sent' };
    }
};
exports.NotificationRouterService = NotificationRouterService;
exports.NotificationRouterService = NotificationRouterService = NotificationRouterService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        mail_service_1.MailService,
        sms_service_1.SmsService,
        whatsapp_service_1.WhatsAppService,
        push_service_1.PushService,
        app_config_service_1.AppConfigService,
        config_1.ConfigService])
], NotificationRouterService);
//# sourceMappingURL=notification-router.service.js.map