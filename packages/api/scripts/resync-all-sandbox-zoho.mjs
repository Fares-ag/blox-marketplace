/**
 * Bulk reset Zoho sync for partner applications synced before production CRM cutover.
 * Run inside Railway api container: node scripts/resync-all-sandbox-zoho.mjs [--dry-run]
 */
import { PrismaClient } from '@prisma/client';

const PRODUCTION_CUTOFF = new Date('2026-08-26T22:36:37.000Z');
const dryRun = process.argv.includes('--dry-run');

const CRM_SYNC_STATUSES = [
  'partner_processing',
  'under_review',
  'resubmission_required',
  'contract_signing_required',
  'contracts_submitted',
  'contract_under_review',
  'down_payment_required',
  'down_payment_submitted',
  'pending_finance_activation',
  'active',
];

const prisma = new PrismaClient();

try {
  const candidates = await prisma.application.findMany({
    where: {
      financePartner: { crmAdapter: 'zoho' },
      status: { in: CRM_SYNC_STATUSES },
      zohoLeadId: { not: null },
      OR: [{ zohoSyncedAt: null }, { zohoSyncedAt: { lt: PRODUCTION_CUTOFF } }],
    },
    select: {
      id: true,
      status: true,
      customerEmail: true,
      zohoLeadId: true,
      zohoSyncedAt: true,
      zohoSyncError: true,
      submittedAt: true,
    },
    orderBy: { submittedAt: 'asc' },
  });

  console.log(`Found ${candidates.length} application(s) to re-sync (synced before ${PRODUCTION_CUTOFF.toISOString()})`);
  for (const app of candidates) {
    console.log(
      JSON.stringify({
        id: app.id,
        email: app.customerEmail,
        status: app.status,
        zohoLeadId: app.zohoLeadId,
        zohoSyncedAt: app.zohoSyncedAt?.toISOString() ?? null,
      }),
    );
  }

  if (dryRun || candidates.length === 0) {
    process.exit(0);
  }

  const ids = candidates.map((a) => a.id);
  const updated = await prisma.application.updateMany({
    where: { id: { in: ids } },
    data: {
      zohoLeadId: null,
      zohoSyncedAt: null,
      zohoSyncError: null,
      zohoSyncAttempts: 0,
      zohoNextRetryAt: null,
    },
  });
  console.log(`Reset ${updated.count} application(s) for production Zoho re-sync`);
} finally {
  await prisma.$disconnect();
}
