import { describe, expect, it } from 'vitest';
import {
  channelEnabled,
  DEFAULT_NOTIFICATION_PREFERENCES,
  mergeNotificationPreferences,
  reminderEnabled,
  resolveNotificationPreferences,
} from './notification-preferences';

describe('resolveNotificationPreferences', () => {
  it('falls back to defaults for missing or malformed JSON', () => {
    expect(resolveNotificationPreferences(null)).toEqual(DEFAULT_NOTIFICATION_PREFERENCES);
    expect(resolveNotificationPreferences('nope')).toEqual(DEFAULT_NOTIFICATION_PREFERENCES);
    expect(resolveNotificationPreferences({ channels: 'x', reminders: 4 })).toEqual(DEFAULT_NOTIFICATION_PREFERENCES);
  });

  it('keeps stored booleans and ignores non-boolean values', () => {
    const prefs = resolveNotificationPreferences({
      channels: { email: false, whatsapp: true, sms: 'yes' },
      reminders: { documents: false },
    });
    expect(prefs.channels).toEqual({ email: false, sms: true, push: true, whatsapp: true });
    expect(prefs.reminders).toEqual({ payments: true, documents: false, takaful: true });
  });
});

describe('mergeNotificationPreferences', () => {
  it('only changes the flags present in the patch', () => {
    const merged = mergeNotificationPreferences(
      { channels: { email: false }, reminders: { takaful: false } },
      { reminders: { documents: false } },
    );
    expect(merged).toEqual({
      channels: { email: false, sms: true, push: true, whatsapp: false },
      reminders: { payments: true, documents: false, takaful: false },
    });
  });

  it('returns the resolved current value when there is no patch', () => {
    expect(mergeNotificationPreferences(undefined, undefined)).toEqual(DEFAULT_NOTIFICATION_PREFERENCES);
  });
});

describe('reminder and channel lookups', () => {
  it('reads reminder and channel flags with defaults', () => {
    expect(reminderEnabled(undefined, 'documents')).toBe(true);
    expect(reminderEnabled({ reminders: { documents: false } }, 'documents')).toBe(false);
    expect(reminderEnabled({ reminders: { documents: false } }, 'takaful')).toBe(true);
    expect(channelEnabled(undefined, 'email')).toBe(true);
    expect(channelEnabled({ channels: { email: false } }, 'email')).toBe(false);
    expect(channelEnabled(undefined, 'whatsapp')).toBe(false);
  });
});
