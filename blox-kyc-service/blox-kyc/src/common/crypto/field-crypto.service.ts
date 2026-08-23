import { Injectable } from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { loadConfig, isValidBase64Key } from '../../config/configuration';

/**
 * AES-256-GCM field-level encryption for sensitive data at rest (extracted ID
 * fields, etc.). The key comes from KYC_FIELD_ENCRYPTION_KEY; in production it
 * must originate from a KMS. Ciphertext is stored as base64(iv|tag|ciphertext).
 */
@Injectable()
export class FieldCryptoService {
  private readonly key: Buffer;

  constructor() {
    const cfg = loadConfig();
    if (cfg.nodeEnv === 'production' && !isValidBase64Key(cfg.fieldEncryptionKey, 32)) {
      throw new Error('KYC_FIELD_ENCRYPTION_KEY invalid — refusing to start in production.');
    }
    // In dev, derive a throwaway key if none is set so the app still runs.
    this.key = isValidBase64Key(cfg.fieldEncryptionKey, 32)
      ? Buffer.from(cfg.fieldEncryptionKey, 'base64')
      : randomBytes(32);
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, enc]).toString('base64');
  }

  decrypt(payload: string): string {
    const raw = Buffer.from(payload, 'base64');
    const iv = raw.subarray(0, 12);
    const tag = raw.subarray(12, 28);
    const enc = raw.subarray(28);
    const decipher = createDecipheriv('aes-256-gcm', this.key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
  }

  encryptJson(value: unknown): string {
    return this.encrypt(JSON.stringify(value));
  }

  decryptJson<T>(payload: string): T {
    return JSON.parse(this.decrypt(payload)) as T;
  }
}
