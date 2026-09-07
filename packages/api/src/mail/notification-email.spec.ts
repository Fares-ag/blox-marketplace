import { describe, expect, it } from 'vitest';
import { LRI, PDI, RLM } from '../notifications/notification-texts';
import {
  isMailTemplate,
  renderAssistedSessionEmail,
  renderDocumentExpiryEmail,
  renderNotificationEmail,
  renderTakafulRenewalEmail,
} from './mail.service';

describe('renderNotificationEmail', () => {
  it('uses the title as subject and escapes HTML in the body', () => {
    const rendered = renderNotificationEmail({
      name: 'Sara <Ali>',
      title: 'Application approved',
      body: 'Sign your contract & pay the down payment.',
      url: 'https://blox.market/app/applications/a1?x=1&y=2',
      category: 'application',
    });
    expect(rendered.subject).toBe('Application approved');
    expect(rendered.text).toContain('Hi Sara <Ali>,');
    expect(rendered.text).toContain('Sign your contract & pay the down payment.');
    expect(rendered.text).toContain('Open in Blox: https://blox.market/app/applications/a1?x=1&y=2');
    expect(rendered.html).toContain('Hi Sara &lt;Ali&gt;,');
    expect(rendered.html).toContain('Sign your contract &amp; pay the down payment.');
    expect(rendered.html).toContain('href="https://blox.market/app/applications/a1?x=1&amp;y=2"');
    expect(rendered.html).toContain('profile preferences');
    expect(rendered.html.startsWith('<div dir="ltr" lang="en">')).toBe(true);
  });

  it('omits the body and link sections when absent', () => {
    const rendered = renderNotificationEmail({ name: 'Sara', title: 'Hello', body: null, url: null, category: 'security' });
    expect(rendered.text).not.toContain('Open in Blox');
    expect(rendered.html).not.toContain('<a ');
  });

  it('renders the chrome in Arabic, right-to-left, when asked to', () => {
    const rendered = renderNotificationEmail(
      { name: 'سارة', title: 'تمت الموافقة على الطلب', body: 'وقّع العقد.', url: 'https://blox.market/app/x', category: 'application' },
      'ar',
    );
    expect(rendered.subject).toBe('تمت الموافقة على الطلب');
    expect(rendered.text.startsWith(`${RLM}مرحبًا`)).toBe(true);
    expect(rendered.text).toContain(`افتح في بلوكس: ${LRI}https://blox.market/app/x${PDI}`);
    expect(rendered.text).toContain('تفضيلات ملفك الشخصي');
    expect(rendered.html.startsWith('<div dir="rtl" lang="ar"')).toBe(true);
    expect(rendered.html).toContain('>فتح في بلوكس</a>');
  });
});

describe('reminder templates', () => {
  const expiresAt = new Date('2026-10-01T00:00:00.000Z');

  it('renders the document expiry reminder in English exactly as before', () => {
    const rendered = renderDocumentExpiryEmail({
      name: 'Sara',
      documentCategory: 'qid_front',
      expiresAt,
      daysToExpiry: 7,
      url: 'https://blox.market/app/profile',
    });
    expect(rendered.subject).toBe('Your Qatar ID (front) expires in 7 days');
    expect(rendered.text).toBe(
      'Hi Sara,\n\nThe Qatar ID (front) in your Blox document vault expires in 7 days (Oct 1, 2026).\n\n' +
        'Upload the renewed document so your financing applications are not delayed:\nhttps://blox.market/app/profile\n\n' +
        'You can switch document reminders off in your profile preferences.',
    );
    expect(rendered.html).toContain('Upload the renewed document');
  });

  it('renders the document expiry reminder in Arabic', () => {
    const rendered = renderDocumentExpiryEmail(
      { name: 'سارة', documentCategory: 'qid_front', expiresAt, daysToExpiry: 7, url: 'https://blox.market/app/profile' },
      'ar',
    );
    expect(rendered.subject).toBe(`${RLM}تنتهي صلاحية البطاقة الشخصية القطرية (الوجه الأمامي) لديك خلال ${LRI}7${PDI} أيام`);
    expect(rendered.text).toContain('خزنة مستنداتك على بلوكس');
    expect(rendered.text).toContain('أكتوبر 2026');
    expect(rendered.text).toContain(`${RLM}${LRI}https://blox.market/app/profile${PDI}`);
    expect(rendered.html.startsWith('<div dir="rtl" lang="ar"')).toBe(true);
    expect(rendered.html).toContain('>رفع المستند المجدد</a>');
  });

  it('renders the takaful renewal reminder in both languages', () => {
    const input = {
      name: 'Sara',
      vehicleLabel: 'Chery Tiggo 7 2026',
      provider: 'QIC Takaful',
      expiresAt,
      daysToExpiry: -1,
      url: 'https://blox.market/app/applications/a1',
    };
    const en = renderTakafulRenewalEmail(input);
    expect(en.subject).toBe('Takaful cover for your Chery Tiggo 7 2026 has expired');
    expect(en.text).toContain('The takaful policy with QIC Takaful covering your Chery Tiggo 7 2026 has expired (Oct 1, 2026).');
    expect(en.html).toContain('Record the renewed policy');

    const ar = renderTakafulRenewalEmail(input, 'ar');
    expect(ar.subject).toBe(`${RLM}انتهت صلاحية تغطية التكافل لسيارتك ${LRI}Chery Tiggo 7 2026${PDI}`);
    expect(ar.text).toContain('لدى');
    expect(ar.text).toContain('المشاركة المتناقصة');
    expect(ar.html).toContain('<bdi dir="ltr">Chery Tiggo 7 2026</bdi>');
    expect(ar.html).toContain('>تسجيل الوثيقة المجددة</a>');
  });

  it('renders the assisted-session email in both languages without ever including the code', () => {
    const input = { url: 'https://blox.market/assist/tok', dealerName: 'Elite Motors', agentName: 'Omar', expiresAt };
    const en = renderAssistedSessionEmail(input);
    expect(en.subject).toBe('Continue your Blox financing application with Elite Motors');
    expect(en.text).toContain('Omar at Elite Motors started a vehicle financing application for you on Blox.');
    expect(en.text).toContain('The link expires on Oct 1, 2026');
    expect(en.html).toContain('<strong>Omar at Elite Motors</strong>');
    expect(en.html).toContain('>Continue your application</a>');

    const ar = renderAssistedSessionEmail(input, 'ar');
    expect(ar.subject).toContain('تابع طلب التمويل الخاص بك على بلوكس مع');
    expect(ar.text).toContain('من');
    expect(ar.text).toContain('تنتهي صلاحية الرابط بتاريخ');
    expect(ar.html).toContain('>متابعة طلبك</a>');
    for (const rendered of [en, ar]) expect(`${rendered.text}${rendered.html}`).not.toMatch(/\b\d{6}\b/);
  });

  it('knows which template names are real', () => {
    expect(isMailTemplate('notification')).toBe(true);
    expect(isMailTemplate('takaful_renewal')).toBe(true);
    expect(isMailTemplate('marketing')).toBe(false);
    expect(isMailTemplate(undefined)).toBe(false);
  });
});
