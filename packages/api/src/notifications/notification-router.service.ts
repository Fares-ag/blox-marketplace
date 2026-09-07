import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfigService } from '../config/app-config.service';
import { resolveNotificationPreferences } from '../customers/notification-preferences';
import { isMailTemplate, MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { PushService } from '../push/push.service';
import { SmsService } from '../sms/sms.service';
import { WhatsAppService } from '../sms/whatsapp.service';
import {
  inAppOnlyDispatchResult,
  resolveLocalizedText,
  type ChannelResult,
  type NotificationDispatchInput,
  type NotificationDispatchResult,
  type NotificationLocale,
  type NotificationRouter,
} from './notification-router.contract';
import {
  absoluteNotificationUrl,
  notificationSmsText,
  notificationWhatsAppText,
  OUTBOUND_CHANNELS,
  parseOutboundChannels,
  selectNotificationChannels,
  type ChannelDecision,
  type OutboundChannel,
  type PortalUrls,
} from './notification-routing';
import { resolveNotificationLocale } from './notification-texts';

type Recipient = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  isActive: boolean;
  preferredLanguage: string | null;
  notificationPreferences: unknown;
  deviceTokens: number;
};

/** Title/body rendered in the recipient's language, plus the absolute link for outbound channels. */
type ResolvedMessage = { locale: NotificationLocale; title: string; body: string | null; url: string | null };

/**
 * Preference-based fan-out for every notification on the platform.
 *
 * `dispatch` always writes the in-app row (the inbox is the system of record),
 * then sends email / SMS / WhatsApp / push according to the recipient's
 * `notificationPreferences` (see `notification-routing.ts` for the rules).
 * Text is rendered in the recipient's `preferredLanguage` (Arabic when
 * provided, English otherwise). Outbound failures never propagate: they are
 * logged and reported per channel in the result so callers can record them.
 */
@Injectable()
export class NotificationRouterService implements NotificationRouter {
  private readonly logger = new Logger(NotificationRouterService.name);
  private readonly outboundEnabled: Set<OutboundChannel>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly sms: SmsService,
    private readonly whatsapp: WhatsAppService,
    private readonly push: PushService,
    private readonly appConfig: AppConfigService,
    config: ConfigService,
  ) {
    this.outboundEnabled = parseOutboundChannels(config.get<string>('NOTIFICATION_OUTBOUND_CHANNELS'));
  }

  async dispatch(input: NotificationDispatchInput): Promise<NotificationDispatchResult> {
    const recipient = await this.loadRecipient(input.userId);
    if (!recipient) {
      const title = resolveLocalizedText(input.title, 'en');
      this.logger.warn(`Notification dropped — recipient ${input.userId} not found (${input.category}: ${title})`);
      return inAppOnlyDispatchResult(null, 'user_not_found');
    }

    const locale = resolveNotificationLocale(recipient.preferredLanguage);
    const message: ResolvedMessage = {
      locale,
      title: resolveLocalizedText(input.title, locale) ?? '',
      body: resolveLocalizedText(input.body, locale),
      url: absoluteNotificationUrl(input.linkPath, recipient.role, this.portalUrls()),
    };

    const row = await this.prisma.notification.create({
      data: {
        userId: recipient.id,
        title: message.title,
        body: message.body,
        linkPath: input.linkPath ?? null,
      },
    });

    const decisions = selectNotificationChannels({
      category: input.category,
      preferences: resolveNotificationPreferences(recipient.notificationPreferences),
      contact: { email: recipient.email, phone: recipient.phone, deviceTokens: recipient.deviceTokens },
      providers: {
        email: this.mail.enabled && this.outboundEnabled.has('email'),
        sms: this.outboundEnabled.has('sms'),
        whatsapp: this.outboundEnabled.has('whatsapp'),
        push: this.outboundEnabled.has('push'),
      },
      active: recipient.isActive,
    });

    const outcomes = await Promise.all(
      OUTBOUND_CHANNELS.map(
        async (channel) =>
          [channel, await this.deliver(channel, decisions[channel], recipient, input, message, row.id)] as const,
      ),
    );

    const channels = { in_app: { outcome: 'sent' } } as NotificationDispatchResult['channels'];
    for (const [channel, result] of outcomes) channels[channel] = result;
    return { notification_id: row.id, channels };
  }

  private async loadRecipient(userId: string): Promise<Recipient | null> {
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
    if (!user) return null;
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

  private portalUrls(): PortalUrls {
    return {
      marketplace: this.appConfig.marketplaceUrl,
      admin: this.appConfig.adminUrl,
      superAdmin: this.appConfig.superAdminUrl,
      dealer: this.appConfig.dealerUrl,
      credit: this.appConfig.creditUrl,
      finance: this.appConfig.financeUrl,
    };
  }

  private async deliver(
    channel: OutboundChannel,
    decision: ChannelDecision,
    recipient: Recipient,
    input: NotificationDispatchInput,
    message: ResolvedMessage,
    notificationId: string,
  ): Promise<ChannelResult> {
    if (!decision.send) return { outcome: 'skipped', reason: decision.reason };
    try {
      switch (channel) {
        case 'email':
          return this.deliverEmail(recipient, input, message, notificationId);
        case 'sms': {
          const result = await this.sms.send({
            to: recipient.phone!,
            body: notificationSmsText({ title: message.title, body: message.body, url: message.url, locale: message.locale }),
            kind: 'notification',
          });
          return result.delivered ? { outcome: 'sent' } : { outcome: 'logged', reason: result.provider };
        }
        case 'whatsapp': {
          const result = await this.whatsapp.send({
            to: recipient.phone!,
            body: notificationWhatsAppText({ title: message.title, body: message.body, url: message.url, locale: message.locale }),
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
          if (result.provider === 'log') return { outcome: 'logged', reason: 'log' };
          if (result.sent > 0) return { outcome: 'sent' };
          if (result.attempted === 0) return { outcome: 'skipped', reason: 'no_contact' };
          return { outcome: 'failed', reason: result.pruned === result.attempted ? 'tokens_pruned' : 'fcm_error' };
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Notification ${channel} failed user=${recipient.id} notification=${notificationId}: ${message}`);
      return { outcome: 'failed', reason: message.slice(0, 120) };
    }
  }

  private async deliverEmail(
    recipient: Recipient,
    input: NotificationDispatchInput,
    message: ResolvedMessage,
    notificationId: string,
  ): Promise<ChannelResult> {
    const override = typeof input.email === 'function' ? input.email(message.locale) : input.email;
    if (override) {
      await this.mail.send({
        to: recipient.email,
        subject: override.subject,
        text: override.text,
        html: override.html,
        template: isMailTemplate(override.template) ? override.template : 'notification',
        payload: { url: message.url, category: input.category, notificationId, locale: message.locale },
      });
    } else {
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
}
