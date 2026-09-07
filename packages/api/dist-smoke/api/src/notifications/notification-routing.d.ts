import type { NotificationPreferencesDto } from '../../../shared/src/types/customer-platform';
import type { NotificationCategory, NotificationChannelName, NotificationDispatchResult, NotificationLocale } from './notification-router.contract';
export type OutboundChannel = Exclude<NotificationChannelName, 'in_app'>;
export declare const OUTBOUND_CHANNELS: readonly OutboundChannel[];
export declare const REMINDER_CATEGORIES: readonly NotificationCategory[];
export type ChannelSkipReason = 'user_inactive' | 'reminder_off' | 'preference_off' | 'no_contact' | 'provider_disabled';
export type ChannelDecision = {
    send: true;
    forced: boolean;
} | {
    send: false;
    reason: ChannelSkipReason;
};
export type RoutingInput = {
    category: NotificationCategory;
    preferences: NotificationPreferencesDto;
    contact: {
        email: string | null;
        phone: string | null;
        deviceTokens: number;
    };
    providers: Record<OutboundChannel, boolean>;
    active?: boolean;
};
export declare function selectNotificationChannels(input: RoutingInput): Record<OutboundChannel, ChannelDecision>;
export declare function parseOutboundChannels(raw: string | undefined): Set<OutboundChannel>;
export declare function truncateText(text: string, maxChars: number): string;
export type NotificationTextInput = {
    title: string;
    body?: string | null;
    url?: string | null;
    locale?: NotificationLocale;
};
export declare function notificationSmsText(input: NotificationTextInput, maxChars?: number): string;
export declare function notificationWhatsAppText(input: NotificationTextInput, maxChars?: number): string;
export type PortalUrls = {
    marketplace: string;
    admin: string;
    superAdmin: string;
    dealer: string;
    credit: string;
    finance: string;
};
export declare function portalBaseForRole(role: string | null | undefined, urls: PortalUrls): string;
export declare function absoluteNotificationUrl(linkPath: string | null | undefined, role: string | null | undefined, urls: PortalUrls): string | null;
export declare function dispatchSummary(result: NotificationDispatchResult): Record<NotificationChannelName, string>;
