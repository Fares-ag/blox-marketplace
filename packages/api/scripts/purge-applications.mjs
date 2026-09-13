/**
 * Remove all financing applications and dependent rows from the current database.
 * Preserves users, dealers, vehicle inventory, and auth sessions.
 *
 * Production:
 *   railway run --service api sh -c "CONFIRM_PURGE=1 node scripts/purge-applications.mjs"
 *
 * Local:
 *   CONFIRM_PURGE=1 node packages/api/scripts/purge-applications.mjs
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
  console.log('Purging applications only (users, dealers, and inventory are kept).\n');

  const before = {
    applications: await count('applications'),
    payment_schedules: await count('payment_schedules'),
    dealer_quotes: await count('dealer_quotes'),
    products_reserved: Number(
      (
        await prisma.$queryRawUnsafe(
          `SELECT COUNT(*)::bigint AS count FROM products WHERE "listingStatus" = 'reserved'`,
        )
      )[0]?.count ?? 0,
    ),
  };
  console.log('Before:', before);

  await prisma.$transaction(async (tx) => {
    // Payment ledger (Restrict FKs on applications).
    await tx.paymentReminderSent.deleteMany();
    await tx.paymentEvent.deleteMany();
    await tx.paymentTransaction.deleteMany();
    await tx.paymentSchedule.deleteMany();
    await tx.applicationSettlement.deleteMany();
    await tx.paymentDeferral.deleteMany();

    // Collections / hardship (hardship references collections).
    await tx.hardshipPlan.deleteMany();
    await tx.collectionsCase.deleteMany();
    await tx.repossessionCase.deleteMany();
    await tx.totalLossClaim.deleteMany();

    // Ownership register is append-only — disable trigger before delete.
    await tx.$executeRawUnsafe(
      'ALTER TABLE ownership_register_entries DISABLE TRIGGER ownership_register_entries_immutable',
    );
    await tx.$executeRawUnsafe(
      `DELETE FROM ownership_register_entries WHERE register_id IN (SELECT id FROM ownership_registers)`,
    );
    await tx.$executeRawUnsafe('DELETE FROM ownership_registers');
    await tx.$executeRawUnsafe(
      'ALTER TABLE ownership_register_entries ENABLE TRIGGER ownership_register_entries_immutable',
    );

    await tx.rentPoolLedgerEntry.deleteMany();
    await tx.unitOffer.deleteMany();
    await tx.lpoRecord.deleteMany();
    await tx.takafulPolicy.deleteMany();
    await tx.guarantorConsentSession.deleteMany();
    await tx.assistedSession.deleteMany();
    await tx.complianceCheck.deleteMany();
    await tx.applicationDocument.deleteMany();
    await tx.contractDocument.deleteMany();

    // Quotes reference applications via usedByApplicationId.
    await tx.dealerQuote.deleteMany();

    await tx.application.deleteMany();

    // Detach consent ledger rows (immutable — never deleted).
    await tx.consentRecord.updateMany({
      data: { applicationId: null },
      where: { applicationId: { not: null } },
    });

    // Activity log is append-only — disable trigger for application rows only.
    await tx.$executeRawUnsafe('ALTER TABLE activity_logs DISABLE TRIGGER activity_logs_immutable');
    await tx.activityLog.deleteMany({ where: { entityType: 'application' } });
    await tx.$executeRawUnsafe('ALTER TABLE activity_logs ENABLE TRIGGER activity_logs_immutable');

    // In-app notifications that point at application pages.
    await tx.notification.deleteMany({
      where: { linkPath: { contains: '/app/applications/' } },
    });

    // Release vehicles held by in-flight applications.
    await tx.$executeRawUnsafe(
      `UPDATE products SET "listingStatus" = 'published', "updatedAt" = NOW() WHERE "listingStatus" = 'reserved'`,
    );

    // Reset human-friendly BLOX-#### sequence for the next application.
    await tx.$executeRawUnsafe(`SELECT setval(pg_get_serial_sequence('applications', 'reference_seq'), 1, false)`);
  });

  const after = {
    applications: await count('applications'),
    payment_schedules: await count('payment_schedules'),
    dealer_quotes: await count('dealer_quotes'),
    products: await count('products'),
    companies: await count('companies'),
    users: await count('users'),
    products_reserved: Number(
      (
        await prisma.$queryRawUnsafe(
          `SELECT COUNT(*)::bigint AS count FROM products WHERE "listingStatus" = 'reserved'`,
        )
      )[0]?.count ?? 0,
    ),
  };
  console.log('\nAfter:', after);
  console.log('\n✓ All applications purged. Inventory and accounts preserved.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
