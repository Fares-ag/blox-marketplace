/**
 * ETL orchestrator — run after Prisma migrate deploy.
 *
 *   DATABASE_URL=... SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *     npx tsx scripts/migration/supabase-to-prisma/migrate.ts
 *
 * Steps are idempotent via migration_id_map.
 */
import { PrismaClient } from '@prisma/client';
import { migrateUsers } from './01-users.js';
import { migrateProducts } from './02-products.js';
import { migrateApplications } from './03-applications.js';
import { migrateDocuments } from './04-documents.js';
import { migrateSchedules } from './05-schedules.js';
import { migrateTransactions } from './06-transactions.js';
import { migrateNotifications } from './07-notifications.js';
import { migrateCredits } from './08-credits.js';
import { migrateDeviceTokens } from './09-device-tokens.js';
import { migrateKycLinkage } from './10-kyc-linkage.js';
import { validateMigration } from './validate.js';

async function restGetAll(
  base: string,
  key: string,
  table: string,
  select = '*',
): Promise<Record<string, unknown>[]> {
  const rows: Record<string, unknown>[] = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const to = from + pageSize - 1;
    const res = await fetch(`${base}/rest/v1/${table}?select=${select}`, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        Range: `${from}-${to}`,
        Prefer: 'count=exact',
      },
    });
    if (!res.ok) throw new Error(`${table} HTTP ${res.status} ${await res.text()}`);
    const chunk = (await res.json()) as Record<string, unknown>[];
    rows.push(...chunk);
    if (chunk.length < pageSize) break;
  }
  return rows;
}

export type MigrateCtx = {
  prisma: PrismaClient;
  fetchTable: (table: string, select?: string) => Promise<Record<string, unknown>[]>;
  defaultCompanyId: string;
};

async function main() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
    process.exit(1);
  }
  const prisma = new PrismaClient();
  const ctx: MigrateCtx = {
    prisma,
    fetchTable: (table, select) => restGetAll(url, key, table, select),
    defaultCompanyId: process.env.MIGRATION_DEFAULT_COMPANY_ID ?? '',
  };

  try {
    console.log('01 users');
    await migrateUsers(ctx, url, key);
    console.log('02 products');
    await migrateProducts(ctx);
    console.log('03 applications');
    await migrateApplications(ctx);
    console.log('04 documents');
    await migrateDocuments(ctx);
    console.log('05 schedules');
    await migrateSchedules(ctx);
    console.log('06 transactions');
    await migrateTransactions(ctx);
    console.log('07 notifications');
    await migrateNotifications(ctx);
    console.log('08 credits');
    await migrateCredits(ctx);
    console.log('09 device tokens');
    await migrateDeviceTokens(ctx);
    console.log('10 kyc linkage');
    await migrateKycLinkage(ctx);
    console.log('validate');
    await validateMigration(ctx);
    console.log('done');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
