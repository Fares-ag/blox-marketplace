/**
 * Delete financing applications that belong to QA/demo customers only.
 * Keeps the user accounts, dealer inventory, and every other customer's applications.
 *
 * Matches customerEmail or the linked user email ending in @drivemarket.local
 * (customer@, qa-customer@, qa-register-*@).
 *
 * Dry-run (prints matches, deletes nothing):
 *   node packages/api/scripts/purge-qa-customer-applications.mjs
 *
 * Production dry-run:
 *   railway run --service api node scripts/purge-qa-customer-applications.mjs
 *
 * Execute (both flags required):
 *   CONFIRM_PURGE=1 EXECUTE=1 node packages/api/scripts/purge-qa-customer-applications.mjs
 */
import { PrismaClient } from '@prisma/client';

const QA_DOMAIN = '@drivemarket.local';
const prisma = new PrismaClient();

function redactDatabaseUrl(url) {
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.username ? '***:***@' : ''}${parsed.host}${parsed.pathname}`;
  } catch {
    return '(unparseable DATABASE_URL)';
  }
}

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('DATABASE_URL is not set.');
    process.exit(1);
  }

  const execute = process.env.CONFIRM_PURGE === '1' && process.env.EXECUTE === '1';
  console.log('Target database:', redactDatabaseUrl(dbUrl));
  console.log(execute ? 'EXECUTE: deleting QA customer applications.' : 'DRY RUN: no rows will be deleted.');

  const apps = await prisma.application.findMany({
    where: {
      OR: [
        { customerEmail: { endsWith: QA_DOMAIN, mode: 'insensitive' } },
        { customer: { is: { email: { endsWith: QA_DOMAIN, mode: 'insensitive' } } } },
      ],
    },
    select: {
      id: true,
      customerEmail: true,
      status: true,
      referenceSeq: true,
      productId: true,
      customer: { select: { email: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  const unexpected = apps.filter((app) => {
    const email = (app.customer?.email ?? app.customerEmail).toLowerCase();
    return !email.endsWith(QA_DOMAIN);
  });
  if (unexpected.length) {
    console.error('Refusing: matched applications that are not QA emails.');
    for (const app of unexpected) {
      console.error(`  ${app.id} ${app.customerEmail} user=${app.customer?.email ?? ''}`);
    }
    process.exit(1);
  }

  console.log(`\nMatched ${apps.length} QA application(s):`);
  for (const app of apps) {
    console.log(
      `  BLOX-${app.referenceSeq} ${app.status} ${app.customerEmail} user=${app.customer?.email ?? '—'} ${app.id}`,
    );
  }
  if (!execute) {
    console.log('\nDry run only. Re-run with CONFIRM_PURGE=1 EXECUTE=1 to delete these rows.');
    return;
  }
  if (apps.length === 0) {
    console.log('\nNothing to delete.');
    return;
  }

  const ids = apps.map((app) => app.id);
  const productIds = [...new Set(apps.map((app) => app.productId))];
  for (const id of ids) {
    if (!/^[a-z0-9]+$/i.test(id)) throw new Error(`Refusing unsafe application id: ${id}`);
  }
  const idList = ids.map((id) => `'${id}'`).join(', ');

  await prisma.$transaction(async (tx) => {
    const schedules = await tx.paymentSchedule.findMany({
      where: { applicationId: { in: ids } },
      select: { id: true },
    });
    const scheduleIds = schedules.map((row) => row.id);
    if (scheduleIds.length) {
      await tx.paymentReminderSent.deleteMany({ where: { scheduleId: { in: scheduleIds } } });
    }
    await tx.paymentEvent.deleteMany({ where: { applicationId: { in: ids } } });
    await tx.paymentTransaction.deleteMany({ where: { applicationId: { in: ids } } });
    await tx.paymentSchedule.deleteMany({ where: { applicationId: { in: ids } } });
    await tx.applicationSettlement.deleteMany({ where: { applicationId: { in: ids } } });
    await tx.paymentDeferral.deleteMany({ where: { applicationId: { in: ids } } });

    await tx.hardshipPlan.deleteMany({ where: { applicationId: { in: ids } } });
    await tx.collectionsCase.deleteMany({ where: { applicationId: { in: ids } } });
    await tx.repossessionCase.deleteMany({ where: { applicationId: { in: ids } } });
    await tx.totalLossClaim.deleteMany({ where: { applicationId: { in: ids } } });

    await tx.$executeRawUnsafe(
      'ALTER TABLE ownership_register_entries DISABLE TRIGGER ownership_register_entries_immutable',
    );
    await tx.$executeRawUnsafe(
      `DELETE FROM ownership_register_entries WHERE register_id IN (
         SELECT id FROM ownership_registers WHERE application_id IN (${idList})
       )`,
    );
    await tx.$executeRawUnsafe(
      `DELETE FROM ownership_registers WHERE application_id IN (${idList})`,
    );
    await tx.$executeRawUnsafe(
      'ALTER TABLE ownership_register_entries ENABLE TRIGGER ownership_register_entries_immutable',
    );

    await tx.rentPoolLedgerEntry.deleteMany({ where: { applicationId: { in: ids } } });
    await tx.unitOffer.deleteMany({ where: { applicationId: { in: ids } } });
    await tx.lpoRecord.deleteMany({ where: { applicationId: { in: ids } } });
    await tx.takafulPolicy.deleteMany({ where: { applicationId: { in: ids } } });
    await tx.guarantorConsentSession.deleteMany({ where: { applicationId: { in: ids } } });
    await tx.assistedSession.deleteMany({ where: { applicationId: { in: ids } } });
    await tx.complianceCheck.deleteMany({ where: { applicationId: { in: ids } } });
    await tx.applicationDocument.deleteMany({ where: { applicationId: { in: ids } } });
    await tx.contractDocument.deleteMany({ where: { applicationId: { in: ids } } });

    await tx.dealerQuote.deleteMany({ where: { usedByApplicationId: { in: ids } } });

    await tx.consentRecord.updateMany({
      where: { applicationId: { in: ids } },
      data: { applicationId: null },
    });

    await tx.application.deleteMany({ where: { id: { in: ids } } });

    await tx.$executeRawUnsafe('ALTER TABLE activity_logs DISABLE TRIGGER activity_logs_immutable');
    await tx.activityLog.deleteMany({
      where: { entityType: 'application', entityId: { in: ids } },
    });
    await tx.$executeRawUnsafe('ALTER TABLE activity_logs ENABLE TRIGGER activity_logs_immutable');

    await tx.notification.deleteMany({
      where: {
        OR: ids.map((id) => ({ linkPath: { contains: id } })),
      },
    });

    await tx.product.updateMany({
      where: {
        id: { in: productIds },
        listingStatus: 'reserved',
        applications: { none: {} },
      },
      data: { listingStatus: 'published' },
    });
  });

  const remaining = await prisma.application.count({ where: { id: { in: ids } } });
  console.log(`\nDeleted ${ids.length - remaining} QA application(s). Accounts and inventory kept.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
