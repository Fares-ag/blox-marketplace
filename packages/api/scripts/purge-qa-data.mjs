/**
 * Remove all marketplace business / QA data while preserving login accounts.
 *
 * Keeps: users, accounts, sessions, verifications, twoFactor, mobile_refresh_tokens
 * Deletes: applications, inventory, payments, companies, catalog config, etc.
 *
 * Production:
 *   railway run --service api node scripts/purge-qa-data.mjs
 *
 * Local (requires CONFIRM_PURGE=1):
 *   CONFIRM_PURGE=1 node packages/api/scripts/purge-qa-data.mjs
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function redactDatabaseUrl(url) {
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.username ? '***:***@' : ''}${parsed.host}${parsed.pathname}`;
  } catch {
    return '(unparseable DATABASE_URL)';
  }
}

async function count(table) {
  const rows = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::bigint AS count FROM "${table}"`);
  return Number(rows[0]?.count ?? 0);
}

async function main() {
  if (process.env.CONFIRM_PURGE !== '1') {
    console.error('Refusing to run: set CONFIRM_PURGE=1 to confirm destructive purge.');
    process.exit(1);
  }

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('DATABASE_URL is not set.');
    process.exit(1);
  }

  console.log('Target database:', redactDatabaseUrl(dbUrl));
  console.log('Preserving auth tables: users, accounts, sessions, verifications, twoFactor, mobile_refresh_tokens\n');

  const before = {
    users: await count('users'),
    applications: await count('applications'),
    products: await count('products'),
    companies: await count('companies'),
  };
  console.log('Before:', before);

  await prisma.$transaction(async (tx) => {
    await tx.paymentReminderSent.deleteMany();
    await tx.paymentDeferral.deleteMany();
    await tx.paymentEvent.deleteMany();
    await tx.paymentTransaction.deleteMany();
    await tx.paymentSchedule.deleteMany();
    await tx.complianceCheck.deleteMany();
    await tx.applicationDocument.deleteMany();
    await tx.application.deleteMany();
    await tx.dealerQuote.deleteMany();
    await tx.notification.deleteMany();
    await tx.$executeRawUnsafe(
      'ALTER TABLE activity_logs DISABLE TRIGGER activity_logs_immutable',
    );
    await tx.activityLog.deleteMany();
    await tx.$executeRawUnsafe(
      'ALTER TABLE activity_logs ENABLE TRIGGER activity_logs_immutable',
    );
    await tx.emailOutbox.deleteMany();
    await tx.idempotencyRecord.deleteMany();
    await tx.deviceToken.deleteMany();
    await tx.userCredit.deleteMany();
    await tx.productImage.deleteMany();
    await tx.product.deleteMany();
    await tx.offer.deleteMany();
    await tx.creditOfficerCompany.deleteMany();
    await tx.financeOfficerCompany.deleteMany();
    await tx.user.updateMany({ data: { companyId: null } });
    await tx.company.deleteMany();
    await tx.financePartner.deleteMany();
    await tx.migrationIdMap.deleteMany();
    await tx.migrationError.deleteMany();
  });

  const after = {
    users: await count('users'),
    accounts: await count('accounts'),
    sessions: await count('sessions'),
    applications: await count('applications'),
    products: await count('products'),
    companies: await count('companies'),
  };
  console.log('\nAfter:', after);
  console.log('\n✓ QA / business data purged. Login accounts preserved.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
