/**
 * Idempotent QA mobile customer accounts for blox-app device testing.
 *
 * Local:
 *   node packages/api/scripts/ensure-qa-mobile-users.mjs
 *
 * Production (Railway):
 *   railway run --service api node scripts/ensure-qa-mobile-users.mjs
 *
 * Password: SEED_PASSWORD env or BloxQa2026!Mobile
 */
import { PrismaClient, UserRole } from '@prisma/client';
import { hashPassword } from 'better-auth/crypto';

const prisma = new PrismaClient();
const PASSWORD = process.env.QA_MOBILE_PASSWORD ?? process.env.SEED_PASSWORD ?? 'BloxQa2026!Mobile';

/** @type {Array<{ email: string; name: string; phone: string }>} */
const QA_MOBILE_USERS = [
  {
    email: 'qa-mobile@drivemarket.local',
    name: 'QA Mobile',
    phone: '+97455101001',
  },
  {
    email: 'qa-mobile-b@drivemarket.local',
    name: 'QA Mobile B',
    phone: '+97455101002',
  },
];

async function upsertCredential(userId, passwordHash) {
  await prisma.account.deleteMany({ where: { userId, providerId: 'credential' } });
  await prisma.account.create({
    data: {
      userId,
      accountId: userId,
      providerId: 'credential',
      password: passwordHash,
    },
  });
}

async function ensureQaMobileUser(spec, passwordHash) {
  const email = spec.email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        name: spec.name,
        phone: spec.phone,
        role: UserRole.customer,
        emailVerified: true,
        isActive: true,
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });
    await upsertCredential(existing.id, passwordHash);
    console.log('updated', email, spec.phone);
    return existing.id;
  }

  const user = await prisma.user.create({
    data: {
      email,
      name: spec.name,
      phone: spec.phone,
      role: UserRole.customer,
      emailVerified: true,
      isActive: true,
    },
  });
  await upsertCredential(user.id, passwordHash);
  console.log('created', email, spec.phone);
  return user.id;
}

async function main() {
  const passwordHash = await hashPassword(PASSWORD);
  for (const spec of QA_MOBILE_USERS) {
    await ensureQaMobileUser(spec, passwordHash);
  }
  console.log('\nQA mobile users ready.');
  console.log('Password:', PASSWORD);
  console.log('Mobile sign-in: POST /api/v1/auth/mobile/sign-in');
  for (const u of QA_MOBILE_USERS) {
    console.log(' -', u.email, '(', u.name, ')');
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
