import { logError, lookupId } from './id-map.js';
import type { MigrateCtx } from './migrate.js';

export async function migrateDeviceTokens(ctx: MigrateCtx) {
  const { prisma } = ctx;
  const rows = await ctx.fetchTable('device_tokens');
  for (const row of rows) {
    try {
      const userId =
        (await lookupId(prisma, 'user', `${row.user_id ?? ''}`)) ??
        (row.user_email
          ? (await prisma.user.findUnique({ where: { email: `${row.user_email}`.toLowerCase() } }))?.id
          : null);
      if (!userId || !row.fcm_token) continue;
      await prisma.deviceToken.upsert({
        where: { fcmToken: `${row.fcm_token}` },
        update: { userId, platform: `${row.platform ?? 'android'}`, appVersion: row.app_version ? `${row.app_version}` : null },
        create: {
          userId,
          platform: `${row.platform ?? 'android'}`,
          fcmToken: `${row.fcm_token}`,
          appVersion: row.app_version ? `${row.app_version}` : null,
        },
      });
    } catch (err) {
      await logError(prisma, 'device_token', `${row.fcm_token}`, String(err), row);
    }
  }
}
