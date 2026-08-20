import { Controller, Get, Query } from '@nestjs/common';
import { Public } from '../auth/guards';
import { PrismaService } from '../prisma/prisma.service';
import {
  PaginationQueryDto,
  resolvePagination,
  toPaginatedResponse,
} from '../common/pagination.dto';
import { toFinancePartnerDto } from './finance-partner-response.dto';

@Controller()
export class FinancePartnersController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get('finance-partners')
  async list(@Query() query: PaginationQueryDto) {
    const { limit, offset } = resolvePagination(query, { defaultLimit: 100, maxLimit: 100 });
    const where = { active: true };
    const [rows, total] = await Promise.all([
      this.prisma.financePartner.findMany({
        where,
        select: { id: true, code: true, name: true, crmAdapter: true },
        orderBy: { name: 'asc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.financePartner.count({ where }),
    ]);
    return toPaginatedResponse(rows.map((row) => toFinancePartnerDto(row)), total, limit, offset);
  }
}
