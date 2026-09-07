import type { NotificationPreferencesDto } from '../../../shared/src/types/customer-platform';
export type NotificationPreferences = NotificationPreferencesDto;
export type NotificationChannel = keyof NotificationPreferences['channels'];
export type ReminderPreference = keyof NotificationPreferences['reminders'];
export declare const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences;
export type NotificationPreferencesPatch = {
    channels?: Partial<NotificationPreferences['channels']>;
    reminders?: Partial<NotificationPreferences['reminders']>;
};
export declare function resolveNotificationPreferences(raw: unknown): NotificationPreferences;
export declare function mergeNotificationPreferences(current: unknown, patch: NotificationPreferencesPatch | undefined): NotificationPreferences;
export declare function reminderEnabled(raw: unknown, kind: ReminderPreference): boolean;
export declare function channelEnabled(raw: unknown, channel: NotificationChannel): boolean;
