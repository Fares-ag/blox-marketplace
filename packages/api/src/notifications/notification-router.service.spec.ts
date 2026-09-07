import { describe, expect, it, vi } from 'vitest';
import { NotificationRouterService } from './notification-router.service';

type Deps = {
  user?: Record<string, unknown> | null;
  mailEnabled?: boolean;
  outbound?: string;
  sms?: { send: ReturnType<typeof vi.fn> };
  whatsapp?: { send: ReturnType<typeof vi.fn> };
  push?: { sendToUser: ReturnType<typeof vi.fn> };
};

const baseUser = {
  id: 'u1',
  name: 'Sara Ali',
  email: 'sara@example.com',
  phone: '+97455550001',
  role: 'customer',
  isActive: true,
  preferredLanguage: 'en',
  notificationPreferences: null,
  _count: { deviceTokens: 1 },
};

function build(deps: Deps = {}) {
  const prisma = {
    user: { findUnique: vi.fn().mockResolvedValue(deps.user === undefined ? baseUser : deps.user) },
    notification: { create: vi.fn().mockImplementation(async ({ data }) => ({ id: 'n1', ...data })) },
  };
  const mail = {
    enabled: deps.mailEnabled ?? true,
    send: vi.fn().mockResolvedValue(undefined),
    sendNotificationEmail: vi.fn().mockResolvedValue(undefined),
  };
  const sms = deps.sms ?? { send: vi.fn().mockResolvedValue({ delivered: true, provider: 'twilio', id: 'SM1' }) };
  const whatsapp = deps.whatsapp ?? { send: vi.fn().mockResolvedValue({ delivered: false, provider: 'log' }) };
  const push =
    deps.push ?? { sendToUser: vi.fn().mockResolvedValue({ provider: 'fcm', attempted: 1, sent: 1, pruned: 0, failed: 0 }) };
  const appConfig = {
    marketplaceUrl: 'https://blox.market',
    adminUrl: 'https://admin.blox.market',
    superAdminUrl: 'https://super.blox.market',
    dealerUrl: 'https://dealer.blox.market',
    creditUrl: 'https://credit.blox.market',
    financeUrl: 'https://finance.blox.market',
  };
  const config = { get: (key: string) => (key === 'NOTIFICATION_OUTBOUND_CHANNELS' ? deps.outbound : undefined) };
  const service = new NotificationRouterService(
    prisma as never,
    mail as never,
    sms as never,
    whatsapp as never,
    push as never,
    appConfig as never,
    config as never,
  );
  return { service, prisma, mail, sms, whatsapp, push };
}

