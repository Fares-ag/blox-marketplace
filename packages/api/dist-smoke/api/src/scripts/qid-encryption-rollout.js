"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ROLLOUT_ENV_FILES = exports.DEFAULT_ROLLOUT_BATCH_SIZE = void 0;
exports.normalizeQidDigits = normalizeQidDigits;
exports.planQidBackfill = planQidBackfill;
exports.planQidPlaintextDrop = planQidPlaintextDrop;
exports.plaintextDropAllowed = plaintextDropAllowed;
exports.parseRolloutArgs = parseRolloutArgs;
exports.parseEnvFile = parseEnvFile;
exports.applyEnvFiles = applyEnvFiles;
exports.createQidRolloutCrypto = createQidRolloutCrypto;
const node_fs_1 = require("node:fs");
const config_1 = require("@nestjs/config");
const encryption_service_1 = require("../common/encryption.service");
function normalizeQidDigits(qid) {
    return String(qid ?? '').replace(/\D/g, '');
}
function planQidBackfill(rows, opts) {
    const plan = { encrypt: [], skipped: [] };
    for (const row of rows) {
        const digits = normalizeQidDigits(row.qid);
        if (!digits) {
            plan.skipped.push({ id: row.id, reason: 'no_qid' });
            continue;
        }
        const hashMatches = Boolean(row.qidHash) && row.qidHash === opts.hashOf(digits);
        if (row.qidEnc && hashMatches) {
            if (opts.force)
                plan.encrypt.push({ id: row.id, qid: digits, reason: 'forced' });
            else
                plan.skipped.push({ id: row.id, reason: 'already_encrypted' });
            continue;
        }
        const reason = !row.qidEnc ? 'missing_enc' : !row.qidHash ? 'missing_hash' : 'hash_mismatch';
        plan.encrypt.push({ id: row.id, qid: digits, reason });
    }
    return plan;
}
function planQidPlaintextDrop(rows, opts) {
    const plan = { clear: [], kept: [] };
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
function plaintextDropAllowed(env) {
    const raw = (env.QID_STORE_PLAINTEXT ?? '').trim().toLowerCase();
    return raw === 'false' || raw === '0';
}
exports.DEFAULT_ROLLOUT_BATCH_SIZE = 200;
function parseRolloutArgs(argv, defaults = {}) {
    const args = {
        dryRun: defaults.dryRun ?? false,
        batchSize: defaults.batchSize ?? exports.DEFAULT_ROLLOUT_BATCH_SIZE,
        force: defaults.force ?? false,
    };
    for (let i = 0; i < argv.length; i += 1) {
        const arg = argv[i];
        if (arg === '--dry-run')
            args.dryRun = true;
        else if (arg === '--force')
            args.force = true;
        else if (arg.startsWith('--batch='))
            args.batchSize = positiveInt(arg.slice('--batch='.length), args.batchSize);
        else if (arg === '--batch') {
            args.batchSize = positiveInt(argv[i + 1], args.batchSize);
            i += 1;
        }
    }
    return args;
}
function positiveInt(raw, fallback) {
    const n = Number.parseInt(String(raw ?? ''), 10);
    return Number.isFinite(n) && n > 0 ? n : fallback;
}
exports.ROLLOUT_ENV_FILES = ['.env', '.env.local', '../../.env', '../../.env.local'];
function parseEnvFile(content) {
    const out = {};
    for (const rawLine of content.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || line.startsWith('#'))
            continue;
        const eq = line.indexOf('=');
        if (eq <= 0)
            continue;
        let key = line.slice(0, eq).trim();
        if (key.startsWith('export '))
            key = key.slice('export '.length).trim();
        if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key))
            continue;
        let value = line.slice(eq + 1).trim();
        const quoted = (value.startsWith('"') && value.endsWith('"') && value.length >= 2) ||
            (value.startsWith("'") && value.endsWith("'") && value.length >= 2);
        if (quoted) {
            value = value.slice(1, -1);
        }
        else {
            const comment = value.search(/\s#/);
            if (comment >= 0)
                value = value.slice(0, comment).trim();
        }
        out[key] = value;
    }
    return out;
}
function applyEnvFiles(paths, env = process.env, read = (p) => ((0, node_fs_1.existsSync)(p) ? (0, node_fs_1.readFileSync)(p, 'utf8') : null)) {
    const loaded = [];
    for (const path of paths) {
        const content = read(path);
        if (content === null)
            continue;
        loaded.push(path);
        for (const [key, value] of Object.entries(parseEnvFile(content))) {
            if (env[key] === undefined)
                env[key] = value;
        }
    }
    return loaded;
}
function createQidRolloutCrypto() {
    const encryption = new encryption_service_1.EncryptionService(new config_1.ConfigService());
    return {
        encrypt: (digits) => encryption.encrypt(digits),
        decrypt: (ciphertext) => {
            try {
                return encryption.decrypt(ciphertext);
            }
            catch {
                return null;
            }
        },
        hashOf: (digits) => encryption.qidHash(digits),
    };
}
//# sourceMappingURL=qid-encryption-rollout.js.map