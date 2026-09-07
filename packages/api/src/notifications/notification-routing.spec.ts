import { describe, expect, it } from 'vitest';
import type { NotificationPreferencesDto } from '../../../shared/src/types/customer-platform';
import type { NotificationDispatchResult } from './notification-router.contract';
import {
  absoluteNotificationUrl,
  dispatchSummary,
  notificationSmsText,
  notificationWhatsAppText,
  parseOutboundChannels,
  selectNotificationChannels,
  truncateText,
  type RoutingInput,
} from './notification-routing';

const allOn: NotificationPreferencesDto = {
  channels: { email: true, sms: true, push: true, whatsapp: true },
  reminders: { payments: true, documents: true, takaful: true },
};

const allProviders = { email: true, sms: true, whatsapp: true, push: true };
const fullContact = { email: 'sara@example.com', phone: '+97455550001', deviceTokens: 2 };

function route(over: Partial<RoutingInput> = {}) {
  return selectNotificationChannels({
    category: 'application',
    preferences: allOn,
    contact: fullContact,
    providers: allProviders,
    active: true,
    ...over,
  });
}

function sent(decisions: ReturnType<typeof route>): string[] {
  return Object.entries(decisions)
    .filter(([, d]) => d.send)
    .map(([channel]) => channel);
}

describe('selectNotificationChannels', () => {
  it('sends every enabled channel when preferences, contact details and providers allow it', () => {
    expect(sent(route())).toEqual(['email', 'sms', 'whatsapp', 'push']);
  });

  it('honours the per-channel switches', () => {
    const decisions = route({
      preferences: { ...allOn, channels: { email: true, sms: false, push: false, whatsapp: false } },
    });
    expect(sent(decisions)).toEqual(['email']);
    expect(decisions.sms).toEqual({ send: false, reason: 'preference_off' });
    expect(decisions.push).toEqual({ send: false, reason: 'preference_off' });
  });

  it('applies the defaults (email/sms/push on, whatsapp off) when nothing is stored', () => {
    const decisions = route({
      preferences: {
        channels: { email: true, sms: true, push: true, whatsapp: false },
        reminders: { payments: true, documents: true, takaful: true },
      },
    });
    expect(sent(decisions)).toEqual(['email', 'sms', 'push']);
    expect(decisions.whatsapp).toEqual({ send: false, reason: 'preference_off' });
  });

  it('switches every outbound nudge off for a reminder category the customer opted out of', () => {
    const decisions = route({
      category: 'payments',
      preferences: { ...allOn, reminders: { payments: false, documents: true, takaful: true } },
    });
    expect(sent(decisions)).toEqual([]);
    for (const channel of ['email', 'sms', 'whatsapp', 'push'] as const) {
      expect(decisions[channel]).toEqual({ send: false, reason: 'reminder_off' });
    }
  });

  it('only gates reminder categories on reminders.*', () => {
    const prefs = { ...allOn, reminders: { payments: false, documents: false, takaful: false } };
    expect(sent(route({ category: 'application', preferences: prefs }))).toEqual(['email', 'sms', 'whatsapp', 'push']);
    expect(sent(route({ category: 'documents', preferences: prefs }))).toEqual([]);
    expect(sent(route({ category: 'takaful', preferences: prefs }))).toEqual([]);
  });

  it('always emails security notices even when the customer switched email off', () => {
    const prefs = { ...allOn, channels: { email: false, sms: false, push: false, whatsapp: false } };
    const decisions = route({ category: 'security', preferences: prefs });
    expect(decisions.email).toEqual({ send: true, forced: true });
    expect(decisions.sms).toEqual({ send: false, reason: 'preference_off' });
    // Still needs an address on file.
    expect(route({ category: 'security', preferences: prefs, contact: { ...fullContact, email: null } }).email).toEqual({
      send: false,
      reason: 'no_contact',
    });
  });

  it('skips channels without contact details', () => {
    const decisions = route({ contact: { email: '', phone: null, deviceTokens: 0 } });
    expect(decisions.email).toEqual({ send: false, reason: 'no_contact' });
    expect(decisions.sms).toEqual({ send: false, reason: 'no_contact' });
    expect(decisions.whatsapp).toEqual({ send: false, reason: 'no_contact' });
    expect(decisions.push).toEqual({ send: false, reason: 'no_contact' });
  });

  it('skips channels whose provider is disabled', () => {
    const decisions = route({ providers: { email: false, sms: true, whatsapp: false, push: true } });
    expect(decisions.email).toEqual({ send: false, reason: 'provider_disabled' });
    expect(decisions.whatsapp).toEqual({ send: false, reason: 'provider_disabled' });
    expect(sent(decisions)).toEqual(['sms', 'push']);
  });

  it('sends nothing outbound to a deactivated account', () => {
    const decisions = route({ active: false, category: 'security' });
    expect(sent(decisions)).toEqual([]);
    expect(decisions.email).toEqual({ send: false, reason: 'user_inactive' });
  });
});

