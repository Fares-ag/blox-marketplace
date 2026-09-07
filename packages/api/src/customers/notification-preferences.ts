import type { NotificationPreferencesDto } from '../../../shared/src/types/customer-platform';

export type NotificationPreferences = NotificationPreferencesDto;
export type NotificationChannel = keyof NotificationPreferences['channels'];
export type ReminderPreference = keyof NotificationPreferences['reminders'];

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  channels: { email: true, sms: true, push: true, whatsapp: false },
  reminders: { payments: true, documents: true, takaful: true },
};

export type NotificationPreferencesPatch = {
  channels?: Partial<NotificationPreferences['channels']>;
  reminders?: Partial<NotificationPreferences['reminders']>;
};

function pickBooleans<T extends Record<string, boolean>>(defaults: T, raw: unknown): T {
  const out = { ...defaults };
  if (raw && typeof raw === 'object') {
    for (const key of Object.keys(defaults) as (keyof T)[]) {
      const value = (raw as Record<string, unknown>)[key as string];
      if (typeof value === 'boolean') out[key] = value as T[keyof T];
    }
  }
  return out;
}

/** Stored JSON → complete preferences, defaulting anything missing or malformed. */
export function resolveNotificationPreferences(raw: unknown): NotificationPreferences {
  const source = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    channels: pickBooleans(DEFAULT_NOTIFICATION_PREFERENCES.channels, source.channels),
    reminders: pickBooleans(DEFAULT_NOTIFICATION_PREFERENCES.reminders, source.reminders),
  };
}

/** Apply a PATCH body on top of what is stored; untouched flags keep their value. */
export function mergeNotificationPreferences(
  current: unknown,
  patch: NotificationPreferencesPatch | undefined,
): NotificationPreferences {
  const base = resolveNotificationPreferences(current);
  if (!patch) return base;
  return {
    channels: pickBooleans(base.channels, patch.channels),
    reminders: pickBooleans(base.reminders, patch.reminders),
  };
}

export function reminderEnabled(raw: unknown, kind: ReminderPreference): boolean {
  return resolveNotificationPreferences(raw).reminders[kind];
}

export function channelEnabled(raw: unknown, channel: NotificationChannel): boolean {
  return resolveNotificationPreferences(raw).channels[channel];
}
