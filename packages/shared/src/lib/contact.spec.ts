import { describe, expect, it } from 'vitest';
import { formatQatarPhone, isValidEmail, isValidQatarPhone, qatarPhoneSubscriberDigits } from './contact';

describe('isValidEmail', () => {
  // The wizard used to accept anything containing an "@", so the single
  // character "@" passed intake and the application only failed on submit.
  it('rejects the shapes a "contains @" check let through', () => {
    for (const value of ['@', 'a@', '@b.com', 'a@b', 'a@b.', 'a@.com', 'a b@c.com', 'a@b c.com', 'a@@b.com', '']) {
      expect(isValidEmail(value), value).toBe(false);
    }
  });

  it('accepts ordinary addresses, subdomains and plus tags', () => {
    for (const value of ['aisha@example.com', 'a.b+tag@mail.example.co.uk', ' spaced@example.qa ']) {
      expect(isValidEmail(value), value).toBe(true);
    }
  });

  it('rejects an address longer than the RFC limit', () => {
    expect(isValidEmail(`${'a'.repeat(250)}@example.com`)).toBe(false);
  });

  it('treats null and undefined as invalid rather than throwing', () => {
    expect(isValidEmail(null)).toBe(false);
    expect(isValidEmail(undefined)).toBe(false);
  });
});

describe('isValidQatarPhone', () => {
  it('accepts eight subscriber digits with or without the country code', () => {
    for (const value of ['55512345', '+97455512345', '97455512345', '0097455512345', '+974 5551 2345', '5551-2345']) {
      expect(isValidQatarPhone(value), value).toBe(true);
    }
  });

  it('rejects the free-form digit strings the old presence check allowed', () => {
    // Too short, too long, wrong leading digit, and not a number at all.
    for (const value of ['1234', '555123456', '95512345', '05512345', 'abcdefgh', '', '+9715551234']) {
      expect(isValidQatarPhone(value), value).toBe(false);
    }
  });

  it('exposes the subscriber digits and a canonical display form', () => {
    expect(qatarPhoneSubscriberDigits('+974 5551 2345')).toBe('55512345');
    expect(qatarPhoneSubscriberDigits('nonsense')).toBeNull();
    expect(formatQatarPhone('97455512345')).toBe('+974 5551 2345');
    expect(formatQatarPhone('1234')).toBeNull();
  });
});
