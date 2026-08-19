/**
 * Ensures qa-customer@drivemarket.local exists for isolated QA runs.
 * node packages/api/scripts/ensure-qa-customer.mjs
 */
import { PrismaClient } from '@prisma/client';
import { hashPassword } from 'better-auth/crypto';

const prisma = new PrismaClient();
const EMAIL = 'qa-customer@drivemarket.local';
const PASSWORD = 'Password123!';

async function main() {
  const password = await hashPassword(PASSWORD);
  const existing = await prisma.user.findUnique({ where: { email: EMAIL } });
  if (existing) {
    await prisma.account.deleteMany({ where: { userId: existing.id, providerId: 'credential' } });
    await prisma.account.create({
      data: {
        userId: existing.id,
        accountId: existing.id,
        providerId: 'credential',
        password,
      },
    });
    console.log('QA customer ready:', EMAIL, existing.id);
    return;
  }

  const user = await prisma.user.create({
    data: {
      email: EMAIL,
      name: 'QA Customer',
      emailVerified: true,
      role: 'customer',
    },
  });
  await prisma.account.create({
    data: {
      userId: user.id,
      accountId: user.id,
      providerId: 'credential',
      password,
    },
  });
  console.log('QA customer created:', EMAIL, user.id);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
