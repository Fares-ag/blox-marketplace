import type { NotificationPreferencesDto } from '../../../shared/src/types/customer-platform';
import type {
  ChannelResult,
  NotificationCategory,
  NotificationChannelName,
  NotificationDispatchResult,
  NotificationLocale,
} from './notification-router.contract';
import { finalizeText, isolateLtr } from './notification-texts';

/**
 * Pure routing rules for the notification router: which outbound channels a
 * notification reaches given its category, the recipient's preferences, the
 * contact details on file and which providers are configured.
 *
 *   - in-app is always written (the inbox is the system of record);
 *   - `reminders.{payments,documents,takaful}` switch off every outbound nudge
 *     for that category;
 *   - `channels.*` switch individual outbound channels on or off;
 *   - `security` ignores the email switch: security notices always go by email
 *     (and in-app) when an address is on file.
 */

export type OutboundChannel = Exclude<NotificationChannelName, 'in_app'>;
export const OUTBOUND_CHANNELS: readonly OutboundChannel[] = ['email', 'sms', 'whatsapp', 'push'];

/** Categories whose outbound nudges the customer can switch off under `reminders.*`. */
export const REMINDER_CATEGORIES: readonly NotificationCategory[] = ['payments', 'documents', 'takaful'];

export type ChannelSkipReason =
  | 'user_inactive'
  | 'reminder_off'
  | 'preference_off'
  | 'no_contact'
  | 'provider_disabled';

export type ChannelDecision = { send: true; forced: boolean } | { send: false; reason: ChannelSkipReason };

export type RoutingInput = {
  category: NotificationCategory;
  preferences: NotificationPreferencesDto;
  contact: { email: string | null; phone: string | null; deviceTokens: number };
  /** Whether each outbound provider can take a message right now (log mode counts as available). */
  providers: Record<OutboundChannel, boolean>;
  /** Deactivated accounts keep their inbox but receive no outbound messages. */
  active?: boolean;
};

function hasContact(channel: OutboundChannel, contact: RoutingInput['contact']): boolean {
  switch (channel) {
    case 'email':
      return Boolean(contact.email?.trim());
    case 'sms':
    case 'whatsapp':
      return Boolean(contact.phone?.trim());
    case 'push':
      return contact.deviceTokens > 0;
  }
}

function reminderSwitchedOff(input: RoutingInput): boolean {
  if (!REMINDER_CATEGORIES.includes(input.category)) return false;
  const key = input.category as keyof NotificationPreferencesDto['reminders'];
  return input.preferences.reminders[key] === false;
}

export function selectNotificationChannels(input: RoutingInput): Record<OutboundChannel, ChannelDecision> {
  const decisions = {} as Record<OutboundChannel, ChannelDecision>;
  const reminderOff = reminderSwitchedOff(input);
  const security = input.category === 'security';

  for (const channel of OUTBOUND_CHANNELS) {
    const forced = security && channel === 'email';
    if (input.active === false) {
      decisions[channel] = { send: false, reason: 'user_inactive' };
    } else if (reminderOff) {
      decisions[channel] = { send: false, reason: 'reminder_off' };
    } else if (!forced && !input.preferences.channels[channel]) {
      decisions[channel] = { send: false, reason: 'preference_off' };
    } else if (!hasContact(channel, input.contact)) {
      decisions[channel] = { send: false, reason: 'no_contact' };
    } else if (!input.providers[channel]) {
      decisions[channel] = { send: false, reason: 'provider_disabled' };
    } else {
      decisions[channel] = { send: true, forced };
    }
  }
  return decisions;
}

/**
 * `NOTIFICATION_OUTBOUND_CHANNELS` — platform-wide allow-list of outbound
 * channels (comma-separated). Unset/empty means all; `none` disables every
 * outbound channel while keeping the in-app inbox.
 */
export function parseOutboundChannels(raw: string | undefined): Set<OutboundChannel> {
  const trimmed = raw?.trim();
  if (!trimmed) return new Set(OUTBOUND_CHANNELS);
  const enabled = new Set<OutboundChannel>();
  for (const part of trimmed.split(',')) {
    const key = part.trim().toLowerCase();
    if ((OUTBOUND_CHANNELS as readonly string[]).includes(key)) enabled.add(key as OutboundChannel);
  }
  return enabled;
}

export function truncateText(text: string, maxChars: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxChars) return trimmed;
  return `${trimmed.slice(0, Math.max(0, maxChars - 1)).trimEnd()}…`;
}

export type NotificationTextInput = {
  title: string;
  body?: string | null;
  url?: string | null;
  /** Arabic output isolates the link and marks lines right-to-left. */
  locale?: NotificationLocale;
};

/** Short-form text for SMS: title and body, with the link appended untouched when there is one. */
export function notificationSmsText(input: NotificationTextInput, maxChars = 480): string {
  const locale = input.locale ?? 'en';
  const url = input.url?.trim() || '';
  const link = url && locale === 'ar' ? isolateLtr(url) : url;
  const head = [input.title.trim(), input.body?.trim() || ''].filter(Boolean).join(' — ');
  const budget = link ? maxChars - link.length - 1 : maxChars;
  const text = truncateText(head, Math.max(40, budget));
  return finalizeText(link ? `${text} ${link}` : text, locale);
}

/** WhatsApp allows richer formatting: bold title, body, link on their own lines. */
export function notificationWhatsAppText(input: NotificationTextInput, maxChars = 1024): string {
  const locale = input.locale ?? 'en';
  const url = input.url?.trim() || '';
  const link = url && locale === 'ar' ? isolateLtr(url) : url;
  const lines = [`*${input.title.trim()}*`, input.body?.trim() || '', link].filter(Boolean);
  return finalizeText(truncateText(lines.join('\n'), maxChars), locale);
}

export type PortalUrls = {
  marketplace: string;
  admin: string;
  superAdmin: string;
  dealer: string;
  credit: string;
  finance: string;
};

/** Portal that a role signs in to; notification links are relative to it. */
export function portalBaseForRole(role: string | null | undefined, urls: PortalUrls): string {
  switch (role) {
    case 'dealer_agent':
      return urls.dealer;
    case 'credit_officer':
      return urls.credit;
    case 'finance_officer':
    case 'partner_viewer':
      return urls.finance;
    case 'admin':
    case 'group_admin':
      return urls.admin;
    case 'super_admin':
      return urls.superAdmin;
    default:
      return urls.marketplace;
  }
}

export function absoluteNotificationUrl(
  linkPath: string | null | undefined,
  role: string | null | undefined,
  urls: PortalUrls,
): string | null {
  const path = linkPath?.trim();
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  const base = portalBaseForRole(role, urls).replace(/\/$/, '');
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

/** Compact per-channel outcome map for audit metadata, e.g. `{ email: 'sent', sms: 'skipped:preference_off' }`. */
export function dispatchSummary(result: NotificationDispatchResult): Record<NotificationChannelName, string> {
  const summary = {} as Record<NotificationChannelName, string>;
  for (const [channel, outcome] of Object.entries(result.channels) as [NotificationChannelName, ChannelResult][]) {
    summary[channel] = outcome.reason ? `${outcome.outcome}:${outcome.reason}` : outcome.outcome;
  }
  return summary;
}
