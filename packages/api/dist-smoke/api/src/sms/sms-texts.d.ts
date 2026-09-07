import { resolveNotificationLocale, type NotificationLocale } from '../notifications/notification-texts';
export { resolveNotificationLocale, type NotificationLocale };
export type AssistSmsInput = {
    kind: 'assist_link' | 'assist_otp';
    locale: NotificationLocale;
    dealerName: string;
    link: string;
    code: string;
};
export declare function assistSmsBody(input: AssistSmsInput): string;
export type GuarantorSmsInput = {
    kind: 'guarantor_link' | 'guarantor_otp';
    locale: NotificationLocale;
    applicantName: string;
    link: string;
    code: string;
};
export declare function guarantorSmsBody(input: GuarantorSmsInput): string;
