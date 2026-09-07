import type { Offer, PrismaClient } from '@prisma/client';
export declare function assertDefaultOfferForCompany(prisma: Pick<PrismaClient, 'offer'>, companyId: string, defaultOfferId: string): Promise<Offer>;
