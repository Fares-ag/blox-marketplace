import type { PrismaService } from '../../../src/prisma/prisma.service';
import { ensureSystemUser } from '../../../src/common/ensure-system-user';

const TRUNCATE_TABLES = [
  'payment_events',
  'payment_transactions',
  'payment_schedules',
  'application_documents',
  'email_outbox',
  'notifications',
  'activity_logs',
  'applications',
  'dealer_quotes',
  'product_images',
  'products',
  'offers',
  'finance_officer_companies',
  'credit_officer_companies',
  'sessions',
  'accounts',
  'verifications',
  'users',
  'finance_partners',
  'companies',
  // No foreign keys, so the users/companies cascade never reaches it.
  'takaful_providers',
];

export async function resetDatabase(prisma: PrismaService) {
  const quoted = TRUNCATE_TABLES.map((t) => `"${t}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${quoted} RESTART IDENTITY CASCADE`);
  await ensureSystemUser(prisma);
}

export async function countRows(prisma: PrismaService, table: string): Promise<number> {
  const rows = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
    `SELECT COUNT(*)::bigint AS count FROM "${table}"`,
  );
  return Number(rows[0]?.count ?? 0);
}
