import { BadRequestException } from '@nestjs/common';
import type { Offer, PrismaClient } from '@prisma/client';

export async function assertDefaultOfferForCompany(
  prisma: Pick<PrismaClient, 'offer'>,
  companyId: string,
  defaultOfferId: string,
): Promise<Offer> {
  const offer = await prisma.offer.findUnique({ where: { id: defaultOfferId } });
  if (!offer) throw new BadRequestException('offer_not_found');
  if (offer.status !== 'active') throw new BadRequestException('offer_not_active');
  if (offer.companyId && offer.companyId !== companyId) {
    throw new BadRequestException('offer_not_permitted');
  }
  return offer;
}
