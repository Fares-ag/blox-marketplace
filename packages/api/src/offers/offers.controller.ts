import { Controller, Get, Query } from '@nestjs/common';
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
  async list(@Query('limit') limit?: number, @Query('offset') offset?: number) {
    const take = Math.min(Math.max(limit ?? 50, 1), 100);
    const skip = Math.max(offset ?? 0, 0);
    const where = { status: 'active' as const };
    const [items, total] = await Promise.all([
      this.prisma.offer.findMany({
        where,
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
        take,
        skip,
      }),
      this.prisma.offer.count({ where }),
    ]);
    return { total, items };
  }
}
