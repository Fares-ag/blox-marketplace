export declare const NOTIFICATION_CATEGORIES: readonly ["payments", "documents", "takaful", "application", "security"];
export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];
export declare const NOTIFICATION_CHANNELS: readonly ["in_app", "email", "sms", "whatsapp", "push"];
export type NotificationChannelName = (typeof NOTIFICATION_CHANNELS)[number];
export type NotificationLocale = 'en' | 'ar';
export type LocalizedTextMap = {
    en: string;
    ar?: string;
};
export type LocalizedText = string | LocalizedTextMap;
export declare function resolveLocalizedText(value: LocalizedText | null | undefined, locale: NotificationLocale): string | null;
export type NotificationData = Record<string, string | number | boolean | null | undefined>;
export type NotificationEmailOverride = {
    subject: string;
    text: string;
    html?: string;
    template?: string;
};
export type NotificationDispatchInput = {
    userId: string;
    category: NotificationCategory;
    title: LocalizedText;
    body?: LocalizedText | null;
    linkPath?: string | null;
    data?: NotificationData;
    email?: NotificationEmailOverride | ((locale: NotificationLocale) => NotificationEmailOverride);
};
export type ChannelOutcome = 'sent' | 'logged' | 'skipped' | 'failed';
export type ChannelResult = {
    outcome: ChannelOutcome;
    reason?: string;
};
export type NotificationDispatchResult = {
    notification_id: string | null;
    channels: Record<NotificationChannelName, ChannelResult>;
};
export interface NotificationRouter {
    dispatch(input: NotificationDispatchInput): Promise<NotificationDispatchResult>;
}
export declare const NOTIFICATION_ROUTER = "NOTIFICATION_ROUTER";
export declare function isNotificationCategory(value: unknown): value is NotificationCategory;
export declare function inAppOnlyDispatchResult(notificationId: string | null, reason: string): NotificationDispatchResult;
