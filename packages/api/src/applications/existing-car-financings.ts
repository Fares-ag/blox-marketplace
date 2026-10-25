import { ApplicationStatus, type PrismaClient } from '@prisma/client';

const INACTIVE: ApplicationStatus[] = [
  ApplicationStatus.draft,
  ApplicationStatus.rejected,
  ApplicationStatus.submission_cancelled,
  ApplicationStatus.completed,
];

/** Live files for this customer with the same lender — Al Jazeera's 1-car private-sector cap. */
export async function countExistingActiveCarFinancings(
  prisma: Pick<PrismaClient, 'application'>,
  opts: {
    customerUserId?: string | null;
    excludeApplicationId?: string;
    financePartnerId?: string | null;
  },
): Promise<number> {
  if (!opts.customerUserId) return 0;
  return prisma.application.count({
    where: {
      customerUserId: opts.customerUserId,
      ...(opts.excludeApplicationId ? { id: { not: opts.excludeApplicationId } } : {}),
      ...(opts.financePartnerId ? { financePartnerId: opts.financePartnerId } : {}),
      status: { notIn: INACTIVE },
    },
  });
}
