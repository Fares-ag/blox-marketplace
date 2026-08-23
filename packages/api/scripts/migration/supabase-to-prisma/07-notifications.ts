import { logError, lookupId } from './id-map.js';
import { newId } from './01-users.js';
import type { MigrateCtx } from './migrate.js';

export async function migrateNotifications(ctx: MigrateCtx) {
  const { prisma } = ctx;
  const rows = await ctx.fetchTable('notifications');
  for (const row of rows) {
    try {
      if (await lookupId(prisma, 'notification', `${row.id}`)) continue;
      const email = `${row.user_email ?? ''}`.toLowerCase();
      const user = email ? await prisma.user.findUnique({ where: { email } }) : null;
      if (!user) continue;
      await prisma.notification.create({
        data: {
          id: newId(),
          userId: user.id,
          title: `${row.title ?? 'Notification'}`,
          body: row.message ? `${row.message}` : null,
          linkPath: row.link ? `${row.link}` : null,
          readAt: row.read || row.is_read || row.seen ? new Date() : null,
          createdAt: row.created_at ? new Date(`${row.created_at}`) : undefined,
        },
      });
      await prisma.migrationIdMap.create({
        data: { entity: 'notification', sourceId: `${row.id}`, targetId: `${row.id}` },
      });
    } catch (err) {
      await logError(prisma, 'notification', `${row.id}`, String(err), row);
    }
  }
}
