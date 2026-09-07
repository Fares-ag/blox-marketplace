export type QidRolloutRow = {
    id: string;
    qid: string | null;
    qidEnc: string | null;
    qidHash: string | null;
};
export declare function normalizeQidDigits(qid: string | null | undefined): string;
export type BackfillReason = 'no_qid' | 'already_encrypted' | 'missing_enc' | 'missing_hash' | 'hash_mismatch' | 'forced';
export type BackfillPlan = {
    encrypt: Array<{
        id: string;
        qid: string;
        reason: BackfillReason;
    }>;
    skipped: Array<{
        id: string;
        reason: BackfillReason;
    }>;
};
export type BackfillOptions = {
    hashOf: (digits: string) => string | null;
    force?: boolean;
};
export declare function planQidBackfill(rows: readonly QidRolloutRow[], opts: BackfillOptions): BackfillPlan;
export type DropReason = 'no_plaintext' | 'not_encrypted' | 'enc_mismatch' | 'hash_mismatch';
export type DropPlan = {
    clear: string[];
    kept: Array<{
        id: string;
        reason: DropReason;
    }>;
};
export type DropOptions = {
    decrypt: (ciphertext: string) => string | null;
    hashOf: (digits: string) => string | null;
};
export declare function planQidPlaintextDrop(rows: readonly QidRolloutRow[], opts: DropOptions): DropPlan;
export declare function plaintextDropAllowed(env: Record<string, string | undefined>): boolean;
export type RolloutArgs = {
    dryRun: boolean;
    batchSize: number;
    force: boolean;
};
export declare const DEFAULT_ROLLOUT_BATCH_SIZE = 200;
export declare function parseRolloutArgs(argv: readonly string[], defaults?: Partial<RolloutArgs>): RolloutArgs;
export declare const ROLLOUT_ENV_FILES: readonly string[];
export declare function parseEnvFile(content: string): Record<string, string>;
export declare function applyEnvFiles(paths: readonly string[], env?: Record<string, string | undefined>, read?: (path: string) => string | null): string[];
export type QidRolloutCrypto = {
    encrypt: (digits: string) => string;
    decrypt: (ciphertext: string) => string | null;
    hashOf: (digits: string) => string | null;
};
export declare function createQidRolloutCrypto(): QidRolloutCrypto;
