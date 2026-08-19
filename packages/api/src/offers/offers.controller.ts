import { Controller, Get } from '@nestjs/common';
import { Public } from '../auth/guards';
import { PrismaService } from '../prisma/prisma.service';

@Controller('offers')
export class OffersController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Public storefront needs rate/tenure/down-payment to render estimates.
   * P1-7: internal margin (profitRate) and other internals stay server-side.
   */
  @Public()
  @Get()
  list() {
    return this.prisma.offer.findMany({
      where: { status: 'active' },
      select: {
        id: true,
        name: true,
        annualRentRate: true,
        tenureOptions: true,
        minDownPaymentPct: true,
        isDefault: true,
        financePartnerId: true,
      },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    });
  }
}
