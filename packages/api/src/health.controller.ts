import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { Public } from './auth/guards';
import { PrismaService } from './prisma/prisma.service';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  /** Cheap liveness probe — does not touch the database. */
  @Public()
  @Get()
  health() {
    return { ok: true, service: 'drivemarket-api' };
  }

  /** Readiness probe — verifies database connectivity. */
  @Public()
  @Get('ready')
  async ready() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { ok: true, service: 'drivemarket-api', database: 'up' };
    } catch {
      throw new ServiceUnavailableException({
        ok: false,
        service: 'drivemarket-api',
        database: 'down',
      });
    }
  }
}
