/**
 * Encrypt every `users.qid` into `qid_enc` (AES-256-GCM) + `qid_hash` (blind index).
 *
 * Idempotent and batched: rows that already carry a ciphertext and a matching
 * blind index are skipped, so the script can be re-run at any time. The
 * plaintext column is never touched here — run `npm run qid:drop-plaintext`
 * once `QID_STORE_PLAINTEXT=false` is deployed.
 *
 * Run: npm -w @drivemarket/api run qid:backfill [-- --dry-run] [-- --batch=200] [-- --force]
 *   --dry-run   report what would change without writing
 *   --batch=N   rows per batch (default 200)
 *   --force     re-encrypt rows that already match (e.g. after a key rotation)
 */
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import {
  applyEnvFiles,
  createQidRolloutCrypto,
  parseRolloutArgs,
  planQidBackfill,
  ROLLOUT_ENV_FILES,
} from '../src/scripts/qid-encryption-rollout';

const args = parseRolloutArgs(process.argv.slice(2));
const loadedEnv = applyEnvFiles(ROLLOUT_ENV_FILES.map((file) => path.resolve(__dirname, '..', file)));
const prisma = new PrismaClient();
const crypto = createQidRolloutCrypto();

async function main() {
  console.log(`qid:backfill — env files: ${loadedEnv.length ? loadedEnv.join(', ') : 'none (process env only)'}`);
  console.log(`qid:backfill — batch=${args.batchSize} force=${args.force} dry_run=${args.dryRun}`);

  const totals = { scanned: 0, encrypted: 0, skipped: {} as Record<string, number> };
  let cursor: string | undefined;

  for (;;) {
    const rows = await prisma.user.findMany({
      where: { qid: { not: null } },
      select: { id: true, qid: true, qidEnc: true, qidHash: true },
      orderBy: { id: 'asc' },
      take: args.batchSize,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    if (rows.length === 0) break;

    const plan = planQidBackfill(rows, { hashOf: crypto.hashOf, force: args.force });
    for (const entry of plan.skipped) totals.skipped[entry.reason] = (totals.skipped[entry.reason] ?? 0) + 1;

    if (plan.encrypt.length > 0 && !args.dryRun) {
      await prisma.$transaction(
        plan.encrypt.map((entry) =>
          prisma.user.update({
            where: { id: entry.id },
            data: { qidEnc: crypto.encrypt(entry.qid), qidHash: crypto.hashOf(entry.qid) },
          }),
        ),
      );
    }

    totals.scanned += rows.length;
    totals.encrypted += plan.encrypt.length;
    cursor = rows[rows.length - 1]!.id;
    console.log(
      `batch: scanned=${rows.length} encrypt=${plan.encrypt.length} skipped=${plan.skipped.length}` +
        (args.dryRun ? ' (dry run — nothing written)' : ''),
    );
  }

  console.log(JSON.stringify({ ...totals, dry_run: args.dryRun }, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
