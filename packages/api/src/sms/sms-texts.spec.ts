import { describe, expect, it } from 'vitest';
import { LRI, PDI, RLM } from '../notifications/notification-texts';
import { assistSmsBody, guarantorSmsBody, resolveNotificationLocale } from './sms-texts';

const link = 'https://blox.market/assist/tok';

describe('assistSmsBody', () => {
  it('keeps the English bodies the assisted flow sent before', () => {
    expect(assistSmsBody({ kind: 'assist_link', locale: 'en', dealerName: 'Elite Motors', link, code: '123456' })).toBe(
      `Elite Motors started your Blox vehicle financing application. Open ${link} and enter code 123456 (valid 5 minutes). Do not share this code.`,
    );
    expect(assistSmsBody({ kind: 'assist_otp', locale: 'en', dealerName: 'Elite Motors', link, code: '123456' })).toBe(
      `Your Blox verification code is 123456 (valid 5 minutes). Continue here: ${link}`,
    );
  });

  it('renders Arabic for Arabic-speaking customers with the code and link isolated', () => {
    const body = assistSmsBody({ kind: 'assist_link', locale: 'ar', dealerName: 'Elite Motors', link, code: '123456' });
    expect(body.startsWith(RLM)).toBe(true);
    expect(body).toContain('طلب تمويل سيارتك على بلوكس');
    expect(body).toContain(`${LRI}${link}${PDI}`);
    expect(body).toContain(`${LRI}123456${PDI}`);
    expect(body).toContain('لا تشارك هذا الرمز مع أحد');
    const otp = assistSmsBody({ kind: 'assist_otp', locale: 'ar', dealerName: 'Elite Motors', link, code: '654321' });
    expect(otp).toContain('رمز التحقق');
    expect(otp).toContain(`${LRI}654321${PDI}`);
  });
});

describe('guarantorSmsBody', () => {
  const glink = 'https://blox.market/guarantor/tok';

  it('names the applicant and carries the code in both languages', () => {
    const en = guarantorSmsBody({ kind: 'guarantor_link', locale: 'en', applicantName: 'Sara Ali', link: glink, code: '111222' });
    expect(en).toBe(
      `Sara Ali named you as guarantor on a Blox vehicle financing application. Open ${glink} and enter code 111222 (valid 5 minutes) to review and give your consent. Do not share this code.`,
    );
    const ar = guarantorSmsBody({ kind: 'guarantor_link', locale: 'ar', applicantName: 'Sara Ali', link: glink, code: '111222' });
    expect(ar).toContain('ضامنًا');
    expect(ar).toContain(`${LRI}111222${PDI}`);
    expect(guarantorSmsBody({ kind: 'guarantor_otp', locale: 'en', applicantName: 'x', link: glink, code: '9' })).toContain(
      'Your Blox verification code is 9',
    );
  });

  it('re-exports the locale resolver for callers of SmsService', () => {
    expect(resolveNotificationLocale('ar')).toBe('ar');
    expect(resolveNotificationLocale('en')).toBe('en');
  });
});