describe('NotificationRouterService.dispatch', () => {
  it('writes the in-app row first and fans out to every enabled channel', async () => {
    const { service, prisma, mail, sms, whatsapp, push } = build({
      user: { ...baseUser, notificationPreferences: { channels: { whatsapp: true } } },
    });

    const result = await service.dispatch({
      userId: 'u1',
      category: 'application',
      title: 'Application approved',
      body: 'Your contract is ready to sign.',
      linkPath: '/app/applications/a1',
      data: { application_id: 'a1' },
    });

    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: { userId: 'u1', title: 'Application approved', body: 'Your contract is ready to sign.', linkPath: '/app/applications/a1' },
    });
    expect(result.notification_id).toBe('n1');
    expect(result.channels).toEqual({
      in_app: { outcome: 'sent' },
      email: { outcome: 'sent' },
      sms: { outcome: 'sent' },
      whatsapp: { outcome: 'logged', reason: 'log' },
      push: { outcome: 'sent' },
    });

    expect(mail.sendNotificationEmail).toHaveBeenCalledWith({
      to: 'sara@example.com',
      name: 'Sara Ali',
      title: 'Application approved',
      body: 'Your contract is ready to sign.',
      url: 'https://blox.market/app/applications/a1',
      category: 'application',
      locale: 'en',
    });
    expect(sms.send).toHaveBeenCalledWith({
      to: '+97455550001',
      body: 'Application approved — Your contract is ready to sign. https://blox.market/app/applications/a1',
      kind: 'notification',
    });
    expect(whatsapp.send).toHaveBeenCalledWith({
      to: '+97455550001',
      body: '*Application approved*\nYour contract is ready to sign.\nhttps://blox.market/app/applications/a1',
      kind: 'notification',
    });
    expect(push.sendToUser).toHaveBeenCalledWith('u1', {
      title: 'Application approved',
      body: 'Your contract is ready to sign.',
      linkPath: '/app/applications/a1',
      data: { application_id: 'a1', category: 'application', notification_id: 'n1' },
    });
  });

  it('respects channel and reminder preferences and reports why a channel was skipped', async () => {
    const { service, mail, sms, push } = build({
      user: {
        ...baseUser,
        notificationPreferences: { channels: { sms: false }, reminders: { documents: false } },
      },
    });

    const payments = await service.dispatch({ userId: 'u1', category: 'payments', title: 'Installment due soon' });
    expect(payments.channels.email).toEqual({ outcome: 'sent' });
    expect(payments.channels.sms).toEqual({ outcome: 'skipped', reason: 'preference_off' });
    expect(payments.channels.whatsapp).toEqual({ outcome: 'skipped', reason: 'preference_off' });
    expect(payments.channels.push).toEqual({ outcome: 'sent' });

    const documents = await service.dispatch({ userId: 'u1', category: 'documents', title: 'Document expiring soon' });
    expect(documents.channels.in_app).toEqual({ outcome: 'sent' });
    expect(documents.channels.email).toEqual({ outcome: 'skipped', reason: 'reminder_off' });
    expect(documents.channels.push).toEqual({ outcome: 'skipped', reason: 'reminder_off' });

    expect(mail.sendNotificationEmail).toHaveBeenCalledTimes(1);
    expect(sms.send).not.toHaveBeenCalled();
    expect(push.sendToUser).toHaveBeenCalledTimes(1);
  });

  it('uses the custom email rendering when a caller supplies one, gated the same way', async () => {
    const { service, mail } = build();
    await service.dispatch({
      userId: 'u1',
      category: 'takaful',
      title: 'Takaful policy expiring soon',
      body: 'Renew it.',
      linkPath: '/app/applications/a1',
      email: { subject: 'Custom subject', text: 'Custom text', html: '<p>Custom</p>', template: 'takaful_renewal' },
    });
    expect(mail.sendNotificationEmail).not.toHaveBeenCalled();
    expect(mail.send).toHaveBeenCalledWith({
      to: 'sara@example.com',
      subject: 'Custom subject',
      text: 'Custom text',
      html: '<p>Custom</p>',
      template: 'takaful_renewal',
      payload: { url: 'https://blox.market/app/applications/a1', category: 'takaful', notificationId: 'n1', locale: 'en' },
    });

    const { service: other, mail: otherMail } = build();
    await other.dispatch({
      userId: 'u1',
      category: 'application',
      title: 'x',
      email: { subject: 's', text: 't', template: 'not-a-template' },
    });
    expect(otherMail.send.mock.calls[0]![0].template).toBe('notification');
  });

  it('skips email when mail is not configured and honours the platform allow-list', async () => {
    const { service, sms, push } = build({ mailEnabled: false, outbound: 'sms' });
    const result = await service.dispatch({ userId: 'u1', category: 'application', title: 'x' });
    expect(result.channels.email).toEqual({ outcome: 'skipped', reason: 'provider_disabled' });
    expect(result.channels.push).toEqual({ outcome: 'skipped', reason: 'provider_disabled' });
    expect(result.channels.sms).toEqual({ outcome: 'sent' });
    expect(sms.send).toHaveBeenCalledTimes(1);
    expect(push.sendToUser).not.toHaveBeenCalled();
  });

  it('isolates provider failures per channel and never throws', async () => {
    const { service } = build({
      sms: { send: vi.fn().mockRejectedValue(new Error('sms_gateway_error')) },
      push: { sendToUser: vi.fn().mockResolvedValue({ provider: 'fcm', attempted: 2, sent: 0, pruned: 2, failed: 0 }) },
    });
    const result = await service.dispatch({ userId: 'u1', category: 'security', title: 'New sign-in' });
    expect(result.channels.email).toEqual({ outcome: 'sent' });
    expect(result.channels.sms).toEqual({ outcome: 'failed', reason: 'sms_gateway_error' });
    expect(result.channels.push).toEqual({ outcome: 'failed', reason: 'tokens_pruned' });
  });

  it('forces email for security notices even when the customer switched email off', async () => {
    const { service, mail } = build({
      user: { ...baseUser, notificationPreferences: { channels: { email: false, sms: false, push: false } } },
    });
    const result = await service.dispatch({ userId: 'u1', category: 'security', title: 'Password changed' });
    expect(result.channels.email).toEqual({ outcome: 'sent' });
    expect(result.channels.sms).toEqual({ outcome: 'skipped', reason: 'preference_off' });
    expect(mail.sendNotificationEmail).toHaveBeenCalledTimes(1);
  });

  it('builds portal links from the recipient role', async () => {
    const { service, mail } = build({ user: { ...baseUser, role: 'dealer_agent', _count: { deviceTokens: 0 } } });
    const result = await service.dispatch({
      userId: 'u1',
      category: 'application',
      title: 'Assisted session completed',
      linkPath: '/applications/a1',
    });
    expect(mail.sendNotificationEmail.mock.calls[0]![0].url).toBe('https://dealer.blox.market/applications/a1');
    expect(result.channels.push).toEqual({ outcome: 'skipped', reason: 'no_contact' });
  });

  it('renders in Arabic for recipients whose preferred language is ar, falling back to English text', async () => {
    const { service, prisma, mail, sms } = build({ user: { ...baseUser, preferredLanguage: 'ar' } });
    const emailOverride = vi.fn((locale: string) => ({ subject: `subject-${locale}`, text: 'text', template: 'document_expiry' }));

    const result = await service.dispatch({
      userId: 'u1',
      category: 'documents',
      title: { en: 'Document expiring soon', ar: 'مستند على وشك انتهاء الصلاحية' },
      body: { en: 'English body', ar: 'نص عربي' },
      linkPath: '/app/profile',
      email: emailOverride,
    });

    expect(result.channels.email).toEqual({ outcome: 'sent' });
    expect(prisma.notification.create.mock.calls[0]![0].data).toMatchObject({
      title: 'مستند على وشك انتهاء الصلاحية',
      body: 'نص عربي',
    });
    expect(emailOverride).toHaveBeenCalledWith('ar');
    expect(mail.send.mock.calls[0]![0]).toMatchObject({ subject: 'subject-ar', payload: { locale: 'ar' } });
    const smsBody = sms.send.mock.calls[0]![0].body as string;
    expect(smsBody).toContain('نص عربي');
    expect(smsBody).toContain('⁦https://blox.market/app/profile⁩');
    expect(smsBody.startsWith('‏')).toBe(true);

    // Without an Arabic variant the English text is used, and the generic email still renders in Arabic chrome.
    await service.dispatch({ userId: 'u1', category: 'application', title: { en: 'English only' }, body: 'plain string' });
    expect(prisma.notification.create.mock.calls[1]![0].data).toMatchObject({ title: 'English only', body: 'plain string' });
    expect(mail.sendNotificationEmail.mock.calls[0]![0]).toMatchObject({ title: 'English only', locale: 'ar' });
  });

  it('drops the notification gracefully when the recipient no longer exists', async () => {
    const { service, prisma } = build({ user: null });
    const result = await service.dispatch({ userId: 'ghost', category: 'application', title: 'x' });
    expect(result.notification_id).toBeNull();
    expect(result.channels.in_app).toEqual({ outcome: 'skipped', reason: 'user_not_found' });
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });
});
