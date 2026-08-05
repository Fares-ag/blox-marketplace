import { PrismaClient, UserRole } from '@prisma/client';
import { hashPassword } from 'better-auth/crypto';

const prisma = new PrismaClient();
const PASSWORD = 'Password123!';

async function upsertUser(opts: {
  email: string;
  name: string;
  role: UserRole;
  companyId?: string;
  creditScope?: 'all' | 'assigned';
  financeScope?: 'all' | 'assigned';
}) {
  const password = await hashPassword(PASSWORD);
  const existing = await prisma.user.findUnique({ where: { email: opts.email } });
  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        role: opts.role,
        companyId: opts.companyId ?? null,
        creditScope: opts.creditScope ?? 'assigned',
        financeScope: opts.financeScope ?? 'assigned',
        emailVerified: true,
        name: opts.name,
      },
    });
    await prisma.account.deleteMany({ where: { userId: existing.id, providerId: 'credential' } });
    await prisma.account.create({
      data: {
        userId: existing.id,
        accountId: existing.id,
        providerId: 'credential',
        password,
      },
    });
    return existing.id;
  }

  const user = await prisma.user.create({
    data: {
      email: opts.email,
      name: opts.name,
      emailVerified: true,
      role: opts.role,
      companyId: opts.companyId,
      creditScope: opts.creditScope ?? 'assigned',
      financeScope: opts.financeScope ?? 'assigned',
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
  return user.id;
}

async function main() {
  const company = await prisma.company.upsert({
    where: { code: 'GULF' },
    update: { name: 'Gulf Motors Demo', status: 'active' },
    create: {
      name: 'Gulf Motors Demo',
      code: 'GULF',
      status: 'active',
      contactEmail: 'dealer@drivemarket.local',
      canPay: false,
    },
  });

  await prisma.offer.upsert({
    where: { id: 'seed-default-offer' },
    update: {},
    create: {
      id: 'seed-default-offer',
      name: 'Standard DriveMarket Finance',
      annualRentRate: 12.5,
      tenureOptions: [12, 24, 36, 48, 60],
      isDefault: true,
      status: 'active',
      minDownPaymentPct: 10,
    },
  });

  await upsertUser({
    email: 'customer@drivemarket.local',
    name: 'Demo Customer',
    role: UserRole.customer,
  });
  await upsertUser({
    email: 'dealer@drivemarket.local',
    name: 'Demo Dealer',
    role: UserRole.dealer_agent,
    companyId: company.id,
  });
  await upsertUser({
    email: 'credit@drivemarket.local',
    name: 'Demo Credit',
    role: UserRole.credit_officer,
    creditScope: 'all',
  });
  await upsertUser({
    email: 'finance@drivemarket.local',
    name: 'Demo Finance',
    role: UserRole.finance_officer,
    financeScope: 'all',
  });
  await upsertUser({
    email: 'admin@drivemarket.local',
    name: 'Demo Admin',
    role: UserRole.admin,
    creditScope: 'all',
    financeScope: 'all',
  });
  await upsertUser({
    email: 'super@drivemarket.local',
    name: 'Demo Super',
    role: UserRole.super_admin,
    creditScope: 'all',
    financeScope: 'all',
  });

  // eslint-disable-next-line no-console
  console.log('Seed complete. Password for all users:', PASSWORD);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
