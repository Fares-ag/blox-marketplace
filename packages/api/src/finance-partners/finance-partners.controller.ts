import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Public } from '../auth/guards';

@Controller()
export class FinancePartnersController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get('finance-partners')
  list() {
    return this.prisma.financePartner.findMany({
      where: { active: true },
      select: { id: true, code: true, name: true, crmAdapter: true },
      orderBy: { name: 'asc' },
    });
  }
}
