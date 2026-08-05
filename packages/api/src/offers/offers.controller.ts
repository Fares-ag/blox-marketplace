import { Controller, Get } from '@nestjs/common';
import { Public } from '../auth/guards';
import { PrismaService } from '../prisma/prisma.service';

@Controller('offers')
export class OffersController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  list() {
    return this.prisma.offer.findMany({
      where: { status: 'active' },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    });
  }
}