describe('parseOutboundChannels', () => {
  it('defaults to every channel and understands `none`', () => {
    expect([...parseOutboundChannels(undefined)]).toEqual(['email', 'sms', 'whatsapp', 'push']);
    expect([...parseOutboundChannels('  ')]).toEqual(['email', 'sms', 'whatsapp', 'push']);
    expect([...parseOutboundChannels('none')]).toEqual([]);
  });

  it('keeps only known channels', () => {
    expect([...parseOutboundChannels('Email, push ,fax')]).toEqual(['email', 'push']);
  });
});

describe('notification text builders', () => {
  it('truncates with an ellipsis only when needed', () => {
    expect(truncateText('short', 10)).toBe('short');
    expect(truncateText('a'.repeat(12), 10)).toBe(`${'a'.repeat(9)}…`);
  });

  it('keeps the link intact in SMS text and trims the message instead', () => {
    const url = 'https://blox.market/app/applications/abc';
    const text = notificationSmsText({ title: 'Installment due soon', body: 'x'.repeat(600), url }, 160);
    expect(text.endsWith(` ${url}`)).toBe(true);
    expect(text.length).toBeLessThanOrEqual(160);
    expect(text.startsWith('Installment due soon — ')).toBe(true);
  });

  it('formats WhatsApp with a bold title and the link on its own line', () => {
    expect(notificationWhatsAppText({ title: 'Hello', body: 'Body', url: 'https://x.y/z' })).toBe(
      '*Hello*\nBody\nhttps://x.y/z',
    );
    expect(notificationWhatsAppText({ title: 'Hello', body: null, url: null })).toBe('*Hello*');
  });
});

describe('absoluteNotificationUrl', () => {
  const urls = {
    marketplace: 'https://blox.market/',
    admin: 'https://admin.blox.market',
    superAdmin: 'https://super.blox.market',
    dealer: 'https://dealer.blox.market',
    credit: 'https://credit.blox.market',
    finance: 'https://finance.blox.market',
  };

  it('picks the portal for the recipient role', () => {
    expect(absoluteNotificationUrl('/app/applications/1', 'customer', urls)).toBe('https://blox.market/app/applications/1');
    expect(absoluteNotificationUrl('/applications/1', 'dealer_agent', urls)).toBe('https://dealer.blox.market/applications/1');
    expect(absoluteNotificationUrl('applications/1', 'credit_officer', urls)).toBe('https://credit.blox.market/applications/1');
    expect(absoluteNotificationUrl('/partner/applications/1', 'partner_viewer', urls)).toBe(
      'https://finance.blox.market/partner/applications/1',
    );
    expect(absoluteNotificationUrl('/x', 'super_admin', urls)).toBe('https://super.blox.market/x');
    expect(absoluteNotificationUrl('/x', 'group_admin', urls)).toBe('https://admin.blox.market/x');
  });

  it('passes absolute links through and returns null for empty paths', () => {
    expect(absoluteNotificationUrl('https://kyc.example/verify', 'customer', urls)).toBe('https://kyc.example/verify');
    expect(absoluteNotificationUrl('  ', 'customer', urls)).toBeNull();
    expect(absoluteNotificationUrl(null, 'customer', urls)).toBeNull();
  });
});

describe('dispatchSummary', () => {
  it('flattens outcomes and reasons for audit metadata', () => {
    const result: NotificationDispatchResult = {
      notification_id: 'n1',
      channels: {
        in_app: { outcome: 'sent' },
        email: { outcome: 'sent' },
        sms: { outcome: 'skipped', reason: 'preference_off' },
        whatsapp: { outcome: 'logged', reason: 'log' },
        push: { outcome: 'failed', reason: 'fcm_error' },
      },
    };
    expect(dispatchSummary(result)).toEqual({
      in_app: 'sent',
      email: 'sent',
      sms: 'skipped:preference_off',
      whatsapp: 'logged:log',
      push: 'failed:fcm_error',
    });
  });
});
