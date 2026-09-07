/**
 * Contract between `ActivityService.notify` (common) and the notification
 * router (notifications). This file has no imports so either side can depend
 * on it without creating a module cycle; the router itself is resolved lazily
 * by injection token (`ModuleRef.get(NOTIFICATION_ROUTER, { strict: false })`).
 */

export const NOTIFICATION_CATEGORIES = ['payments', 'documents', 'takaful', 'application', 'security'] as const;
export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

export const NOTIFICATION_CHANNELS = ['in_app', 'email', 'sms', 'whatsapp', 'push'] as const;
export type NotificationChannelName = (typeof NOTIFICATION_CHANNELS)[number];

/** Languages the API renders notifications in; resolved from `User.preferredLanguage`. */
export type NotificationLocale = 'en' | 'ar';

/** A string in both languages (Arabic optional — English is the fallback). */
export type LocalizedTextMap = { en: string; ar?: string };
export type LocalizedText = string | LocalizedTextMap;

export function resolveLocalizedText(value: LocalizedText | null | undefined, locale: NotificationLocale): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return value;
  return (locale === 'ar' && value.ar) || value.en;
}

/** Free-form payload forwarded to push `data` (stringified) and kept for auditing. */
export type NotificationData = Record<string, string | number | boolean | null | undefined>;

/** Optional custom email rendering (e.g. the richer reminder templates); the router still gates it on preferences. */
export type NotificationEmailOverride = {
  subject: string;
  text: string;
  html?: string;
  /** A `MailTemplate` name; unknown values fall back to `notification`. */
  template?: string;
};

export type NotificationDispatchInput = {
  userId: string;
  category: NotificationCategory;
  title: LocalizedText;
  body?: LocalizedText | null;
  /** Portal-relative path (`/app/applications/:id`); made absolute per recipient role for outbound channels. */
  linkPath?: string | null;
  data?: NotificationData;
  /** Static override, or a renderer called with the recipient's locale. */
  email?: NotificationEmailOverride | ((locale: NotificationLocale) => NotificationEmailOverride);
};

export type ChannelOutcome = 'sent' | 'logged' | 'skipped' | 'failed';
export type ChannelResult = { outcome: ChannelOutcome; reason?: string };

export type NotificationDispatchResult = {
  /** Id of the in-app row, or null when the recipient does not exist. */
  notification_id: string | null;
  channels: Record<NotificationChannelName, ChannelResult>;
};

export interface NotificationRouter {
  dispatch(input: NotificationDispatchInput): Promise<NotificationDispatchResult>;
}

/** Injection token for the router; string so it survives module duplication in test runners. */
export const NOTIFICATION_ROUTER = 'NOTIFICATION_ROUTER';

export function isNotificationCategory(value: unknown): value is NotificationCategory {
  return typeof value === 'string' && (NOTIFICATION_CATEGORIES as readonly string[]).includes(value);
}

/** Result shape when only the in-app row was written (router unavailable, recipient missing, ...). */
export function inAppOnlyDispatchResult(notificationId: string | null, reason: string): NotificationDispatchResult {
  const skipped: ChannelResult = { outcome: 'skipped', reason };
  return {
    notification_id: notificationId,
    channels: {
      in_app: notificationId ? { outcome: 'sent' } : skipped,
      email: skipped,
      sms: skipped,
      whatsapp: skipped,
      push: skipped,
    },
  };
}
