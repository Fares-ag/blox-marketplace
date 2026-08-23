/**
 * Idempotently create local/demo portal users with Better Auth credentials.
 * Production has no Supabase-era demo accounts — run against prod Postgres:
 *   railway run --service api node scripts/ensure-seed-users.mjs
 *
 * Local:
 *   node packages/api/scripts/ensure-seed-users.mjs
 */
import { PrismaClient, UserRole, OfficerScope } from '@prisma/client';
import { hashPassword } from 'better-auth/crypto';

const prisma = new PrismaClient();
const PASSWORD = process.env.SEED_PASSWORD ?? 'Password123!';

/** @type {Array<{ email: string; name: string; role: UserRole; companyCode?: string; creditScope?: OfficerScope; financeScope?: OfficerScope }>} */
const SEED_USERS = [
  { email: 'customer@drivemarket.local', name: 'Demo Customer', role: UserRole.customer },
  {
    email: 'dealer@drivemarket.local',
    name: 'Demo Dealer',
    role: UserRole.dealer_agent,
    companyCode: 'chery-elite-motors',
  },
  {
    email: 'credit@drivemarket.local',
    name: 'Demo Credit',
    role: UserRole.credit_officer,
    creditScope: OfficerScope.all,
  },
  {
    email: 'finance@drivemarket.local',
    name: 'Demo Finance',
    role: UserRole.finance_officer,
    financeScope: OfficerScope.all,
  },
  {
    email: 'admin@drivemarket.local',
    name: 'Demo Admin',
    role: UserRole.admin,
    creditScope: OfficerScope.all,
    financeScope: OfficerScope.all,
  },
  {
    email: 'super@drivemarket.local',
    name: 'Demo Super',
    role: UserRole.super_admin,
    creditScope: OfficerScope.all,
    financeScope: OfficerScope.all,
  },
];

async function resolveCompanyId(code) {
  let company = await prisma.company.findUnique({ where: { code } });
  if (!company && code === 'chery-elite-motors') {
    company = await prisma.company.create({
      data: {
        name: 'Chery Elite Motors',
        code: 'chery-elite-motors',
        status: 'active',
        allowDirectActivate: true,
      },
    });
    console.log('created company', code);
  }
  if (!company) {
    throw new Error(`Company not found: ${code}. Run db:seed first.`);
  }
  return company.id;
}

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

async function ensureUser(spec, passwordHash) {
  const companyId = spec.companyCode ? await resolveCompanyId(spec.companyCode) : null;
  const existing = await prisma.user.findUnique({ where: { email: spec.email } });

  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        name: spec.name,
        role: spec.role,
        companyId,
        creditScope: spec.creditScope ?? OfficerScope.assigned,
        financeScope: spec.financeScope ?? OfficerScope.assigned,
        emailVerified: true,
        isActive: true,
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });
    await upsertCredential(existing.id, passwordHash);
    console.log('updated', spec.email, spec.role, companyId ? `(company ${spec.companyCode})` : '');
    return existing.id;
  }

  const user = await prisma.user.create({
    data: {
      email: spec.email,
      name: spec.name,
      role: spec.role,
      companyId,
      creditScope: spec.creditScope ?? OfficerScope.assigned,
      financeScope: spec.financeScope ?? OfficerScope.assigned,
      emailVerified: true,
      isActive: true,
    },
  });
  await upsertCredential(user.id, passwordHash);
  console.log('created', spec.email, spec.role, companyId ? `(company ${spec.companyCode})` : '');
  return user.id;
}

async function main() {
  const passwordHash = await hashPassword(PASSWORD);
  for (const spec of SEED_USERS) {
    await ensureUser(spec, passwordHash);
  }
  console.log('\nSeed users ready. Password:', PASSWORD);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
