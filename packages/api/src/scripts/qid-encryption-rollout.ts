import { existsSync, readFileSync } from 'node:fs';
import { ConfigService } from '@nestjs/config';
import { EncryptionService } from '../common/encryption.service';

/**
 * Pure planning logic for the QID encryption rollout scripts
 * (`scripts/backfill-qid-encryption.ts`, `scripts/drop-qid-plaintext.ts`).
 *
 * Rollout order:
 *   1. deploy the API (every write goes through `IdentityService.prepareQidWrite`,
 *      which fills `qid_enc` + `qid_hash` while keeping `qid`);
 *   2. `npm run qid:backfill` — encrypt legacy rows, idempotent, batched;
 *   3. set `QID_STORE_PLAINTEXT=false` and restart the API (readers use `qid_enc`);
 *   4. `npm run qid:drop-plaintext` — null `users.qid` where the ciphertext
 *      round-trips; refuses to run while step 3 is not done.
 */

export type QidRolloutRow = { id: string; qid: string | null; qidEnc: string | null; qidHash: string | null };

export function normalizeQidDigits(qid: string | null | undefined): string {
  return String(qid ?? '').replace(/\D/g, '');
}

export type BackfillReason = 'no_qid' | 'already_encrypted' | 'missing_enc' | 'missing_hash' | 'hash_mismatch' | 'forced';

export type BackfillPlan = {
  encrypt: Array<{ id: string; qid: string; reason: BackfillReason }>;
  skipped: Array<{ id: string; reason: BackfillReason }>;
};

export type BackfillOptions = {
  /** Blind index for a normalised QID (`EncryptionService.qidHash`). */
  hashOf: (digits: string) => string | null;
  /** Re-encrypt rows that already carry a matching ciphertext (key rotation). */
  force?: boolean;
};

/** Decide, per row, whether `qid_enc`/`qid_hash` must be (re)written. Never touches `qid`. */
export function planQidBackfill(rows: readonly QidRolloutRow[], opts: BackfillOptions): BackfillPlan {
  const plan: BackfillPlan = { encrypt: [], skipped: [] };
  for (const row of rows) {
    const digits = normalizeQidDigits(row.qid);
    if (!digits) {
      plan.skipped.push({ id: row.id, reason: 'no_qid' });
      continue;
    }
    const hashMatches = Boolean(row.qidHash) && row.qidHash === opts.hashOf(digits);
    if (row.qidEnc && hashMatches) {
      if (opts.force) plan.encrypt.push({ id: row.id, qid: digits, reason: 'forced' });
      else plan.skipped.push({ id: row.id, reason: 'already_encrypted' });
      continue;
    }
    const reason: BackfillReason = !row.qidEnc ? 'missing_enc' : !row.qidHash ? 'missing_hash' : 'hash_mismatch';
    plan.encrypt.push({ id: row.id, qid: digits, reason });
  }
  return plan;
}

export type DropReason = 'no_plaintext' | 'not_encrypted' | 'enc_mismatch' | 'hash_mismatch';

export type DropPlan = {
  clear: string[];
  kept: Array<{ id: string; reason: DropReason }>;
};

export type DropOptions = {
  /** Decrypt a ciphertext, or null when it cannot be decrypted with the current key. */
  decrypt: (ciphertext: string) => string | null;
  hashOf: (digits: string) => string | null;
};

/**
 * Only clear plaintext that provably round-trips: ciphertext decrypts to the
 * same digits and the blind index matches. Anything else is kept and reported
 * so a backfill (or key fix) can run first.
 */
export function planQidPlaintextDrop(rows: readonly QidRolloutRow[], opts: DropOptions): DropPlan {
  const plan: DropPlan = { clear: [], kept: [] };
  for (const row of rows) {
    const digits = normalizeQidDigits(row.qid);
    if (!digits) {
      plan.kept.push({ id: row.id, reason: 'no_plaintext' });
      continue;
    }
    if (!row.qidEnc || !row.qidHash) {
      plan.kept.push({ id: row.id, reason: 'not_encrypted' });
      continue;
    }
    const decrypted = opts.decrypt(row.qidEnc);
    if (!decrypted || normalizeQidDigits(decrypted) !== digits) {
      plan.kept.push({ id: row.id, reason: 'enc_mismatch' });
      continue;
    }
    if (row.qidHash !== opts.hashOf(digits)) {
      plan.kept.push({ id: row.id, reason: 'hash_mismatch' });
      continue;
    }
    plan.clear.push(row.id);
  }
  return plan;
}

