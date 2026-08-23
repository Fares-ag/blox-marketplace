import { PaymentTransactionStatus } from '@prisma/client';
import { logError, lookupId } from './id-map.js';
import { newId } from './01-users.js';
import type { MigrateCtx } from './migrate.js';

export async function migrateTransactions(ctx: MigrateCtx) {
  const { prisma } = ctx;
  const rows = await ctx.fetchTable('payment_transactions');
  for (const row of rows) {
    try {
      if (await lookupId(prisma, 'transaction', `${row.id}`)) continue;
      const applicationId = await lookupId(prisma, 'application', `${row.application_id}`);
      if (!applicationId) continue;
      const statusRaw = `${row.status ?? 'pending'}`;
      const status = (Object.values(PaymentTransactionStatus) as string[]).includes(statusRaw)
        ? (statusRaw as PaymentTransactionStatus)
        : PaymentTransactionStatus.pending;
      await prisma.paymentTransaction.create({
        data: {
          id: newId(),
          gateway: `${row.method ?? 'skipcash'}`,
          gatewayPaymentId: row.transaction_id ? `${row.transaction_id}` : null,
          idempotencyKey: `migrated:${row.id}`,
          amount: Number(row.amount ?? 0),
          status,
          applicationId,
        },
      });
      await prisma.migrationIdMap.create({
        data: { entity: 'transaction', sourceId: `${row.id}`, targetId: `${row.id}` },
      });
    } catch (err) {
      await logError(prisma, 'transaction', `${row.id}`, String(err), row);
    }
  }
}
