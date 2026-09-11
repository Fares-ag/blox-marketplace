import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { findForbiddenTerms } from '@drivemarket/shared/domain-rules';
import {
  escapeHtml,
  finalizeText,
  formatQatarDate,
  formatQatarDateTime,
  FSI,
  isolateAuto,
  isolateLtr,
  localizedText,
  LRI,
  notificationTexts,
  PDI,
  resolveNotificationLocale,
  RLM,
  rtlSafeText,
  wrapHtml,
  type NotificationTextCatalog,
} from './notification-texts';

const ARABIC = /[؀-ۿ]/;

describe('resolveNotificationLocale', () => {
  it('selects Arabic only for an Arabic preferred language and falls back to English', () => {
    expect(resolveNotificationLocale('ar')).toBe('ar');
    expect(resolveNotificationLocale(' AR ')).toBe('ar');
    expect(resolveNotificationLocale('ar-QA')).toBe('ar');
    expect(resolveNotificationLocale('en')).toBe('en');
    expect(resolveNotificationLocale('fr')).toBe('en');
    expect(resolveNotificationLocale(null)).toBe('en');
    expect(resolveNotificationLocale(undefined)).toBe('en');
  });
});

describe('catalogs', () => {
  const en = notificationTexts('en');
  const ar = notificationTexts('ar');

  it('define the same keys in both languages, and every Arabic entry is real Arabic', () => {
    const keys = Object.keys(en).sort() as (keyof NotificationTextCatalog)[];
    expect(Object.keys(ar).sort()).toEqual(keys);
    const sample = {
      greeting: ['Sara'],
      openInBloxLine: ['https://blox.market/x'],
      paymentTitle: ['overdue'],
      paymentBody: ['due_soon', { vehicle: 'Chery Tiggo 7 2026', amount: '1200.00', dueDate: '2026-09-10' }],
      documentLabel: ['passport'],
      documentTitle: [true],
      documentBody: [{ category: 'passport', days: 7, date: '2026-09-14' }],
      documentEmailSubject: [{ category: 'passport', days: 7 }],
      documentEmailLead: [{ category: 'passport', days: 7, date: '14 سبتمبر 2026' }],
      takafulTitle: [false],
      takafulBody: [{ vehicle: 'Chery Tiggo 7 2026', days: 3, date: '2026-09-10' }],
      takafulEmailSubject: [{ vehicle: 'Chery Tiggo 7 2026', days: -1 }],
      takafulEmailLead: [{ vehicle: 'Chery Tiggo 7 2026', provider: 'QIC', days: 0, date: '7 سبتمبر 2026' }],
      assistLinkSms: [{ dealerName: 'Elite Motors', link: 'https://blox.market/assist/t', code: '123456' }],
      assistOtpSms: [{ code: '123456', link: 'https://blox.market/assist/t' }],
      guarantorLinkSms: [{ applicantName: 'Sara Ali', link: 'https://blox.market/guarantor/t', code: '123456' }],
      guarantorOtpSms: [{ code: '123456', link: 'https://blox.market/guarantor/t' }],
      assistCompletedBody: [{ customerName: 'Sara Ali' }],
      assistEmailSubject: [{ dealerName: 'Elite Motors' }],
      assistEmailIntro: [{ dealerName: 'Elite Motors', agentName: 'Omar' }],
      assistEmailExpiry: [{ expires: '7 سبتمبر 2026، 3:00 م', dealerName: 'Elite Motors' }],
    } as Record<string, unknown[]>;
    for (const key of keys) {
      const entry = ar[key] as unknown;
      const value = typeof entry === 'function' ? (entry as (...args: unknown[]) => string)(...(sample[key] ?? [])) : entry;
      expect(typeof value, key).toBe('string');
      expect(value as string, key).toMatch(ARABIC);
    }
  });

  it('keeps the English wording that the crons and the assisted flow used before localisation', () => {
    expect(en.paymentBody('due_soon', { vehicle: 'Chery Tiggo 7 2026', amount: '1200.00', dueDate: '2026-09-10' })).toBe(
      'Your Chery Tiggo 7 2026 installment of QAR 1200.00 is due on 2026-09-10.',
    );
    expect(en.documentBody({ category: 'passport', days: 7, date: '2026-09-14' })).toBe(
      'Your passport expires in 7 days, on 2026-09-14. Upload the renewed document in your profile.',
    );
    expect(en.documentBody({ category: 'qid_front', days: -1, date: '2026-09-06' })).toContain('Your Qatar ID (front) expired on 2026-09-06.');
    expect(en.assistLinkSms({ dealerName: 'Elite Motors', link: 'https://b.m/assist/t', code: '123456' })).toBe(
      'Elite Motors started your Blox vehicle financing application. Open https://b.m/assist/t and enter code 123456 (valid 5 minutes). Do not share this code.',
    );
    expect(en.assistOtpSms({ code: '123456', link: 'https://b.m/assist/t' })).toBe(
      'Your Blox verification code is 123456 (valid 5 minutes). Continue here: https://b.m/assist/t',
    );
  });

  it('isolates left-to-right fragments inside Arabic plain text', () => {
    const body = ar.paymentBody('overdue', { vehicle: 'Chery Tiggo 7 2026', amount: '1200.00', dueDate: '2026-09-01' });
    expect(body).toContain(`${LRI}Chery Tiggo 7 2026${PDI}`);
    expect(body).toContain(`${LRI}1200.00${PDI}`);
    expect(body).toContain(`${LRI}2026-09-01${PDI}`);
    expect(body).toContain('ريال قطري');
    expect(ar.greeting('Sara')).toBe(`مرحبًا ${FSI}Sara${PDI}،`);
  });

  it('uses Arabic document labels and Arabic day forms', () => {
    expect(ar.documentLabel('passport')).toBe('جواز السفر');
    expect(ar.documentLabel('qid_front')).toContain('البطاقة الشخصية القطرية');
    expect(en.documentLabel('unknown_category')).toBe('unknown_category');
    expect(ar.documentEmailSubject({ category: 'passport', days: 1 })).toBe('تنتهي صلاحية جواز السفر لديك خلال يوم واحد');
    expect(ar.documentEmailSubject({ category: 'passport', days: 2 })).toBe('تنتهي صلاحية جواز السفر لديك خلال يومين');
    expect(ar.documentEmailSubject({ category: 'passport', days: 7 })).toBe(`تنتهي صلاحية جواز السفر لديك خلال ${LRI}7${PDI} أيام`);
    expect(ar.documentEmailSubject({ category: 'passport', days: 30 })).toBe(`تنتهي صلاحية جواز السفر لديك خلال ${LRI}30${PDI} يومًا`);
    expect(ar.documentEmailSubject({ category: 'passport', days: 0 })).toBe('تنتهي صلاحية جواز السفر لديك اليوم');
    expect(ar.documentEmailSubject({ category: 'passport', days: -3 })).toBe('انتهت صلاحية جواز السفر لديك');
  });

  it('escapes values and marks direction with <bdi> in HTML mode', () => {
    const enHtml = notificationTexts('en', 'html');
    const arHtml = notificationTexts('ar', 'html');
    expect(enHtml.greeting('Sara <Ali>')).toBe('Hi Sara &lt;Ali&gt;,');
    expect(arHtml.greeting('Sara <Ali>')).toBe('مرحبًا <bdi>Sara &lt;Ali&gt;</bdi>،');
    expect(arHtml.openInBloxLine('https://b.m/?a=1&b=2')).toBe('افتح في بلوكس: <bdi dir="ltr">https://b.m/?a=1&amp;b=2</bdi>');
    expect(enHtml.assistEmailIntro({ dealerName: 'Elite <Motors>', agentName: 'Omar' })).toBe(
      '<strong>Omar at Elite &lt;Motors&gt;</strong> started a vehicle financing application for you on Blox.',
    );
    expect(en.assistEmailIntro({ dealerName: 'Elite Motors', agentName: null })).toBe(
      'Elite Motors started a vehicle financing application for you on Blox.',
    );
  });
});