/** The drop script refuses to run unless the API has stopped writing plaintext. */
export function plaintextDropAllowed(env: Record<string, string | undefined>): boolean {
  const raw = (env.QID_STORE_PLAINTEXT ?? '').trim().toLowerCase();
  return raw === 'false' || raw === '0';
}

export type RolloutArgs = { dryRun: boolean; batchSize: number; force: boolean };

export const DEFAULT_ROLLOUT_BATCH_SIZE = 200;

/** `--dry-run`, `--force`, `--batch=N` / `--batch N`; anything else is ignored. */
export function parseRolloutArgs(argv: readonly string[], defaults: Partial<RolloutArgs> = {}): RolloutArgs {
  const args: RolloutArgs = {
    dryRun: defaults.dryRun ?? false,
    batchSize: defaults.batchSize ?? DEFAULT_ROLLOUT_BATCH_SIZE,
    force: defaults.force ?? false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]!;
    if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--force') args.force = true;
    else if (arg.startsWith('--batch=')) args.batchSize = positiveInt(arg.slice('--batch='.length), args.batchSize);
    else if (arg === '--batch') {
      args.batchSize = positiveInt(argv[i + 1], args.batchSize);
      i += 1;
    }
  }
  return args;
}

function positiveInt(raw: string | undefined, fallback: number): number {
  const n = Number.parseInt(String(raw ?? ''), 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** Same lookup order as `ConfigModule.forRoot` in `app.module.ts`, relative to `packages/api`. */
export const ROLLOUT_ENV_FILES: readonly string[] = ['.env', '.env.local', '../../.env', '../../.env.local'];

/** Minimal `.env` parser: `KEY=value`, optional `export`, quotes, `#` comments. */
export function parseEnvFile(content: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    let key = line.slice(0, eq).trim();
    if (key.startsWith('export ')) key = key.slice('export '.length).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    let value = line.slice(eq + 1).trim();
    const quoted =
      (value.startsWith('"') && value.endsWith('"') && value.length >= 2) ||
      (value.startsWith("'") && value.endsWith("'") && value.length >= 2);
    if (quoted) {
      value = value.slice(1, -1);
    } else {
      const comment = value.search(/\s#/);
      if (comment >= 0) value = value.slice(0, comment).trim();
    }
    out[key] = value;
  }
  return out;
}

/** Load env files into `env` without overriding values already set; returns the files that were read. */
export function applyEnvFiles(
  paths: readonly string[],
  env: Record<string, string | undefined> = process.env,
  read: (path: string) => string | null = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : null),
): string[] {
  const loaded: string[] = [];
  for (const path of paths) {
    const content = read(path);
    if (content === null) continue;
    loaded.push(path);
    for (const [key, value] of Object.entries(parseEnvFile(content))) {
      if (env[key] === undefined) env[key] = value;
    }
  }
  return loaded;
}

export type QidRolloutCrypto = {
  encrypt: (digits: string) => string;
  decrypt: (ciphertext: string) => string | null;
  hashOf: (digits: string) => string | null;
};

/** Same key material as the running API (`FIELD_ENCRYPTION_KEY`, dev fallback from `BETTER_AUTH_SECRET`). */
export function createQidRolloutCrypto(): QidRolloutCrypto {
  const encryption = new EncryptionService(new ConfigService());
  return {
    encrypt: (digits) => encryption.encrypt(digits),
    decrypt: (ciphertext) => {
      try {
        return encryption.decrypt(ciphertext);
      } catch {
        return null;
      }
    },
    hashOf: (digits) => encryption.qidHash(digits),
  };
}
