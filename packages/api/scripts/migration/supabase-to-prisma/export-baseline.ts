/**
 * Read-only production baseline export from Supabase PostgREST (Phase 0.2).
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/migration/supabase-to-prisma/export-baseline.ts
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const TABLES = [
  'users',
  'products',
  'applications',
  'payment_schedules',
  'payment_transactions',
  'notifications',
  'user_credits',
  'device_tokens',
  'payment_deferrals',
] as const;

async function countTable(base: string, key: string, table: string): Promise<number> {
  const res = await fetch(`${base}/rest/v1/${table}?select=id`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Prefer: 'count=exact',
      Range: '0-0',
    },
  });
  const range = res.headers.get('content-range');
  if (range && range.includes('/')) {
    const total = Number(range.split('/')[1]);
    if (Number.isFinite(total)) return total;
  }
  if (!res.ok) {
    console.warn(`count failed for ${table}: HTTP ${res.status}`);
    return -1;
  }
  return 0;
}

async function countAuthUsers(base: string, key: string): Promise<number> {
  const res = await fetch(`${base}/auth/v1/admin/users?page=1&per_page=1`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!res.ok) {
    console.warn(`auth.users count failed: HTTP ${res.status}`);
    return -1;
  }
  const body = (await res.json()) as { users?: unknown[]; total?: number };
  if (typeof body.total === 'number') return body.total;
  return Array.isArray(body.users) ? body.users.length : -1;
}

async function main() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
    process.exit(1);
  }

  const outDir = path.join(process.cwd(), 'scripts/migration/supabase-to-prisma/export');
  await mkdir(outDir, { recursive: true });

  const tables: Record<string, number> = {};
  for (const table of TABLES) {
    tables[table] = await countTable(url, key, table);
  }
  tables['auth.users'] = await countAuthUsers(url, key);

  const manifest = {
    exported_at: new Date().toISOString(),
    source: url,
    tables,
    storage: {
      'application-documents': -1,
      'signed-contracts': -1,
    },
    checksums: {},
    note: 'Fill storage counts after listing the documents bucket. This file is the cutover acceptance baseline.',
  };

  const dest = path.join(outDir, 'manifest.json');
  await writeFile(dest, JSON.stringify(manifest, null, 2));
  console.log(`Wrote ${dest}`);
  console.log(JSON.stringify(tables, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
