import { Controller, Get, Query } from '@nestjs/common';
import { Public } from '../auth/guards';
import { PrismaService } from '../prisma/prisma.service';

const FINANCE_PARTNER_LIST_CAP = 100;

@Controller()
export class FinancePartnersController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get('finance-partners')
  list(@Query('limit') limit?: number) {
    const take = Math.min(Math.max(limit ?? FINANCE_PARTNER_LIST_CAP, 1), FINANCE_PARTNER_LIST_CAP);
    return this.prisma.financePartner.findMany({
      where: { active: true },
      select: { id: true, code: true, name: true, crmAdapter: true },
      orderBy: { name: 'asc' },
      take,
    });
  }
}
