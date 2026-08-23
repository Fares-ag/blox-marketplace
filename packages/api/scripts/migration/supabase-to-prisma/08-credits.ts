import { logError } from './id-map.js';
import type { MigrateCtx } from './migrate.js';

export async function migrateCredits(ctx: MigrateCtx) {
  const { prisma } = ctx;
  const rows = await ctx.fetchTable('user_credits');
  for (const row of rows) {
    const email = `${row.user_email ?? ''}`.toLowerCase();
    try {
      const user = email ? await prisma.user.findUnique({ where: { email } }) : null;
      if (!user) continue;
      await prisma.userCredit.upsert({
        where: { userId: user.id },
        update: { balance: Number(row.balance ?? 0) },
        create: { userId: user.id, balance: Number(row.balance ?? 0) },
      });
    } catch (err) {
      await logError(prisma, 'user_credit', email, String(err), row);
    }
  }
}
