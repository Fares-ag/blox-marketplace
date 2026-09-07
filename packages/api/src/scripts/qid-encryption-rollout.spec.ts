import { describe, expect, it } from 'vitest';
import {
  applyEnvFiles,
  parseEnvFile,
  parseRolloutArgs,
  plaintextDropAllowed,
  planQidBackfill,
  planQidPlaintextDrop,
  type QidRolloutRow,
} from './qid-encryption-rollout';

const hashOf = (digits: string) => (digits ? `h(${digits})` : null);
const encOf = (digits: string) => `enc(${digits})`;
const decrypt = (ciphertext: string) => {
  const match = /^enc\((\d+)\)$/.exec(ciphertext);
  return match ? match[1]! : null;
};

const rows: QidRolloutRow[] = [
  { id: 'legacy', qid: '28012345678', qidEnc: null, qidHash: null },
  { id: 'formatted', qid: '280 1234 5678', qidEnc: null, qidHash: null },
  { id: 'hash-only', qid: '28012345679', qidEnc: null, qidHash: hashOf('28012345679') },
  { id: 'enc-only', qid: '28012345680', qidEnc: encOf('28012345680'), qidHash: null },
  { id: 'stale-hash', qid: '28012345681', qidEnc: encOf('28012345681'), qidHash: hashOf('00000000000') },
  { id: 'done', qid: '28012345682', qidEnc: encOf('28012345682'), qidHash: hashOf('28012345682') },
  { id: 'empty', qid: '', qidEnc: null, qidHash: null },
  { id: 'none', qid: null, qidEnc: null, qidHash: null },
];

describe('planQidBackfill', () => {
  it('encrypts every row that lacks a matching ciphertext + blind index and skips the rest', () => {
    const plan = planQidBackfill(rows, { hashOf });
    expect(plan.encrypt).toEqual([
      { id: 'legacy', qid: '28012345678', reason: 'missing_enc' },
      { id: 'formatted', qid: '28012345678', reason: 'missing_enc' },
      { id: 'hash-only', qid: '28012345679', reason: 'missing_enc' },
      { id: 'enc-only', qid: '28012345680', reason: 'missing_hash' },
      { id: 'stale-hash', qid: '28012345681', reason: 'hash_mismatch' },
    ]);
    expect(plan.skipped).toEqual([
      { id: 'done', reason: 'already_encrypted' },
      { id: 'empty', reason: 'no_qid' },
      { id: 'none', reason: 'no_qid' },
    ]);
  });

  it('is idempotent: a second pass over the written result changes nothing', () => {
    const first = planQidBackfill(rows, { hashOf });
    const after = rows.map((row) => {
      const written = first.encrypt.find((e) => e.id === row.id);
      return written ? { ...row, qidEnc: encOf(written.qid), qidHash: hashOf(written.qid) } : row;
    });
    const second = planQidBackfill(after, { hashOf });
    expect(second.encrypt).toEqual([]);
    expect(second.skipped.filter((s) => s.reason === 'already_encrypted')).toHaveLength(6);
  });

  it('re-encrypts matching rows only with --force (key rotation)', () => {
    const plan = planQidBackfill(rows, { hashOf, force: true });
    expect(plan.encrypt.find((e) => e.id === 'done')).toEqual({ id: 'done', qid: '28012345682', reason: 'forced' });
    expect(plan.skipped.map((s) => s.id)).toEqual(['empty', 'none']);
  });
});

describe('planQidPlaintextDrop', () => {
  it('clears plaintext only where ciphertext and blind index round-trip', () => {
    const plan = planQidPlaintextDrop(
      [
        ...rows,
        { id: 'bad-cipher', qid: '28012345683', qidEnc: 'garbage', qidHash: hashOf('28012345683') },
        { id: 'other-qid', qid: '28012345684', qidEnc: encOf('11111111111'), qidHash: hashOf('28012345684') },
      ],
      { decrypt, hashOf },
    );
    expect(plan.clear).toEqual(['done']);
    expect(plan.kept).toEqual([
      { id: 'legacy', reason: 'not_encrypted' },
      { id: 'formatted', reason: 'not_encrypted' },
      { id: 'hash-only', reason: 'not_encrypted' },
      { id: 'enc-only', reason: 'not_encrypted' },
      { id: 'stale-hash', reason: 'hash_mismatch' },
      { id: 'empty', reason: 'no_plaintext' },
      { id: 'none', reason: 'no_plaintext' },
      { id: 'bad-cipher', reason: 'enc_mismatch' },
      { id: 'other-qid', reason: 'enc_mismatch' },
    ]);
  });

  it('ignores formatting differences between plaintext and ciphertext', () => {
    const plan = planQidPlaintextDrop(
      [{ id: 'spaced', qid: '280-1234-5678', qidEnc: encOf('28012345678'), qidHash: hashOf('28012345678') }],
      { decrypt, hashOf },
    );
    expect(plan.clear).toEqual(['spaced']);
  });
});

describe('plaintextDropAllowed', () => {
  it('requires QID_STORE_PLAINTEXT to be explicitly off', () => {
    expect(plaintextDropAllowed({})).toBe(false);
    expect(plaintextDropAllowed({ QID_STORE_PLAINTEXT: 'true' })).toBe(false);
    expect(plaintextDropAllowed({ QID_STORE_PLAINTEXT: 'FALSE ' })).toBe(true);
    expect(plaintextDropAllowed({ QID_STORE_PLAINTEXT: '0' })).toBe(true);
  });
});

describe('parseRolloutArgs', () => {
  it('reads the flags and falls back to sane defaults', () => {
    expect(parseRolloutArgs([])).toEqual({ dryRun: false, batchSize: 200, force: false });
    expect(parseRolloutArgs(['--dry-run', '--batch=50', '--force'])).toEqual({ dryRun: true, batchSize: 50, force: true });
    expect(parseRolloutArgs(['--batch', '25'])).toEqual({ dryRun: false, batchSize: 25, force: false });
    expect(parseRolloutArgs(['--batch=-3', '--batch=abc'])).toEqual({ dryRun: false, batchSize: 200, force: false });
  });
});

describe('env file loading', () => {
  it('parses KEY=value lines with quotes, comments and export prefixes', () => {
    expect(
      parseEnvFile(
        [
          '# comment',
          'DATABASE_URL=postgresql://u:p@localhost:5432/db?schema=public',
          'export FIELD_ENCRYPTION_KEY="abc=="',
          "QID_STORE_PLAINTEXT='false'",
          'TRAILING=value # note',
          'HASH_IN_URL=http://x/#frag',
          'BAD LINE',
          '=nokey',
        ].join('\n'),
      ),
    ).toEqual({
      DATABASE_URL: 'postgresql://u:p@localhost:5432/db?schema=public',
      FIELD_ENCRYPTION_KEY: 'abc==',
      QID_STORE_PLAINTEXT: 'false',
      TRAILING: 'value',
      HASH_IN_URL: 'http://x/#frag',
    });
  });

  it('applies files in order without overriding what is already set', () => {
    const files: Record<string, string> = {
      '/api/.env': 'A=1\nB=from-api',
      '/root/.env': 'B=from-root\nC=3',
    };
    const env: Record<string, string | undefined> = { A: 'preset' };
    const loaded = applyEnvFiles(['/api/.env', '/missing/.env', '/root/.env'], env, (p) => files[p] ?? null);
    expect(loaded).toEqual(['/api/.env', '/root/.env']);
    expect(env).toEqual({ A: 'preset', B: 'from-api', C: '3' });
  });
});
