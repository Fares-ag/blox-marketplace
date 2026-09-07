/**
 * Null `users.qid` wherever `qid_enc` + `qid_hash` are set and provably
 * round-trip with the current FIELD_ENCRYPTION_KEY. Rows that are not (or
 * wrongly) encrypted are kept and reported — run `npm run qid:backfill` first.
 *
 * Refuses to run unless QID_STORE_PLAINTEXT=false, i.e. until the API has been
 * redeployed to stop writing plaintext (otherwise the next profile update would
 * simply re-populate the column).
 *
 * Run: npm -w @drivemarket/api run qid:drop-plaintext [-- --dry-run] [-- --batch=200]
 */
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import {
  applyEnvFiles,
  createQidRolloutCrypto,
  parseRolloutArgs,
  plaintextDropAllowed,
  planQidPlaintextDrop,
  ROLLOUT_ENV_FILES,
} from '../src/scripts/qid-encryption-rollout';

const args = parseRolloutArgs(process.argv.slice(2));
const loadedEnv = applyEnvFiles(ROLLOUT_ENV_FILES.map((file) => path.resolve(__dirname, '..', file)));

if (!plaintextDropAllowed(process.env)) {
  console.error(
    'qid:drop-plaintext refused: set QID_STORE_PLAINTEXT=false (and redeploy the API so it stops writing plaintext) ' +
      'before dropping users.qid. Nothing was changed.',
  );
  process.exit(2);
}

const prisma = new PrismaClient();
const crypto = createQidRolloutCrypto();

async function main() {
  console.log(`qid:drop-plaintext — env files: ${loadedEnv.length ? loadedEnv.join(', ') : 'none (process env only)'}`);
  console.log(`qid:drop-plaintext — batch=${args.batchSize} dry_run=${args.dryRun}`);

  const totals = { scanned: 0, cleared: 0, kept: {} as Record<string, number> };
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

    const plan = planQidPlaintextDrop(rows, { decrypt: crypto.decrypt, hashOf: crypto.hashOf });
    for (const entry of plan.kept) totals.kept[entry.reason] = (totals.kept[entry.reason] ?? 0) + 1;

    if (plan.clear.length > 0 && !args.dryRun) {
      await prisma.user.updateMany({ where: { id: { in: plan.clear } }, data: { qid: null } });
    }

    totals.scanned += rows.length;
    totals.cleared += plan.clear.length;
    cursor = rows[rows.length - 1]!.id;
    console.log(
      `batch: scanned=${rows.length} clear=${plan.clear.length} kept=${plan.kept.length}` +
        (args.dryRun ? ' (dry run — nothing written)' : ''),
    );
  }

  if (Object.keys(totals.kept).length > 0) {
    console.warn('Some rows kept their plaintext (see `kept`); run `npm run qid:backfill` and re-run this script.');
  }
  console.log(JSON.stringify({ ...totals, dry_run: args.dryRun }, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
