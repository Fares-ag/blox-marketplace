import { Controller, Get, Query } from '@nestjs/common';
import { Public } from '../auth/guards';
import { PrismaService } from '../prisma/prisma.service';
import { PaginationQueryDto, resolvePagination, toPaginatedResponse } from '../common/pagination.dto';
import { toPublicOfferDto } from '../common/offer-response.dto';

@Controller('offers')
export class OffersController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Public storefront needs rate/tenure/down-payment to render estimates.
   * P1-7: internal margin (profitRate) and other internals stay server-side.
   */
  @Public()
  @Get()
  async list(@Query() query: PaginationQueryDto) {
    const { limit, offset } = resolvePagination(query, { defaultLimit: 50, maxLimit: 100 });
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
        take: limit,
        skip: offset,
      }),
      this.prisma.offer.count({ where }),
    ]);
    return toPaginatedResponse(items.map((item) => toPublicOfferDto(item)), total, limit, offset);
  }
}
