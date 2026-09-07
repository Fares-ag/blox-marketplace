import type { LocalizedTextMap, NotificationLocale } from './notification-router.contract';
export type { NotificationLocale } from './notification-router.contract';
export declare const RLM = "\u200F";
export declare const LRI = "\u2066";
export declare const FSI = "\u2068";
export declare const PDI = "\u2069";
export declare function isolateLtr(value: string): string;
export declare function isolateAuto(value: string): string;
export declare function rtlSafeText(text: string): string;
export declare function finalizeText(text: string, locale: NotificationLocale): string;
export declare function wrapHtml(html: string, locale: NotificationLocale): string;
export declare function escapeHtml(value: string): string;
export declare function resolveNotificationLocale(preferredLanguage: string | null | undefined): NotificationLocale;
export declare function formatQatarDate(date: Date, locale?: NotificationLocale): string;
export declare function formatQatarDateTime(date: Date, locale?: NotificationLocale): string;
export type TextMode = 'text' | 'html';
export type MarkupFormat = {
    ltr: (value: string) => string;
    auto: (value: string) => string;
    strong: (value: string) => string;
};
export type PaymentReminderKind = 'due_soon' | 'overdue';
export type ExpiryValues = {
    days: number;
    date: string;
};
export interface NotificationTextCatalog {
    greeting(name: string): string;
    openInBloxLine(url: string): string;
    openInBloxLabel: string;
    notificationFooter: string;
    paymentTitle(kind: PaymentReminderKind): string;
    paymentBody(kind: PaymentReminderKind, v: {
        vehicle: string;
        amount: string;
        dueDate: string;
    }): string;
    documentLabel(category: string): string;
    documentTitle(expired: boolean): string;
    documentBody(v: {
        category: string;
    } & ExpiryValues): string;
    documentEmailSubject(v: {
        category: string;
        days: number;
    }): string;
    documentEmailLead(v: {
        category: string;
    } & ExpiryValues): string;
    documentEmailCta: string;
    documentEmailLink: string;
    documentEmailFooter: string;
    takafulTitle(expired: boolean): string;
    takafulBody(v: {
        vehicle: string;
    } & ExpiryValues): string;
    takafulEmailSubject(v: {
        vehicle: string;
        days: number;
    }): string;
    takafulEmailLead(v: {
        vehicle: string;
        provider: string | null;
    } & ExpiryValues): string;
    takafulEmailRequirement: string;
    takafulEmailCta: string;
    takafulEmailLink: string;
    takafulEmailFooter: string;
    assistLinkSms(v: {
        dealerName: string;
        link: string;
        code: string;
    }): string;
    assistOtpSms(v: {
        code: string;
        link: string;
    }): string;
    guarantorLinkSms(v: {
        applicantName: string;
        link: string;
        code: string;
    }): string;
    guarantorOtpSms(v: {
        code: string;
        link: string;
    }): string;
    assistCompletedTitle: string;
    assistCompletedBody(v: {
        customerName: string;
    }): string;
    assistEmailSubject(v: {
        dealerName: string;
    }): string;
    assistEmailIntro(v: {
        dealerName: string;
        agentName: string | null;
    }): string;
    assistEmailInstructions: string;
    assistEmailLink: string;
    assistEmailExpiry(v: {
        expires: string;
        dealerName: string;
    }): string;
    assistEmailIgnore: string;
}
export declare function notificationTexts(locale: NotificationLocale, mode?: TextMode): NotificationTextCatalog;
export declare function localizedText(build: (t: NotificationTextCatalog) => string): LocalizedTextMap;
