import { logError, lookupId } from './id-map.js';
import type { MigrateCtx } from './migrate.js';

export async function migrateKycLinkage(ctx: MigrateCtx) {
  const { prisma } = ctx;
  const rows = await ctx.fetchTable('applications', 'id,kyc_case_id,kyc_status');
  for (const row of rows) {
    if (!row.kyc_case_id) continue;
    const applicationId = await lookupId(prisma, 'application', `${row.id}`);
    if (!applicationId) continue;
    try {
      await prisma.application.update({
        where: { id: applicationId },
        data: {
          kycCaseId: `${row.kyc_case_id}`,
          kycStatus: row.kyc_status ? `${row.kyc_status}` : 'pending',
        },
      });
    } catch (err) {
      await logError(prisma, 'kyc_link', `${row.id}`, String(err), row);
    }
  }
}
