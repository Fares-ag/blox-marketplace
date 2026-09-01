/**
 * One-off: reset Zoho sync fields for an application so retry pushes to production CRM.
 * Usage (inside Railway api container): node scripts/resync-zoho-app.mjs <applicationId>
 */
import { PrismaClient } from '@prisma/client';

const id = process.argv[2];
if (!id) {
  console.error('Usage: node scripts/resync-zoho-app.mjs <applicationId>');
  process.exit(1);
}

const prisma = new PrismaClient();
try {
  const before = await prisma.application.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      zohoLeadId: true,
      zohoSyncedAt: true,
      zohoSyncError: true,
    },
  });
  if (!before) {
    console.error('Application not found:', id);
    process.exit(1);
  }
  console.log('Before:', JSON.stringify(before));

  await prisma.application.update({
    where: { id },
    data: {
      zohoLeadId: null,
      zohoSyncedAt: null,
      zohoSyncError: null,
      zohoSyncAttempts: 0,
      zohoNextRetryAt: null,
    },
  });
  console.log('Reset Zoho sync fields for', id);
} finally {
  await prisma.$disconnect();
}
