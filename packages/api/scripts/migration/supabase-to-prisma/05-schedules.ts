import { ScheduleStatus } from '@prisma/client';
import { logError, lookupId } from './id-map.js';
import { newId } from './01-users.js';
import type { MigrateCtx } from './migrate.js';

export async function migrateSchedules(ctx: MigrateCtx) {
  const { prisma } = ctx;
  const rows = await ctx.fetchTable('payment_schedules');
  const byApp = new Map<string, Record<string, unknown>[]>();
  for (const row of rows) {
    const key = `${row.application_id}`;
    byApp.set(key, [...(byApp.get(key) ?? []), row]);
  }
  for (const [sourceAppId, list] of byApp) {
    const applicationId = await lookupId(prisma, 'application', sourceAppId);
    if (!applicationId) continue;
    const ordered = [...list].sort((a, b) => `${a.due_date}`.localeCompare(`${b.due_date}`));
    let seq = 1;
    for (const row of ordered) {
      try {
        if (await lookupId(prisma, 'schedule', `${row.id}`)) {
          seq += 1;
          continue;
        }
        const amount = Number(row.amount ?? 0);
        const paid = Number(row.paid_amount ?? 0);
        const statusRaw = `${row.status ?? 'pending'}`;
        const status = (Object.values(ScheduleStatus) as string[]).includes(statusRaw)
          ? (statusRaw as ScheduleStatus)
          : ScheduleStatus.pending;
        await prisma.paymentSchedule.create({
          data: {
            id: newId(),
            applicationId,
            sequence: seq,
            dueDate: new Date(`${row.due_date}`),
            amount,
            paidAmount: paid,
            remainingAmount: Number(row.remaining_amount ?? Math.max(0, amount - paid)),
            status,
            paidAt: row.paid_date ? new Date(`${row.paid_date}`) : null,
          },
        });
        await prisma.migrationIdMap.create({
          data: { entity: 'schedule', sourceId: `${row.id}`, targetId: `${row.id}` },
        });
        seq += 1;
      } catch (err) {
        await logError(prisma, 'schedule', `${row.id}`, String(err), row);
      }
    }
  }
}
