import { ApplicationStatus } from '@prisma/client';
import { logError, lookupId, mapId } from './id-map.js';
import { newId } from './01-users.js';
import type { MigrateCtx } from './migrate.js';

const STATUSES = new Set(Object.values(ApplicationStatus));

export async function migrateApplications(ctx: MigrateCtx) {
  const { prisma } = ctx;
  const rows = await ctx.fetchTable('applications');
  const defaultOffer = await prisma.offer.findFirst({ where: { status: 'active' } });
  const defaultCompany = await prisma.company.findFirst({ where: { status: 'active' } });
  if (!defaultOffer || !defaultCompany) throw new Error('Need company + offer before applications');

  for (const row of rows) {
    const sourceId = `${row.id}`;
    try {
      if (await lookupId(prisma, 'application', sourceId)) continue;
      const email = `${row.customer_email ?? ''}`.toLowerCase();
      const user = email ? await prisma.user.findUnique({ where: { email } }) : null;
      if (!user) {
        await logError(prisma, 'application', sourceId, 'user_not_found', { email });
        continue;
      }
      const productId =
        (await lookupId(prisma, 'product', `${row.vehicle_id ?? ''}`)) ??
        (await prisma.product.findFirst({ select: { id: true } }))?.id;
      if (!productId) {
        await logError(prisma, 'application', sourceId, 'product_not_found', row);
        continue;
      }
      const product = await prisma.product.findUniqueOrThrow({ where: { id: productId } });
      const info = (row.customer_info ?? {}) as Record<string, unknown>;
      const statusRaw = `${row.status ?? 'draft'}`;
      const status = STATUSES.has(statusRaw as ApplicationStatus)
        ? (statusRaw as ApplicationStatus)
        : ApplicationStatus.draft;
      const id = newId();
      await prisma.application.create({
        data: {
          id,
          customerUserId: user.id,
          customerEmail: user.email,
          customerSnapshot: {
            full_name: row.customer_name ?? `${info.firstName ?? ''} ${info.lastName ?? ''}`.trim(),
            firstName: info.firstName ?? null,
            lastName: info.lastName ?? null,
            phone: row.customer_phone ?? info.phone ?? user.phone,
            qid: info.nationalId ?? null,
            nationality: info.nationality ?? null,
            gender: info.gender ?? null,
            employment: info.employment ?? null,
            income: info.income ?? null,
          },
          productId,
          companyId: product.companyId,
          offerId: product.defaultOfferId ?? defaultOffer.id,
          pricingSnapshot: {
            loan_amount: row.loan_amount,
            down_payment: row.down_payment,
            selling_price: row.selling_price,
            customer_display_price: row.customer_display_price,
            hide_interest: row.hide_interest,
            installment_plan: row.installment_plan,
            customer_display_rate: row.customer_display_rate,
            internal_annual_rate: row.internal_annual_rate,
          },
          status,
          resubmissionComment: row.resubmission_comments ? `${row.resubmission_comments}` : null,
          contractPdfPath: row.contract_file_path ? `${row.contract_file_path}` : null,
          signedContractPath: row.contract_url ? `${row.contract_url}` : null,
          kycCaseId: row.kyc_case_id ? `${row.kyc_case_id}` : null,
          kycStatus: row.kyc_status ? `${row.kyc_status}` : null,
          bloxMembership: (row.blox_membership as object) ?? undefined,
          createdAt: row.created_at ? new Date(`${row.created_at}`) : undefined,
          submittedAt: row.submitted_at ? new Date(`${row.submitted_at}`) : undefined,
        },
      });
      await mapId(prisma, 'application', sourceId, id);
    } catch (err) {
      await logError(prisma, 'application', sourceId, String(err), row);
    }
  }
}
