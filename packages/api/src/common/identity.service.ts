import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EncryptionService } from './encryption.service';

/**
 * Qatar ID at rest.
 *
 * Historically `users.qid` held the plaintext. The platform now keeps an
 * encrypted copy (`qid_enc`) and a blind index (`qid_hash`); the plaintext
 * column is kept in step only while `QID_STORE_PLAINTEXT` is true (default),
 * so readers can be migrated one by one and the backfill script can run
 * before the plaintext is dropped. Every writer must go through
 * `prepareQidWrite`, every reader through `readQid`.
 */
export type QidWrite = { qid: string | null; qidEnc: string | null; qidHash: string | null };
export type QidCarrier = { qid?: string | null; qidEnc?: string | null };

@Injectable()
export class IdentityService {
  private readonly storePlaintext: boolean;

  constructor(
    private readonly encryption: EncryptionService,
    config: ConfigService,
  ) {
    const raw = (config.get<string>('QID_STORE_PLAINTEXT') ?? 'true').trim().toLowerCase();
    this.storePlaintext = raw !== 'false' && raw !== '0';
  }

  /** Column values for a (possibly empty) QID; pass `undefined` to leave columns untouched. */
  prepareQidWrite(qid: string | null | undefined): QidWrite | undefined {
    if (qid === undefined) return undefined;
    const digits = String(qid ?? '').replace(/\D/g, '');
    if (!digits) return { qid: null, qidEnc: null, qidHash: null };
    return {
      qid: this.storePlaintext ? digits : null,
      qidEnc: this.encryption.encrypt(digits),
      qidHash: this.encryption.qidHash(digits),
    };
  }

  /** Plaintext QID for a row, preferring the encrypted copy. */
  readQid(row: QidCarrier | null | undefined): string | null {
    if (!row) return null;
    if (row.qidEnc) {
      try {
        return this.encryption.decrypt(row.qidEnc);
      } catch {
        /* fall through to the legacy column */
      }
    }
    return row.qid ?? null;
  }

  get plaintextRetained(): boolean {
    return this.storePlaintext;
  }
}