describe('bidi helpers', () => {
  it('isolates and marks lines right-to-left idempotently', () => {
    expect(isolateLtr('abc')).toBe(`${LRI}abc${PDI}`);
    expect(isolateAuto('abc')).toBe(`${FSI}abc${PDI}`);
    expect(isolateLtr('')).toBe('');
    const text = 'سطر\n\nhttps://b.m/x';
    const once = rtlSafeText(text);
    expect(once).toBe(`${RLM}سطر\n\n${RLM}https://b.m/x`);
    expect(rtlSafeText(once)).toBe(once);
    expect(finalizeText('plain', 'en')).toBe('plain');
    expect(finalizeText('نص', 'ar')).toBe(`${RLM}نص`);
  });

  it('wraps HTML with the document direction and escapes markup', () => {
    expect(wrapHtml('<p>x</p>', 'ar')).toBe('<div dir="rtl" lang="ar" style="text-align:start;"><p>x</p></div>');
    expect(wrapHtml('<p>x</p>', 'en')).toBe('<div dir="ltr" lang="en"><p>x</p></div>');
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;');
  });
});

describe('dates', () => {
  const date = new Date('2026-10-01T12:00:00.000Z');

  it('formats English as before and Arabic with Arabic month names and Latin digits', () => {
    expect(formatQatarDate(date, 'en')).toBe('Oct 1, 2026');
    const arabic = formatQatarDate(date, 'ar');
    expect(arabic).toContain('أكتوبر');
    expect(arabic).toContain('2026');
    expect(arabic).not.toMatch(/[٠-٩]/);
    expect(formatQatarDateTime(date, 'ar')).toContain('أكتوبر');
    expect(formatQatarDateTime(date, 'en')).toContain('Oct 1, 2026');
  });
});

describe('localizedText', () => {
  it('returns both languages with the Arabic made RTL-safe', () => {
    const value = localizedText((t) => t.paymentTitle('due_soon'));
    expect(value).toEqual({ en: 'Installment due soon', ar: `${RLM}قسط مستحق قريبًا` });
  });
});

describe('Shariah terminology', () => {
  it('keeps English notification templates free of forbidden terms', () => {
    const src = readFileSync(fileURLToPath(new URL('./notification-texts.ts', import.meta.url)), 'utf8');
    expect(findForbiddenTerms(src)).toEqual([]);
  });
});
