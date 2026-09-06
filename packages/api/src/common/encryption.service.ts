import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, createHmac, randomBytes, scryptSync } from 'node:crypto';
import { resolveAuthSecret } from '../auth/auth-config';

const VERSION = 'v1';
const ALGO = 'aes-256-gcm';
const IV_BYTES = 12;

/**
 * Field-level encryption and blind indexing (LOS FSD §11.1).
 *
 *   encrypt()     AES-256-GCM, `v1:<iv>:<tag>:<ciphertext>` (base64url parts)
 *   blindIndex()  HMAC-SHA256 of a normalised value — lets us look a customer up
 *                 by Qatar ID (dedup) without storing the ID in a searchable form
 *
 * Key material: FIELD_ENCRYPTION_KEY (32 bytes, base64 or hex). Production
 * refuses to boot without it; development derives one from BETTER_AUTH_SECRET
 * so local data stays readable across restarts.
 */
@Injectable()
export class EncryptionService {
  private readonly logger = new Logger(EncryptionService.name);
  private readonly key: Buffer;
  private readonly indexKey: Buffer;

  constructor(config: ConfigService) {
    const raw = config.get<string>('FIELD_ENCRYPTION_KEY')?.trim();
    if (raw) {
      this.key = EncryptionService.parseKey(raw);
    } else {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('FIELD_ENCRYPTION_KEY is required in production (32 bytes, base64 or hex)');
      }
      this.logger.warn('FIELD_ENCRYPTION_KEY not set — deriving a development key from BETTER_AUTH_SECRET');
      this.key = scryptSync(resolveAuthSecret(config), 'drivemarket-field-encryption', 32);
    }
    // Separate key for the blind index so a leaked index key cannot decrypt data.
    this.indexKey = createHmac('sha256', this.key).update('blind-index').digest();
  }

  private static parseKey(raw: string): Buffer {
    const hex = /^[0-9a-fA-F]{64}$/.test(raw) ? Buffer.from(raw, 'hex') : null;
    const buf = hex ?? Buffer.from(raw, 'base64');
    if (buf.length !== 32) {
      throw new Error('FIELD_ENCRYPTION_KEY must decode to exactly 32 bytes');
    }
    return buf;
  }

  encrypt(plain: string): string {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGO, this.key, iv);
    const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return [VERSION, iv.toString('base64url'), tag.toString('base64url'), ct.toString('base64url')].join(':');
  }

  decrypt(payload: string): string {
    const [version, ivB64, tagB64, ctB64] = payload.split(':');
    if (version !== VERSION || !ivB64 || !tagB64 || !ctB64) {
      throw new Error('encrypted_payload_invalid');
    }
    const decipher = createDecipheriv(ALGO, this.key, Buffer.from(ivB64, 'base64url'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64url'));
    return Buffer.concat([decipher.update(Buffer.from(ctB64, 'base64url')), decipher.final()]).toString('utf8');
  }

  /** Deterministic keyed hash for equality lookups (never reversible). */
  blindIndex(value: string): string {
    return createHmac('sha256', this.indexKey).update(value).digest('hex');
  }

  /** Blind index of a Qatar ID: digits only, so formatting never breaks dedup. */
  qidHash(qid: string | null | undefined): string | null {
    const digits = String(qid ?? '').replace(/\D/g, '');
    return digits ? this.blindIndex(`qid:${digits}`) : null;
  }

  /** Last four characters for display next to an encrypted value. */
  static lastFour(value: string | null | undefined): string | null {
    const v = String(value ?? '').replace(/\s+/g, '');
    return v ? v.slice(-4) : null;
  }
}
