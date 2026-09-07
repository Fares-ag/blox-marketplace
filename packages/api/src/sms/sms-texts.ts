import {
  finalizeText,
  notificationTexts,
  resolveNotificationLocale,
  type NotificationLocale,
} from '../notifications/notification-texts';

export { resolveNotificationLocale, type NotificationLocale };

/**
 * Localised SMS bodies for the one-time-code flows. The strings themselves
 * live in `notifications/notification-texts.ts`; this module is the entry
 * point for callers of `SmsService` (assisted sessions, guarantor sessions).
 * Pass the customer's / applicant's `preferredLanguage` through
 * `resolveNotificationLocale` to pick the language.
 */

export type AssistSmsInput = {
  kind: 'assist_link' | 'assist_otp';
  locale: NotificationLocale;
  dealerName: string;
  link: string;
  code: string;
};

export function assistSmsBody(input: AssistSmsInput): string {
  const t = notificationTexts(input.locale);
  const body = input.kind === 'assist_link' ? t.assistLinkSms(input) : t.assistOtpSms(input);
  return finalizeText(body, input.locale);
}

export type GuarantorSmsInput = {
  kind: 'guarantor_link' | 'guarantor_otp';
  locale: NotificationLocale;
  /** Applicant who named the guarantor (shown in the first message). */
  applicantName: string;
  link: string;
  code: string;
};

export function guarantorSmsBody(input: GuarantorSmsInput): string {
  const t = notificationTexts(input.locale);
  const body = input.kind === 'guarantor_link' ? t.guarantorLinkSms(input) : t.guarantorOtpSms(input);
  return finalizeText(body, input.locale);
}
