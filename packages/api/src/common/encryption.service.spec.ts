import { describe, expect, it } from 'vitest';
import type { ConfigService } from '@nestjs/config';
import { EncryptionService } from './encryption.service';

function config(values: Record<string, string>) {
  return { get: (k: string) => values[k] } as unknown as ConfigService;
}

const KEY = Buffer.alloc(32, 7).toString('base64');
const SECRET = 'Qm9vdHN0cmFwLXRlc3Qtc2VjcmV0LXdpdGgtZW50cm9weS0xMjM0NTY3ODkw';

describe('EncryptionService', () => {
  it('round-trips a value and never repeats ciphertext', () => {
    const svc = new EncryptionService(config({ FIELD_ENCRYPTION_KEY: KEY, BETTER_AUTH_SECRET: SECRET }));
    const a = svc.encrypt('28012345678');
    const b = svc.encrypt('28012345678');
    expect(a).not.toBe(b);
    expect(svc.decrypt(a)).toBe('28012345678');
    expect(svc.decrypt(b)).toBe('28012345678');
  });

  it('rejects tampered payloads', () => {
    const svc = new EncryptionService(config({ FIELD_ENCRYPTION_KEY: KEY, BETTER_AUTH_SECRET: SECRET }));
    const enc = svc.encrypt('secret');
    const parts = enc.split(':');
    parts[3] = parts[3].slice(0, -2) + (parts[3].endsWith('AA') ? 'BB' : 'AA');
    expect(() => svc.decrypt(parts.join(':'))).toThrow();
  });

  it('produces a stable blind index that ignores QID formatting', () => {
    const svc = new EncryptionService(config({ FIELD_ENCRYPTION_KEY: KEY, BETTER_AUTH_SECRET: SECRET }));
    expect(svc.qidHash('280 1234 5678')).toBe(svc.qidHash('28012345678'));
    expect(svc.qidHash('')).toBeNull();
    expect(svc.qidHash('28012345678')).not.toBe(svc.qidHash('28012345679'));
  });

  it('refuses malformed keys', () => {
    expect(() => new EncryptionService(config({ FIELD_ENCRYPTION_KEY: 'short', BETTER_AUTH_SECRET: SECRET }))).toThrow();
  });

  it('derives a development key from the auth secret when no key is configured', () => {
    const svc = new EncryptionService(config({ BETTER_AUTH_SECRET: SECRET }));
    expect(svc.decrypt(svc.encrypt('hello'))).toBe('hello');
  });
});
