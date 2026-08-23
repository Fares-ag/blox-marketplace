import { Controller, Get } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';
import { Public } from './common/auth/service-auth.guard';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  /** Cheap liveness probe. */
  @Public()
  @Get()
  live(): { ok: true } {
    return { ok: true };
  }

  /** Readiness probe — pings the database. Returns 503 on failure. */
  @Public()
  @Get('ready')
  async ready(): Promise<{ ok: boolean; db: boolean }> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { ok: true, db: true };
    } catch {
      // Nest maps a thrown ServiceUnavailableException to 503; keep it explicit.
      const { ServiceUnavailableException } = await import('@nestjs/common');
      throw new ServiceUnavailableException({ ok: false, db: false });
    }
  }
}
