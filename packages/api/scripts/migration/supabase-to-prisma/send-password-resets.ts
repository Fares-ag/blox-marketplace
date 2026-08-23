/**
 * Phase 2.3 — create Better Auth users from Supabase (no password hashes)
 * and enqueue mandatory reset emails.
 *
 *   npx tsx scripts/migration/supabase-to-prisma/send-password-resets.ts
 *
 * Relies on 01-users having already mapped emails. Uses Better Auth
 * requestPasswordReset so customers set a new password on first login.
 */
import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  const authUrl = (process.env.BETTER_AUTH_URL ?? 'http://localhost:3010').replace(/\/$/, '');
  const users = await prisma.user.findMany({
    where: { role: 'customer', accounts: { none: {} } },
    select: { id: true, email: true },
  });
  console.log(`Password-reset campaign: ${users.length} users without credential accounts`);

  let sent = 0;
  for (const user of users) {
    try {
      const res = await fetch(`${authUrl}/api/auth/forget-password`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: user.email, redirectTo: `${process.env.MARKETPLACE_URL ?? authUrl}/reset-password` }),
      });
      if (res.ok || res.status === 200) sent += 1;
      else console.warn(`reset failed ${user.email}: ${res.status}`);
    } catch (err) {
      console.warn(`reset error ${user.email}: ${err}`);
    }
  }
  console.log(`Requested ${sent}/${users.length} password resets`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
